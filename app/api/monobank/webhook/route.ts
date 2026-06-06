import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';
import { getRuntimeBaseUrl } from '@/lib/runtimeUrl';

export const dynamic = 'force-dynamic';

const PRODUCT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Monobank signs each webhook with the private key of the account that created
// the invoice. We run two merchant accounts (ФОП Коблик / ФОП Гоголь), so a
// single static pub key can't verify both. Load the public key of every active
// Monobank account (via /api/merchant/pubkey using its token), cache it, and
// accept a webhook if its X-Sign verifies against ANY of them. Env
// MONOBANK_PUB_KEY (PEM) is kept as an extra fallback.
let pubKeyCache: { keys: string[]; ts: number } | null = null;
const PUBKEY_TTL_MS = 60 * 60 * 1000; // 1h

async function loadMonobankPubKeys(admin: ReturnType<typeof getAdminClient>): Promise<string[]> {
    if (pubKeyCache && Date.now() - pubKeyCache.ts < PUBKEY_TTL_MS) return pubKeyCache.keys;
    const keys: string[] = [];
    if (process.env.MONOBANK_PUB_KEY) keys.push(process.env.MONOBANK_PUB_KEY);
    try {
        const { data: accounts } = await admin
            .from('bank_accounts')
            .select('api_key')
            .eq('bank_name', 'Monobank')
            .eq('is_active', true);
        for (const acc of accounts || []) {
            if (!acc?.api_key) continue;
            try {
                const r = await fetch('https://api.monobank.ua/api/merchant/pubkey', {
                    headers: { 'X-Token': acc.api_key },
                });
                if (!r.ok) continue;
                const j = await r.json();
                if (j?.key) {
                    // Monobank returns the PEM public key base64-encoded.
                    keys.push(Buffer.from(j.key, 'base64').toString('utf8'));
                }
            } catch (e) {
                console.error('loadMonobankPubKeys: failed for one account', e);
            }
        }
    } catch (e) {
        console.error('loadMonobankPubKeys: bank_accounts query failed', e);
    }
    if (keys.length > 0) pubKeyCache = { keys, ts: Date.now() };
    return keys;
}

function verifyMonobankSignature(rawBody: string, xSignBase64: string, pubKeys: string[]): boolean {
    return pubKeys.some(pk => {
        try {
            const v = crypto.createVerify('SHA256');
            v.update(rawBody);
            v.end();
            return v.verify(pk, xSignBase64, 'base64');
        } catch {
            return false;
        }
    });
}

/**
 * Decrement stock for the items in a paid order.
 *
 * Two layers:
 *   1. Per-variant stock — each product option variant can carry a `stock`
 *      number in products.options[].options[].stock (set in the admin Опції
 *      tab). The order item stores the chosen variant's *label* under
 *      options[optName], so we match by label (falling back to value).
 *   2. Product-level stock — for physical products with track_inventory on.
 *
 * Defensive by design: every product is wrapped in try/catch and the whole
 * call is awaited inside a try/catch in the webhook, so a stock error can
 * NEVER break payment confirmation. Quantities floor at 0 (never negative).
 *
 * Called once, at the moment an order transitions to paid (the caller guards
 * on the atomic-update result + previous payment_status), so there is no
 * double-deduction on webhook retries.
 *
 * Note: read-modify-write on the options JSONB is not atomic across two
 * payments confirming the SAME product variant in the same instant. Given the
 * low volume that's acceptable; the floor-at-0 prevents negative stock.
 */
