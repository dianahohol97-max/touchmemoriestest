import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/supabase/like-escape';
import { findBinding, isSelfReferral } from '@/lib/agency/binding';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[A-Za-z0-9А-ЯІЇЄҐа-яіїєґ]{4,16}$/;

/**
 * POST /api/referral/attach-order  { orderId, refCode? }
 *
 * Партнерська атрибуція і знижка для замовлень, які створюються НЕ через
 * /api/orders/submit.
 *
 * НАВІЩО ЦЕ ІСНУЄ. Замовлень із сайту два потоки, і це виявилося аж на
 * продакшні (TM-001325, 16.09.2026). Звичайний іде кошиком на /checkout і далі
 * в /api/orders/submit, де партнер визначається і записується. Потік «з
 * дизайнером» (app/[locale]/order/page.tsx) вставляє замовлення ПРЯМО З
 * БРАУЗЕРА і submit не бачить узагалі — а це половина замовлень із сайту: за
 * серпень і вересень 48 зі 92. Уся партнерська механіка для них просто не
 * існувала: перехід записувався, код лежав у localStorage, а замовлення
 * приходило без знижки й без атрибуції.
 *
 * ЧОМУ РОУТ, А НЕ КОД У СТОРІНЦІ. Знижку не можна довіряти браузеру. Сторінка
 * каже лише «у мене є такий код», а хто партнер, чи діє знижка і скільки саме
 * вона становить — вирішує сервер. Він же й переписує суму замовлення, тому
 * рахунок Монобанку, який створюється наступним кроком і читає суму з рядка
 * замовлення, приходить уже правильний.
 *
 * ВИКЛИКАЄТЬСЯ ЗАВЖДИ, навіть без коду: привʼязаний клієнт партнера коду не
 * має й мати не повинен — його визначає пошта. Саме так працює довічна
 * комісія на повторних замовленнях.
 *
 * Ідемпотентний: замовлення з уже проставленою атрибуцією не чіпається, тож
 * повторний виклик (клієнт натиснув «Оплатити» вдруге) нічого не подвоїть.
 */
export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || '');
    if (!UUID_RE.test(orderId)) {
        return NextResponse.json({ ok: false, reason: 'bad_order' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: order } = await admin
        .from('orders')
        .select('id, customer_email, payment_status, subtotal, total, referral_partner_id')
        .eq('id', orderId)
        .maybeSingle();
    if (!order) return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 });

    // Оплачене замовлення не переписуємо: сума вже списана, і міняти її заднім
    // числом означало б розійтися з тим, що людина реально заплатила.
    if (order.payment_status === 'paid') {
        return NextResponse.json({ ok: true, attributed: false, reason: 'already_paid' });
    }
    if (order.referral_partner_id) {
        return NextResponse.json({ ok: true, attributed: true, reason: 'already_attributed' });
    }

    const buyerEmail = String(order.customer_email || '').trim().toLowerCase();

    // 1. Довічна привʼязка переважає завжди — і саме вона дає комісію на
    //    повторних замовленнях, де жодного коду немає.
    let partner: any = null;
    let isFirstOrder = true;
    const binding = await findBinding(admin, buyerEmail);
    if (binding) {
        isFirstOrder = false;
        const { data } = await admin
            .from('agency_partners')
            .select('id, email, status, promo_code_id')
            .eq('id', binding.partner_id)
            .maybeSingle();
        partner = data;
    } else {
        const refCode = String(body?.refCode || '').trim().toUpperCase();
        if (refCode && CODE_RE.test(refCode)) {
            const { data } = await admin
                .from('agency_partners')
                .select('id, email, status, promo_code_id')
                .ilike('referral_code', likeEscape(refCode))
                .maybeSingle();
            partner = data;
        }
    }

    if (!partner || partner.status !== 'active') {
        return NextResponse.json({ ok: true, attributed: false, reason: 'no_partner' });
    }
    // Самореферал не дає ні комісії, ні привʼязки, ні знижки — та сама межа,
    // що й у решті ланцюжка.
    if (isSelfReferral(buyerEmail, partner.email)) {
        return NextResponse.json({ ok: true, attributed: false, reason: 'self_referral' });
    }

    const patch: Record<string, any> = { referral_partner_id: partner.id };

    /**
     * Знижка — тільки на перше замовлення, як і скрізь у цій моделі. Відсоток
     * береться з промокоду партнера, а не з константи: у партнера можуть бути
     * власні умови, і саме той рядок бачить чекаут.
     *
     * subtotal лишається повною сумою, зменшується total. Так знижка читається
     * як різниця між ними — тим самим способом, яким її показує картка
     * замовлення в адмінці, — і комісія партнера рахується від повної суми, як
     * і вимагає правило.
     */
    let discount = 0;
    if (isFirstOrder && partner.promo_code_id) {
        const { data: promo } = await admin
            .from('promo_codes')
            .select('type, value, is_active')
            .eq('id', partner.promo_code_id)
            .maybeSingle();
        const subtotal = Number(order.subtotal) || 0;
        if (promo?.is_active && promo.type === 'percent' && subtotal > 0) {
            const pct = Number(promo.value) || 0;
            discount = Math.round(subtotal * pct) / 100;
            if (discount > 0) patch.total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
        }
    }

    const { error } = await admin.from('orders').update(patch).eq('id', orderId);
    if (error) {
        console.error('[referral-attach] update failed:', error.message);
        return NextResponse.json({ ok: false, reason: 'update_failed' }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        attributed: true,
        discount,
        total: patch.total ?? (Number(order.total) || 0),
        first_order: isFirstOrder,
    });
}
