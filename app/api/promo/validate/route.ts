import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Validate a promo (or referral) code before checkout.
 *
 * Single-use enforcement works for BOTH logged-in customers and guests:
 *  - logged-in: dedupe by customer_id
 *  - guest:     dedupe by lower(email)
 * Usage is recorded later, at order creation (orders/submit), into
 * promo_code_usages. This route only *checks* prior usage.
 *
 * Email binding (requires_email_match = true, for personal newsletter codes):
 *  - the buyer's email must appear in subscribers.promo_code matching this
 *    exact code — i.e. this person actually RECEIVED the code.
 */
export async function POST(request: Request) {
    const supabase = getAdminClient();
    try {
        const { code, customer_id, cart_total, items, email: rawEmail } = await request.json();
        const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : null;

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
            // Fallback: Check Referral Code (separate flat-10% codes table)
            const { data: refCode, error: refErr } = await supabase
                .from('referral_codes')
                .select('*')
                .ilike('code', code)
                .single();

            if (refErr || !refCode) {
                return NextResponse.json({ valid: false, message: 'Промокод або реферальний код не знайдено' }, { status: 404 });
            }

            const discount_amount = Math.round((cart_total * 0.10) * 100) / 100;
            return NextResponse.json({
                valid: true,
                type: 'percent',
                value: 10,
                discount_amount,
                message: `Знижка -${discount_amount} грн (Реферальний код)`,
                promo_id: null,
                referral_code_id: refCode.id,
            });
        }

        // 2. Active
        if (!promo.is_active) {
            return NextResponse.json({ valid: false, message: 'Промокод недійсний' }, { status: 400 });
        }

        // 3. Dates
        const now = new Date();
        if (promo.valid_until && new Date(promo.valid_until) < now) {
            return NextResponse.json({ valid: false, message: 'Промокод прострочений' }, { status: 400 });
        }
        if (promo.valid_from && new Date(promo.valid_from) > now) {
            return NextResponse.json({ valid: false, message: 'Промокод ще не діє' }, { status: 400 });
        }

        // 4. Total uses limit
        if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
            return NextResponse.json({ valid: false, message: 'Ліміт використань вичерпано' }, { status: 400 });
        }

        // 5. Min order amount
        if (promo.min_order_amount && cart_total < promo.min_order_amount) {
            return NextResponse.json({
                valid: false,
                message: `Мінімальна сума замовлення ${promo.min_order_amount} грн`,
            }, { status: 400 });
        }

        // 6. EMAIL BINDING — personal newsletter codes must go to the person who
        //    received them. Verify the buyer's email actually got this code.
        if (promo.requires_email_match) {
            if (!email) {
                return NextResponse.json({
                    valid: false,
                    message: 'Цей промокод персональний. Вкажіть email, на який він був надісланий.',
                }, { status: 400 });
            }
            const { data: subRows } = await supabase
                .from('subscribers')
                .select('id')
                .ilike('email', email)
                .ilike('promo_code', promo.code)
                .limit(1);
            if (!subRows || subRows.length === 0) {
                return NextResponse.json({
                    valid: false,
                    message: 'Цей промокод не надсилався на вказаний email',
                }, { status: 400 });
            }
        }

        // 7. SINGLE-USE — check prior usage by customer_id OR email. Works for
        //    guests too (email), closing the loophole where unauthenticated
        //    users could reuse a code indefinitely.
        if (promo.is_single_use_per_customer || promo.requires_email_match) {
            const orFilters: string[] = [];
            if (customer_id) orFilters.push(`customer_id.eq.${customer_id}`);
            if (email) orFilters.push(`email.eq.${email}`);

            if (orFilters.length > 0) {
                const { data: usages } = await supabase
                    .from('promo_code_usages')
                    .select('id')
                    .eq('promo_code_id', promo.id)
                    .or(orFilters.join(','))
                    .limit(1);
                if (usages && usages.length > 0) {
                    return NextResponse.json({ valid: false, message: 'Промокод вже використано' }, { status: 400 });
                }
            } else {
                // No way to identify the user → can't guarantee single use.
                return NextResponse.json({
                    valid: false,
                    message: 'Увійдіть або вкажіть email, щоб застосувати цей промокод',
                }, { status: 400 });
            }
        }

        // 8. applies_to scope
        if (promo.applies_to === 'products' && Array.isArray(promo.applicable_product_ids) && promo.applicable_product_ids.length > 0) {
            const cartProductIds = (items || []).map((i: any) => i.product_id).filter(Boolean);
            const hasMatch = cartProductIds.some((pid: string) => promo.applicable_product_ids.includes(pid));
            if (!hasMatch) {
                return NextResponse.json({ valid: false, message: 'Промокод не діє на товари у кошику' }, { status: 400 });
            }
        }
        if (promo.applies_to === 'categories' && Array.isArray(promo.applicable_category_ids) && promo.applicable_category_ids.length > 0) {
            const productIds = (items || []).map((i: any) => i.product_id).filter(Boolean);
            if (productIds.length === 0) {
                return NextResponse.json({ valid: false, message: 'Немає товарів у кошику' }, { status: 400 });
            }
            const { data: prods } = await supabase
                .from('products')
                .select('id, category_id')
                .in('id', productIds);
            const cartCategoryIds = (prods || []).map((p: any) => p.category_id).filter(Boolean);
            const hasMatch = cartCategoryIds.some((cid: string) => promo.applicable_category_ids.includes(cid));
            if (!hasMatch) {
                return NextResponse.json({ valid: false, message: 'Промокод не діє на категорії у кошику' }, { status: 400 });
            }
        }

        // 9. Discount amount
        let discount_amount = 0;
        if (promo.type === 'percent') {
            discount_amount = Math.round((cart_total * (promo.value / 100)) * 100) / 100;
        } else if (promo.type === 'fixed') {
            discount_amount = promo.value;
            if (discount_amount > cart_total) discount_amount = cart_total;
        }
        if (discount_amount < 0) discount_amount = 0;

        return NextResponse.json({
            valid: true,
            type: promo.type,
            value: promo.value,
            discount_amount,
            message: `Знижка -${discount_amount} грн застосована`,
            promo_id: promo.id,
            code: promo.code,
        });

    } catch (err: any) {
        console.error('Validate Promo Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
