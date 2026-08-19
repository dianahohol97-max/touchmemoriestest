import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendWorkChatAlert } from '@/lib/chatbot/telegram-business';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * A fresh promo code every morning for the CRM-base mailing.
 *
 * Diana, 2026-08-19: «я щодня відправлятиму по 50 листів, тому промокод щодня
 * має змінюватися, щоб працювати всього сім днів».
 *
 * One shared code cannot do that. The mailing is a slow drip — fifty letters a
 * day against a base of ~5400 — so a single seven-day code would already be
 * dead for everyone written to after the first week. A code per SEND DAY gives
 * every recipient the same honest seven days counted from the letter they
 * actually received, and as a side effect it says which day's batch converted.
 *
 * The code is the date, so nobody has to look it up: the letters going out on
 * the twentieth of August carry SITE2008. The cron posts it to the work chat
 * each morning together with what the previous days have brought in.
 *
 * Idempotent: running twice on the same day re-uses the existing row.
 */

const PREFIX = 'SITE';
const PERCENT = 10;
const LIVE_DAYS = 7;

/** Kyiv is UTC+3 in summer; the code must be named for the local send day. */
function kyivToday(): Date {
    return new Date(Date.now() + 3 * 60 * 60 * 1000);
}

function codeForDay(d: Date): string {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${PREFIX}${dd}${mm}`;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const preview = new URL(request.url).searchParams.get('preview') === '1';
    if (!preview && (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();
    const today = kyivToday();
    const code = codeForDay(today);

    const { data: existing } = await admin
        .from('promo_codes')
        .select('id, code, valid_until')
        .eq('code', code)
        .maybeSingle();

    let created = false;
    if (!existing) {
        const validUntil = new Date(Date.now() + LIVE_DAYS * 24 * 60 * 60 * 1000);
        const { error } = await admin.from('promo_codes').insert({
            code,
            type: 'percent',
            value: PERCENT,
            min_order_amount: 0,
            applies_to: 'all',
            max_uses: null,
            // One per customer: this is what makes the count of "old customers who
            // came back" a count of people rather than of orders.
            is_single_use_per_customer: true,
            valid_from: new Date().toISOString(),
            valid_until: validUntil.toISOString(),
            is_active: true,
            created_by: 'cron:daily-promo-code',
            notes: `Розсилка по базі KeyCRM: код дня ${code}, -${PERCENT}% на ${LIVE_DAYS} днів.`,
        });
        if (error) {
            console.error('[daily-promo-code] insert failed:', error.message);
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }
        created = true;
    }

    // What the campaign has brought so far, across every day's code.
    const { data: codes } = await admin
        .from('promo_codes')
        .select('id')
        .like('code', `${PREFIX}%`)
        .eq('created_by', 'cron:daily-promo-code');
    const ids = (codes || []).map(c => c.id);

    let orders = 0;
    let fromOldBase = 0;
    let revenue = 0;
    if (ids.length) {
        const { data: usages } = await admin
            .from('promo_code_usages')
            .select('email, order_id, discount_amount')
            .in('promo_code_id', ids);
        orders = (usages || []).length;

        const emails = (usages || []).map(u => String(u.email || '').toLowerCase()).filter(Boolean);
        if (emails.length) {
            const { data: known } = await admin
                .from('crm_imported_customers')
                .select('email')
                .in('email', emails);
            const knownSet = new Set((known || []).map(k => String(k.email).toLowerCase()));
            fromOldBase = emails.filter(e => knownSet.has(e)).length;
        }

        const orderIds = (usages || []).map(u => u.order_id).filter(Boolean);
        if (orderIds.length) {
            const { data: ord } = await admin.from('orders').select('total').in('id', orderIds);
            revenue = Math.round((ord || []).reduce((s, o) => s + (Number(o.total) || 0), 0));
        }
    }

    const until = new Date(Date.now() + LIVE_DAYS * 24 * 60 * 60 * 1000)
        .toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });

    const text = [
        `📮 Код дня для розсилки: ${code}`,
        `Діє до ${until}, знижка ${PERCENT}%, один раз на клієнта.`,
        '',
        orders
            ? `За всю розсилку замовлень по кодах: ${orders}, із них від старих клієнтів ${fromOldBase}, на суму ${revenue} грн.`
            : 'Замовлень по кодах розсилки поки немає.',
    ].join('\n');

    if (!preview) {
        await sendWorkChatAlert(text).catch(e => console.error('[daily-promo-code] alert failed:', e));
    }

    return NextResponse.json({ ok: true, code, created, orders, fromOldBase, revenue, text });
}
