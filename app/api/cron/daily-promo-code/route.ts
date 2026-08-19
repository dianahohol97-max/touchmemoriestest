import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';

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
 * the twentieth of August carry SITE2008. Each morning the code is emailed to
 * Diana together with what the campaign has brought in so far — she sends the
 * fifty letters herself, so it has to reach her inbox rather than the work chat
 * (Diana, 2026-08-19: «хай це приходить не в чат а мені на пошту»).
 *
 * Idempotent: running twice on the same day re-uses the existing row.
 */

const PREFIX = 'SITE';
const PERCENT = 10;
const LIVE_DAYS = 7;
/** Where the morning code goes. Diana's own address, given 2026-08-19. */
const REPORT_TO = 'gogolka16@gmail.com';

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
        // Resold Fujifilm goods carry a thin margin and are excluded from the
        // campaign discount (Diana, 2026-08-19). Looked up by slug rather than
        // pinned by id so a re-created product keeps the exclusion.
        const { data: excluded } = await admin
            .from('products')
            .select('id')
            .in('slug', ['instax-mini-12', 'instax-mini-cartridge']);
        const excludedIds = (excluded || []).map(p => p.id);
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
            excluded_product_ids: excludedIds,
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
        `Код дня для розсилки: ${code}`,
        `Діє до ${until}, знижка ${PERCENT}%, один раз на клієнта.`,
        orders
            ? `За всю розсилку замовлень по кодах: ${orders}, із них від старих клієнтів ${fromOldBase}, на суму ${revenue} грн.`
            : 'Замовлень по кодах розсилки поки немає.',
    ].join('\n');

    const html = `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2937;line-height:1.6">
          <p style="margin:0 0 18px">Доброго ранку! Ось код для сьогоднішніх листів.</p>
          <p style="margin:0 0 18px;text-align:center">
            <span style="display:inline-block;padding:14px 28px;border-radius:12px;background:#1e2d7d;color:#fff;font-size:26px;font-weight:800;letter-spacing:2px">${code}</span>
          </p>
          <p style="margin:0 0 18px">Знижка ${PERCENT} відсотків, діє до ${until}, спрацьовує один раз на клієнта.</p>
          <p style="margin:0 0 8px"><strong>Що вже принесла розсилка</strong></p>
          <p style="margin:0 0 18px">${
              orders
                  ? `Замовлень по кодах розсилки ${orders}, із них від старих клієнтів ${fromOldBase}, на загальну суму ${revenue} грн.`
                  : 'Замовлень по кодах розсилки поки немає — це нормально в перші дні.'
          }</p>
          <p style="margin:0;color:#6b7280;font-size:13px">Лист сформовано автоматично щоранку о девʼятій.</p>
        </div>`;

    let emailed = false;
    if (!preview) {
        try {
            // Marketing budget on purpose: this is campaign admin, and it must
            // never eat into the reserve that carries order confirmations.
            await sendBrevoEmail({
                to: REPORT_TO,
                subject: `Код дня ${code} — розсилка про запуск сайту`,
                html,
                kind: 'marketing',
            });
            emailed = true;
        } catch (e) {
            console.error('[daily-promo-code] email failed:', e);
        }
    }

    return NextResponse.json({ ok: true, code, created, orders, fromOldBase, revenue, emailed, text });
}
