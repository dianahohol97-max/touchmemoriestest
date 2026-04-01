import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CheckboxService } from '@/lib/checkbox';
import crypto from 'crypto';

import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Verify Monobank Signature
 */
async function verifySignature(pubKeyBase64: string, signatureBase64: string, body: string): Promise<boolean> {
    try {
        const pubKey = crypto.createPublicKey({
            key: Buffer.from(pubKeyBase64, 'base64'),
            format: 'der',
            type: 'spki',
        });

        const verify = crypto.createVerify('sha256');
        verify.update(body);
        verify.end();

        return verify.verify(pubKey, Buffer.from(signatureBase64, 'base64'));
    } catch (err) {
        console.error('Signature verification error:', err);
        return false;
    }
}

export async function POST(req: Request) {
    const supabase = getAdminClient();
    try {
        const signature = req.headers.get('x-sign');
        const bodyText = await req.text();
        const data = JSON.parse(bodyText);

        if (!signature) {
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
        }

        // 1. Get Monobank Public Key (Cache this in production)
        const pubKeyResponse = await fetch('https://api.monobank.ua/api/merchant/pubkey', {
            headers: { 'X-Token': process.env.MONOBANK_API_TOKEN! }
        });
        const { key: pubKey } = await pubKeyResponse.json();

        // 2. Verify Signature
        const isValid = await verifySignature(pubKey, signature, bodyText);
        if (!isValid) {
            console.error('Invalid Monobank signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        const { invoiceId, status, reference } = data;

        // 3. Process Success
        if (status === 'success') {
            // a. Update Order Status
            const { data: order, error: updateError } = await supabase
                .from('orders')
                .update({
                    payment_status: 'paid',
                    order_status: 'confirmed',
                    paid_at: new Date().toISOString(),
                    confirmed_at: new Date().toISOString()
                })
                .eq('id', reference)
                .select()
                .single();

            if (updateError) throw updateError;

            // a.1 Reserve Stock for Non-Personalized Items
            try {
                await supabase.rpc('reserve_order_stock', { p_order_id: reference });
            } catch (rpcErr) {
                console.error('Failed to reserve stock for order', reference, rpcErr);
            }

            // a.2 Process Referral Reward
            if (order.referral_code_id) {
                try {
                    await supabase.rpc('process_referral_reward', {
                        p_referral_code_id: order.referral_code_id,
                        p_amount: 100
                    });
                } catch (refErr) {
                    console.error('Failed to process referral reward', reference, refErr);
                }
            }

            // b. Trigger Checkbox Fiscalization (reads rules & account from DB)
            try {
                const { data: rule } = await supabase
                    .from('fiscal_rules')
                    .select('is_enabled, receipt_type, fiscal_account_id')
                    .eq('payment_type', 'full')
                    .single();

                if (rule?.is_enabled && rule?.fiscal_account_id) {
                    const { data: account } = await supabase
                        .from('fiscal_accounts')
                        .select('login, password, api_key, is_active')
                        .eq('id', rule.fiscal_account_id)
                        .single();

                    if (account?.is_active && account?.login) {
                        const checkbox = new CheckboxService({
                            login: account.login,
                            password: account.password || undefined,
                            licenseKey: account.api_key || process.env.CHECKBOX_LICENSE_KEY!
                        });

                        const receiptType = rule.receipt_type === 'return' ? 'return'
                            : rule.receipt_type === 'prepayment' ? 'prepayment'
                            : 'sell';

                        const receipt = await checkbox.createReceipt(order, receiptType);

                        await supabase
                            .from('orders')
                            .update({
                                fiscal_id: receipt.id,
                                fiscal_url: receipt.tax_url,
                                fiscal_status: 'created'
                            })
                            .eq('id', order.id);

                        console.log('[Fiscal] Receipt created:', receipt.id);
                    } else {
                        console.log('[Fiscal] Skipped — account inactive or missing');
                    }
                } else {
                    console.log('[Fiscal] Skipped — rule disabled or no account assigned');
                }
            } catch (fiscalError) {
                console.error('[Fiscal] Fiscalization failed:', fiscalError);
                // Mark as failed in DB so it can be retried manually
                await supabase.from('orders').update({ fiscal_status: 'failed' }).eq('id', order.id);
            }

            // c. TODO: Send Confirmation Email/Telegram
        } else if (status === 'failure' || status === 'expired') {
            await supabase
                .from('orders')
                .update({ payment_status: 'failed' })
                .eq('id', reference);
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
