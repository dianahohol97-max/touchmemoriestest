import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { likeEscape } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

// Per-IP rate limit, same shape as /api/orders/track. Prefix scanning a code
// space is only practical if guesses are free; 20/min leaves normal checkout
// (a manual entry plus the ?promo= auto-apply) far below the ceiling.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function overRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now >= entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT;
}

/**
 * Validate a promo (or referral) code before checkout.
 *
 * Single-use enforcement works for BOTH logged-in customers and guests:
 *  - logged-in: dedupe by customer_id, resolved from the SESSION here
 *  - guest:     dedupe by lower(email)
 *
 * The customer is read from the session cookie, never from the request body.
 * The body value used to be trusted, which was both a hole (any UUID that owns
 * no usage rows satisfies the single-use check, so passing a random one
 * bypassed it) and, in practice, the reason partner referral LINKS never
 * applied their discount: the checkout page does not send customer_id at all,
 * so every partner code — they all carry is_single_use_per_customer — fell
 * into the "cannot identify the buyer" branch below and was rejected.
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
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        if (overRateLimit(ip)) {
            return NextResponse.json(
                { valid: false, message: 'Забагато запитів. Спробуйте пізніше.' },
                { status: 429 },
            );
        }

        const { code, cart_total, items, email: rawEmail } = await request.json();
        const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : null;

        // Who is asking, according to their session cookie. A logged-in buyer
        // is identified here even before they have typed anything into the
        // checkout form, which is what lets the ?ref= auto-apply succeed on
        // page load. Never fatal: an anonymous visitor simply gets nulls and
        // falls back to email-based dedupe.
        let sessionCustomerId: string | null = null;
        let sessionEmail: string | null = null;
        try {
            const userClient = await createClient();
            const { data: { user } } = await userClient.auth.getUser();
            if (user) {
                sessionEmail = user.email?.trim().toLowerCase() || null;
                const { data: customer } = await supabase
                    .from('customers')
                    .select('id')
                    .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
                    .maybeSingle();
                sessionCustomerId = customer?.id || null;
            }
        } catch (e) {
            console.warn('promo/validate: session lookup failed, treating caller as guest', e);
        }

        if (!code) {
            return NextResponse.json({ valid: false, message: 'Промокод не передано' }, { status: 400 });
        }

        // A promo code is compared for EQUALITY, so it must never reach the
        // database as a LIKE pattern. `.ilike('code', code)` let the caller
        // describe a SET of codes instead of naming one: ILIKE reads `_` as
        // "any one character" and `%` as "any run", so a request for
        // «_______» matched every 7-character code — and because exactly one
        // active code was 7 characters, `.single()` returned it, valid, with
        // its plaintext value in the response. Eight-character codes fell to a
        // prefix scan («А_______», «Б_______», …), with `.single()`'s
        // "multiple rows" error acting as the oracle telling the caller to
        // narrow. Real codes are alphanumeric (Latin or Cyrillic — partner
        // codes are generated from agency names, e.g. ПОДОTABB), so anything
        // carrying a wildcard is rejected outright, and the lookup below
        // escapes what remains.
        const rawCode = String(code).trim();
        if (!/^[A-Za-z0-9А-ЯІЇЄҐа-яіїєґ-]{3,32}$/u.test(rawCode)) {
            return NextResponse.json({ valid: false, message: 'Промокод не знайдено' }, { status: 404 });
        }

        // Sanitise the two values that get interpolated into a PostgREST `.or()`
        // filter string below (step 7). Without this a caller could inject extra
        // filter terms (e.g. customer_id="…,id.not.is.null") to skew the
        // single-use check. customer_id must be a plain UUID; email must not
        // carry the comma/paren metacharacters PostgREST parses.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const safeCustomerId = typeof sessionCustomerId === 'string' && UUID_RE.test(sessionCustomerId) ? sessionCustomerId : null;
        if (email && /[,()]/.test(email)) {
            return NextResponse.json({ valid: false, message: 'Невірний email' }, { status: 400 });
        }

        // 1. Fetch Promo Code
        // likeEscape turns the remaining metacharacters into literals, so the
        // match is a plain case-insensitive equality (codes are stored
        // uppercase; keeping ILIKE preserves the existing case-insensitive
        // behaviour for anything entered in lower case). maybeSingle, not
        // single: an ambiguous match must answer "not found" like any other
        // miss rather than erroring differently and leaking that fact.
        const { data: promo } = await supabase
            .from('promo_codes')
            .select('*')
            .ilike('code', likeEscape(rawCode))
            .maybeSingle();

        if (!promo) {
            // NOTE: the legacy referral_codes fallback (flat -10% on the whole
            // cart, no commission, no usage limits) was removed on Diana's
            // request — the table was empty and unused, but any row added to it
            // would have become a silent unlimited -10% code.
            return NextResponse.json({ valid: false, message: 'Промокод не знайдено' }, { status: 404 });
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
            // Both values are escaped: an unescaped email of «%» would match
            // ANY subscriber row and defeat the binding this check exists to
            // enforce, handing a personal code to whoever asked for it.
            const { data: subRows } = await supabase
                .from('subscribers')
                .select('id')
                .ilike('email', likeEscape(email))
                .ilike('promo_code', likeEscape(String(promo.code ?? '')))
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
            // A logged-in buyer's account email counts too, and it is known
            // before they type anything. Without it a returning customer whose
            // earlier order was placed as a guest (usage row carries the email
            // but no customer_id) would slip past the single-use check.
            if (sessionEmail && sessionEmail !== email && !/[,()]/.test(sessionEmail)) {
                orFilters.push(`email.eq.${sessionEmail}`);
            }

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

        // Excluded products drop out first, whatever the scope says. Diana,
        // 2026-08-19: the launch code must not touch the Fujifilm camera or its
        // cartridges — resold goods on a thin margin, unlike the print products
        // the shop makes itself. Handled here rather than by hiding the products,
        // so they stay on sale at full price during the campaign.
        const excludedIds = new Set<string>(
            Array.isArray((promo as any).excluded_product_ids) ? (promo as any).excluded_product_ids : [],
        );
        let scopedItems: any[] = items || [];
        if (excludedIds.size > 0) {
            scopedItems = scopedItems.filter((i: any) => !excludedIds.has(i.product_id));
            if (scopedItems.length === 0) {
                return NextResponse.json(
                    { valid: false, message: 'Промокод не діє на товари у кошику' },
                    { status: 400 },
                );
            }
            eligibleTotal = scopedItems.reduce(
                (s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0,
            );
        }

        if (promo.applies_to === 'products' && Array.isArray(promo.applicable_product_ids) && promo.applicable_product_ids.length > 0) {
            const eligibleSet = new Set(promo.applicable_product_ids);
            const eligibleItems = scopedItems.filter((i: any) => eligibleSet.has(i.product_id));
            if (eligibleItems.length === 0) {
                return NextResponse.json({ valid: false, message: 'Промокод не діє на товари у кошику' }, { status: 400 });
            }
            eligibleTotal = eligibleItems.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
        }

        if (promo.applies_to === 'categories' && Array.isArray(promo.applicable_category_ids) && promo.applicable_category_ids.length > 0) {
            const productIds = scopedItems.map((i: any) => i.product_id).filter(Boolean);
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
            const eligibleItems = scopedItems.filter((i: any) => eligibleSet.has(catById.get(i.product_id)));
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
            // `code` is deliberately NOT returned: the caller already knows the
            // code it sent, and echoing the stored value turned a lucky match
            // into a disclosure of the real code.
        });

    } catch (err: any) {
        console.error('Validate Promo Error:', err);
        return NextResponse.json({ error: 'Не вдалося перевірити промокод' }, { status: 500 });
    }
}