async function deductInventory(admin: ReturnType<typeof getAdminClient>, items: any): Promise<void> {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        try {
            const qty = Number(item?.quantity ?? item?.qty ?? 1) || 1;
            const pid = item?.product_id;
            const slug = item?.slug || item?.product_slug;
            if (!pid && !slug) continue;

            let prod: any = null;
            if (pid && PRODUCT_UUID_RE.test(String(pid))) {
                const { data } = await admin.from('products')
                    .select('id, options, stock, track_inventory, product_type')
                    .eq('id', pid).maybeSingle();
                prod = data;
            }
            if (!prod && slug) {
                const { data } = await admin.from('products')
                    .select('id, options, stock, track_inventory, product_type')
                    .eq('slug', slug).maybeSingle();
                prod = data;
            }
            if (!prod) continue;

            const itemOpts = (item?.options && typeof item.options === 'object') ? item.options : {};
            let optionsChanged = false;
            const newOptions = Array.isArray(prod.options) ? prod.options.map((opt: any) => {
                const selected = itemOpts[opt?.name];
                if (selected == null || !Array.isArray(opt?.options)) return opt;
                let matched = false;
                const variants = opt.options.map((v: any) => {
                    if (!matched && v && v.stock != null &&
                        (v.label === selected || String(v.value) === String(selected))) {
                        matched = true;
                        optionsChanged = true;
                        return { ...v, stock: Math.max(0, Number(v.stock) - qty) };
                    }
                    return v;
                });
                return matched ? { ...opt, options: variants } : opt;
            }) : prod.options;

            const patch: Record<string, any> = {};
            if (optionsChanged) patch.options = newOptions;
            if (prod.track_inventory && prod.product_type === 'physical' && prod.stock != null) {
                patch.stock = Math.max(0, Number(prod.stock) - qty);
            }
            if (Object.keys(patch).length > 0) {
                await admin.from('products').update(patch).eq('id', prod.id);
            }
        } catch (e) {
            console.error('deductInventory: item failed (payment still confirmed)', e);
        }
    }
}


/**
 * Monobank Webhook Handler
 * Handles payment status updates from Monobank
 * Documentation: https://api.monobank.ua/docs/acquiring.html#webhook
 */

