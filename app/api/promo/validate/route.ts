import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const supabase = getAdminClient();
    try {
        const { code, customer_id, cart_total, items } = await request.json();

        if (!code) {
            return NextResponse.json({ valid: false, message: 'Промокод не передано' }, { status: 400 });
        }

        // 1. Fetch Promo Code
        const { data: promo, error: promoErr } = await supabase
            .from('promo_codes')
            .select('*')
            .ilike('code', code)
            .single();

        if (promoErr || !promo) {
            // Fallback: Check Referral Code
            const { data: refCode, error: refErr } = await supabase
                .from('referral_codes')
                .select('*')
                .ilike('code', code)
                .single();

            if (refErr || !refCode) {
                return NextResponse.json({ valid: false, message: 'Промокод або реферальний код не знайдено' }, { status: 404 });
            }

            // Valid Referral Code: 10% discount
            const discount_amount = Math.round((cart_total * 0.10) * 100) / 100;

            return NextResponse.json({
                valid: true,
                type: 'percent',
                value: 10,
                discount_amount: discount_amount,
                message: `Знижка -${discount_amount} грн (Реферальний код) ✓`,
                promo_id: null,
                referral_code_id: refCode.id
            });
        }

        // 2. Validate Active
        if (!promo.is_active) {
            return NextResponse.json({ valid: false, message: 'Промокод недійсний' }, { status: 400 });
        }

        // 3. Validate Dates
        const now = new Date();
        if (promo.valid_until && new Date(promo.valid_until) < now) {
            return NextResponse.json({ valid: false, message: 'Промокод прострочений' }, { status: 400 });
        }
        if (promo.valid_from && new Date(promo.valid_from) > now) {
            return NextResponse.json({ valid: false, message: 'Промокод ще не діє' }, { status: 400 });
        }

        // 4. Validate Total Uses Limit
        if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
            return NextResponse.json({ valid: false, message: 'Ліміт використань вичерпано' }, { status: 400 });
        }

        // 5. Validate Min Order Amount
        if (promo.min_order_amount && cart_total < promo.min_order_amount) {
            return NextResponse.json({
                valid: false,
                message: `Мінімальна сума замовлення ${promo.min_order_amount} грн`
            }, { status: 400 });
        }

        // 6. Validate Single Use per Customer (if applicable and customer_id is provided)
        if (promo.is_single_use_per_customer && customer_id) {
            const { data: usages, error: usagesErr } = await supabase
                .from('promo_code_usages')
                .select('id')
                .eq('promo_code_id', promo.id)
                .eq('customer_id', customer_id);

            if (usages && usages.length > 0) {
                return NextResponse.json({ valid: false, message: 'Промокод вже використано' }, { status: 400 });
            }
        }

        // 7. Calculate Discount Amount
        // TODO: Advanced applies_to logic evaluating `items` against specific categories could go here.
        // For now, assuming applies_to === 'all' or bypassing complex category validations for speed.

        let discount_amount = 0;
        if (promo.type === 'percent') {
            discount_amount = Math.round((cart_total * (promo.value / 100)) * 100) / 100;
        } else if (promo.type === 'fixed') {
            discount_amount = promo.value;
            if (discount_amount > cart_total) {
                discount_amount = cart_total; // Can't discount more than the cart value
            }
        }

        // Ensure discount is positive
        if (discount_amount < 0) discount_amount = 0;

        return NextResponse.json({
            valid: true,
            type: promo.type,
            value: promo.value,
            discount_amount: discount_amount,
            message: `Знижка -${discount_amount} грн застосована ✓`,
            promo_id: promo.id // Return ID so client can submit it when finalizing order
        });

    } catch (err: any) {
        console.error('Validate Promo Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
