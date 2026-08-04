import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireStaff, requireAdmin } from '@/lib/auth/guards';
import { processAgencyCommission } from '@/lib/agency/commission';
import { processReferralReward } from '@/lib/referral/referral';

// Column allowlist for PATCH. Previously the raw request body went straight
// into .update(body) under a requireStaff guard, so ANY active staff member
// (designer, marketer, production) could rewrite ANY column — including
// payment_status='paid' and total=0. Now: operational fields are staff-
// editable, financial fields require a real admin, everything else is
// rejected outright (Monobank/fiscal/system columns are written only by
// their own server flows, never by hand through this route).
const STAFF_EDITABLE_FIELDS = new Set([
    'order_status', 'production_status', 'tracking_status',
    'notes', 'client_comment', 'designer_note',
    'with_designer', 'designer_id', 'manager_id', 'assigned_at',
    'ttn', 'tracking_carrier', 'tracking_url',
    'deadline', 'priority_score', 'tags', 'source', 'custom_attributes',
    'delivery_method', 'delivery_address',
    'customer_name', 'customer_phone', 'customer_email', 'customer_telegram',
    'customer_instagram', 'customer_first_name', 'customer_last_name', 'customer_birthday',
    'text_brief', 'print_profile_id',
    'confirmed_at', 'production_at', 'shipped_at', 'delivered_at',
    'updated_at',
]);

const ADMIN_ONLY_FIELDS = new Set([
    'payment_status', 'paid_at', 'payment_type',
    'total', 'subtotal', 'delivery_cost',
    'discount_amount', 'discount_type', 'discount_value',
    'prepaid_amount', 'cod_amount', 'pickup_unpaid_balance',
    'used_bonus', 'promo_code',
    'certificate_code', 'certificate_applied', 'certificate_redeemed',
    'designer_service_fee', 'customer_id',
    'bank_account_id', 'np_account_id',
]);

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    const { id } = await params;

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            customers(id, name, email, phone, telegram, instagram),
            manager:staff!orders_manager_id_fkey(id, name, initials, color),
            designer:staff!orders_designer_id_fkey(id, name, initials, color),
            creator:staff!orders_created_by_fkey(id, name, initials, color),
            order_tag_assignments(order_tags(*))
        `)
        .eq('id', id)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ order: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    const { id } = await params;
    const body = await req.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    // Keep order assignment in sync with the designer cabinet: it only lists
    // orders where with_designer = true AND designer_id = me. So whenever a
    // designer is set (here this covers a designer claiming a free order, or a
    // manager assigning one), ensure with_designer is true too. Not cleared on
    // un-assign.
    if (body.designer_id && body.with_designer === undefined) {
        body.with_designer = true;
    }

    const keys = Object.keys(body);
    const unknown = keys.filter(k => !STAFF_EDITABLE_FIELDS.has(k) && !ADMIN_ONLY_FIELDS.has(k));
    if (unknown.length > 0) {
        return NextResponse.json(
            { error: `Fields not editable via this endpoint: ${unknown.join(', ')}` },
            { status: 400 },
        );
    }

    const financial = keys.filter(k => ADMIN_ONLY_FIELDS.has(k));
    if (financial.length > 0) {
        const adminGuard = await requireAdmin();
        if (!adminGuard.ok) {
            return NextResponse.json(
                { error: `Only an admin can edit: ${financial.join(', ')}` },
                { status: 403 },
            );
        }
    }

    // Remember whether this PATCH is the order's FIRST transition to paid or to
    // cancelled — both need the pre-update state, so read it before writing.
    let becamePaid = false;
    let becameCancelled = false;
    if (body.payment_status === 'paid' || body.order_status === 'cancelled') {
        const { data: before } = await supabase
            .from('orders')
            .select('payment_status, order_status')
            .eq('id', id)
            .maybeSingle();
        becamePaid = body.payment_status === 'paid' && !!before && before.payment_status !== 'paid';
        becameCancelled = body.order_status === 'cancelled' && !!before && before.order_status !== 'cancelled';
    }

    const { data, error } = await supabase
        .from('orders')
        .update(body)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Paid-transition side effects. Every other way an order becomes paid —
    // the Monobank webhook, «Позначити оплаченим», check-payment, admin
    // create — runs these two; editing payment_status through this generic
    // endpoint was the one path that did not. An admin flipping the field in
    // the order editor therefore silently cost the agency its commission and
    // the referrer their bonus. Both processors are idempotent, so a repeat
    // transition is harmless.
    if (becamePaid) {
        try {
            await processAgencyCommission(supabase, {
                orderId: id,
                promoCode: (data as any)?.promo_code || null,
                items: Array.isArray((data as any)?.items) ? (data as any).items : [],
            });
        } catch (e) { console.error('[order-patch] agency commission failed (order still updated):', e); }
        try {
            await processReferralReward(supabase, {
                orderId: id,
                customerId: (data as any)?.customer_id || null,
                orderTotal: Number((data as any)?.total) || 0,
            });
        } catch (e) { console.error('[order-patch] referral reward failed (order still updated):', e); }
    }

    // Bonus refund on cancellation. Bonuses are debited at SUBMIT — before any
    // payment — so an order that was never paid and got cancelled permanently
    // ate the customer's bonuses: no code anywhere returned them. Refund
    // used_bonus on the first transition to cancelled, idempotently: the
    // bonus_transactions ledger is the guard, so re-cancelling (or a retried
    // request) can never credit twice.
    if (becameCancelled) {
        try {
            const usedBonus = Number((data as any)?.used_bonus) || 0;
            const custId = (data as any)?.customer_id || null;
            if (usedBonus > 0 && custId) {
                const { data: already } = await supabase
                    .from('bonus_transactions')
                    .select('id')
                    .eq('order_id', id)
                    .eq('kind', 'order_cancel_refund')
                    .limit(1);
                if (!already || already.length === 0) {
                    // Same compare-and-swap pattern as the debit in orders/submit,
                    // so a concurrent balance change can't be overwritten.
                    for (let attempt = 0; attempt < 3; attempt++) {
                        const { data: fresh } = await supabase
                            .from('customers')
                            .select('bonus_balance')
                            .eq('id', custId)
                            .maybeSingle();
                        const live = Number(fresh?.bonus_balance || 0);
                        const { data: updated } = await supabase
                            .from('customers')
                            .update({ bonus_balance: live + usedBonus })
                            .eq('id', custId)
                            .eq('bonus_balance', live)
                            .select('id');
                        if (updated && updated.length > 0) {
                            await supabase.from('bonus_transactions').insert({
                                customer_id: custId,
                                amount: usedBonus,
                                kind: 'order_cancel_refund',
                                order_id: id,
                                note: `Повернення бонусів за скасоване замовлення ${(data as any)?.order_number || id}`,
                            });
                            break;
                        }
                    }
                }
            }
        } catch (e) { console.error('[order-patch] bonus refund failed (order still updated):', e); }
    }

    return NextResponse.json({ order: data });
}
