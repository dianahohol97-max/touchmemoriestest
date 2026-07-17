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

        // Sanitise the two values that get interpolated into a PostgREST `.or()`
        // filter string below (step 7). Without this a caller could inject extra
        // filter terms (e.g. customer_id="…,id.not.is.null") to skew the
        // single-use check. customer_id must be a plain UUID; email must not
        // carry the comma/paren metacharacters PostgREST parses.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const safeCustomerId = typeof customer_id === 'string' && UUID_RE.test(customer_id) ? customer_id : null;
        if (email && /[,()]/.test(email)) {
            return NextResponse.json({ valid: false, message: 'Невірний email' }, { status: 400 });
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
            if (safeCustomerId) orFilters.push(`customer_id.eq.${safeCustomerId}`);
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

        // 8. applies_to scope — and compute the ELIGIBLE subtotal so the
        // discount only applies to qualifying items, not the whole cart. A
        // customer who adds a photobook (SUMMER7 applies) plus a magnet (it does
        // not) must get 7% off the photobook only.
        let eligibleTotal = cart_total; // 'all' → whole cart qualifies

        if (promo.applies_to === 'products' && Array.isArray(promo.applicable_product_ids) && promo.applicable_product_ids.length > 0) {
            const eligibleSet = new Set(promo.applicable_product_ids);
            const eligibleItems = (items || []).filter((i: any) => eligibleSet.has(i.product_id));
            if (eligibleItems.length === 0) {
                return NextResponse.json({ valid: false, message: 'Промокод не діє на товари у кошику' }, { status: 400 });
            }
            eligibleTotal = eligibleItems.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
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
            // product_id → category_id map, so we can pick only eligible items.
            const catById = new Map((prods || []).map((p: any) => [p.id, p.category_id]));
            const eligibleSet = new Set(promo.applicable_category_ids);
            const eligibleItems = (items || []).filter((i: any) => eligibleSet.has(catById.get(i.product_id)));
            if (eligibleItems.length === 0) {
                return NextResponse.json({ valid: false, message: 'Промокод не діє на категорії у кошику' }, { status: 400 });
            }
            eligibleTotal = eligibleItems.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
        }

        // 9. Discount amount — computed against the eligible subtotal.
        let discount_amount = 0;
        if (promo.type === 'percent') {
            discount_amount = Math.round((eligibleTotal * (promo.value / 100)) * 100) / 100;
        } else if (promo.type === 'fixed') {
            discount_amount = promo.value;
            if (discount_amount > eligibleTotal) discount_amount = eligibleTotal;
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
        return NextResponse.json({ error: 'Не вдалося перевірити промокод' }, { status: 500 });
    }
}