export async function POST(req: Request) {
    try {
        const body = await req.text();
        const data = JSON.parse(body);

        // Verify signature against the public key of EITHER Monobank account
        // (each ФОП signs its own webhooks). Keys are loaded from the active
        // bank_accounts and cached; env MONOBANK_PUB_KEY is an extra fallback.
        const supabase = getAdminClient();
        const pubKeys = await loadMonobankPubKeys(supabase);
        if (pubKeys.length > 0) {
            const xSignBase64 = req.headers.get('X-Sign');
            if (!xSignBase64) {
                console.error('Monobank webhook: missing X-Sign header');
                return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
            }
            if (!verifyMonobankSignature(body, xSignBase64, pubKeys)) {
                console.error('Monobank webhook signature verification failed');
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        } else if (process.env.NODE_ENV === 'production') {
            // No keys at all (no active Monobank accounts and no env fallback).
            console.error('Monobank webhook: no Monobank public keys available in production');
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
        }

        const {
            invoiceId,
            status,
            amount,
            ccy,
            reference, // This is our orderId
            approvalCode,
            rrn,
            createdDate,
            modifiedDate,
            failureReason
        } = data;

        console.log('Monobank webhook received:', {
            invoiceId,
            status,
            reference,
            amount
        });

        if (!reference) {
            console.error('No reference (orderId) in webhook data');
            return NextResponse.json(
                { error: 'Missing reference' },
                { status: 400 }
            );
        }

        // Validate reference looks like a UUID (our order_id format) so a
        // malformed payload can't cause oddities in the WHERE clause below.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (typeof reference !== 'string' || !UUID_RE.test(reference)) {
            console.error('Monobank webhook: invalid reference format', { reference });
            return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
        }

        // Idempotency + amount verification: load the order first.
        // Two reasons:
        //  1. Monobank retries webhooks. If we've already marked this
        //     invoice as paid for this order, skip the rest of the work.
        //  2. Verify the paid amount matches the order's stored total
        //     (in kopecks). A mismatch should never happen with a valid
        //     signature + our own create-invoice flow, but a defence in
        //     depth check costs nothing and would catch e.g. a hijacked
        //     keypair situation.
        const { data: existingOrder } = await supabase
            .from('orders')
            .select('id, total, payment_status, monobank_invoice_status, monobank_invoice_id, with_designer, payment_type, prepaid_amount, items')
            .eq('id', reference)
            .single();

        if (!existingOrder) {
            console.error('Monobank webhook: order not found', { reference });
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // If we've already processed this exact invoice with this status, skip.
        if (
            existingOrder.monobank_invoice_id === invoiceId &&
            existingOrder.monobank_invoice_status === status
        ) {
            console.log('Monobank webhook: duplicate notification, skipping', { reference, invoiceId, status });
            return NextResponse.json({ success: true, idempotent: true });
        }

        // Amount verification (only meaningful on 'success' / 'hold').
        if ((status === 'success' || status === 'hold') && typeof amount === 'number') {
            // Split/prepaid orders are invoiced for prepaid_amount (≈50%), not
            // the full total — compare against whatever was actually charged.
            const isSplit = existingOrder.payment_type === 'split' && Number(existingOrder.prepaid_amount) > 0;
            const expectedUah = isSplit ? Number(existingOrder.prepaid_amount) : Number(existingOrder.total);
            const expectedKopecks = Math.round(expectedUah * 100);
            if (Math.abs(amount - expectedKopecks) > 1) {
                // Off-by-one tolerance for rounding, but anything bigger is suspicious.
                console.error('Monobank webhook: amount mismatch', {
                    reference,
                    invoice_amount: amount,
                    order_total_kopecks: expectedKopecks,
                });
                return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
            }
        }

        // Map Monobank status to payment status
        let paymentStatus = 'pending';
        let notes = '';

        switch (status) {
            case 'success':
                paymentStatus = 'paid';
                notes = `Оплата успішна через Monobank. Invoice: ${invoiceId}, RRN: ${rrn}, Код: ${approvalCode}`;
                break;
            case 'processing':
                paymentStatus = 'pending';
                notes = `Оплата в обробці. Invoice: ${invoiceId}`;
                break;
            case 'hold':
                paymentStatus = 'pending';
                notes = `Сума заблокована (hold). Invoice: ${invoiceId}`;
                break;
            case 'failure':
                paymentStatus = 'failed';
                notes = `Оплата відхилена. Invoice: ${invoiceId}, Причина: ${failureReason || 'Unknown'}`;
                break;
            case 'reversed':
                paymentStatus = 'refunded';
                notes = `Оплата повернена (reversed). Invoice: ${invoiceId}`;
                break;
            default:
                notes = `Статус оплати змінено на: ${status}. Invoice: ${invoiceId}`;
        }

        // Update order payment status — atomic conditional UPDATE.
        // Only writes if the invoice/status combo isn't already recorded,
        // which is what makes this race-safe: two concurrent webhook
        // deliveries can't both succeed and both insert an order_history
        // row. Whichever UPDATE runs first wins; the second observes 0
        // affected rows and short-circuits.
        const { data: updateResult, error: updateError } = await supabase
            .from('orders')
            .update({
                payment_status: paymentStatus,
                monobank_invoice_id: invoiceId,
                monobank_invoice_status: status,
                monobank_approval_code: approvalCode || null,
                monobank_rrn: rrn || null,
                ...(status === 'success' && existingOrder.payment_status !== 'paid'
                    ? { paid_at: new Date().toISOString() }
                    : {}),
                updated_at: new Date().toISOString()
            })
            .eq('id', reference)
            // Race-safety: only update if the (invoice_id, status) tuple
            // hasn't already been applied. Use 'or' to handle the first-time
            // case where monobank_invoice_id is NULL.
            .or(`monobank_invoice_id.is.null,monobank_invoice_id.neq.${invoiceId},monobank_invoice_status.neq.${status}`)
            .select('id');

        if (updateError) {
            console.error('Error updating order payment status:', updateError);
            return NextResponse.json(
                { error: 'Database update failed' },
                { status: 500 }
            );
        }

        // 0 rows affected means another concurrent webhook for this same
        // invoice+status got there first.
        if (!updateResult || updateResult.length === 0) {
            console.log('Monobank webhook: concurrent duplicate, skipping', { reference, invoiceId, status });
            return NextResponse.json({ success: true, idempotent: true });
        }

        // Log payment event in order history
        await supabase.from('order_history').insert({
            order_id: reference,
            action: 'payment_status_changed',
            notes: notes,
            added_by: null
        });

        // If payment successful, you might want to:
        // 1. Send confirmation email
        // 2. Update order status to 'confirmed'
        // 3. Trigger fulfillment process
        if (status === 'success') {
            // Decrement stock once, at the paid transition. The atomic UPDATE
            // above guarantees we only reach here once per (invoice, status);
            // the payment_status guard avoids re-deducting if a prior 'success'
            // was already applied. Awaited inside try/catch so a stock error
            // can never break payment confirmation.
            if (existingOrder.payment_status !== 'paid') {
                try { await deductInventory(supabase, existingOrder.items); }
                catch (e) { console.error('deductInventory failed (payment still confirmed):', e); }
            }

            // Optional: Auto-confirm order
            const { data: order } = await supabase
                .from('orders')
                .select('order_status')
                .eq('id', reference)
                .single();

            if (order && order.order_status === 'new') {
                await supabase
                    .from('orders')
                    .update({ order_status: 'confirmed' })
                    .eq('id', reference);

                await supabase.from('order_history').insert({
                    order_id: reference,
                    action: 'status_changed',
                    notes: 'Статус автоматично змінено на "Підтверджено" після оплати',
                    added_by: null
                });
            }

            // Payment-received email (full payment or split prepayment).
            // Fire-and-forget on the first transition to paid so a Brevo
            // hiccup never makes Monobank retry the payment webhook. Goes
            // through the transactional route, which renders OrderPaidEmail
            // and picks the variant from the order's payment_type.
            if (existingOrder.payment_status !== 'paid') {
                const baseUrl = getRuntimeBaseUrl();
                fetch(`${baseUrl}/api/email/transactional`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-cron-secret': process.env.CRON_SECRET || '',
                    },
                    body: JSON.stringify({ action: 'paid', orderId: reference }),
                }).catch(err => {
                    console.error('payment-received email trigger failed:', err);
                });
            }

            // Fiscalisation (Checkbox). On the first transition to paid, fire a
            // receipt from the cash register of the ФОП that received the money
            // (resolved by payment_region inside /api/fiscalize). Fire-and-forget
            // + idempotent (skips if fiscal_id already set), so Checkbox latency
            // or errors never make Monobank retry the payment webhook.
            if (existingOrder.payment_status !== 'paid') {
                const baseUrl = getRuntimeBaseUrl();
                fetch(`${baseUrl}/api/fiscalize`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-cron-secret': process.env.CRON_SECRET || '',
                    },
                    body: JSON.stringify({ orderId: reference }),
                }).catch(err => {
                    console.error('fiscalize trigger failed:', err);
                });
            }

            // Designer service handoff. If the customer paid for an order
            // with with_designer=true, this is the moment to:
            //  - create the design_brief row (so the customer's brief link
            //    works on first click)
            //  - email the customer the brief link
            //  - ping the designer's Telegram chat
            // The actual work lives in /api/designer-service/on-payment so
            // both this webhook and any manual "mark as paid" admin action
            // can call into the same code path. We fire-and-forget here so
            // a Brevo / Telegram hiccup never makes Monobank retry the
            // payment webhook. The downstream route is idempotent (it
            // checks for an existing brief before insert), so retries are
            // safe if we ever do wire one up.
            if (existingOrder.with_designer && existingOrder.payment_status !== 'paid') {
                const baseUrl = getRuntimeBaseUrl();
                fetch(`${baseUrl}/api/designer-service/on-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: reference }),
                }).catch(err => {
                    console.error('designer-service/on-payment trigger failed:', err);
                });
            }

            // Gift certificates: auto-issue + email the recipient on the first
            // transition to paid. Same fire-and-forget pattern as the designer
            // handoff — a Brevo hiccup must never make Monobank retry the
            // payment webhook. The downstream route re-checks payment status
            // and is idempotent (keyed on the certificate code), so retries and
            // a parallel manual "mark as paid" are safe.
            const orderItems: any[] = Array.isArray(existingOrder.items) ? existingOrder.items : [];
            const hasCertificate = orderItems.some(
                (it) => it?.metadata?.certificateType || it?.options?.['Номер']
            );
            if (hasCertificate && existingOrder.payment_status !== 'paid') {
                const baseUrl = getRuntimeBaseUrl();
                fetch(`${baseUrl}/api/certificates/on-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: reference }),
                }).catch(err => {
                    console.error('certificates/on-payment trigger failed:', err);
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Webhook processed'
        });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET method for webhook verification (Monobank might ping your webhook URL)
export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'Monobank webhook endpoint is active'
    });
}
