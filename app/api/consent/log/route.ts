import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { buildConsentRows, readConsentEmail } from '@/lib/consent/log-entries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/consent/log — журнал згод.
 *
 * Маршрут смикають банер cookie, форма підписки у футері, реєстрація і попап.
 * До 14.09.2026 він не записав ЖОДНОГО рядка, і ніхто цього не бачив: вставка
 * падала, помилку ніхто не читав, а відповідь завжди була { ok: true }.
 *
 * Причин падіння було три, і колонка metadata — найменша з них. На таблиці
 * стоять два CHECK-обмеження, створені руками в дашборді Supabase: consent_type
 * приймає лише назви КАТЕГОРІЙ, а source — лише 'web' / 'mobile' / 'api' /
 * 'admin'. Код слав туди назви дій ('cookies_accepted') і власні джерела
 * ('cookie_banner'), плюс неіснуючу колонку metadata.
 *
 * Тепер один клік розкладається на рядки по категоріях (buildConsentRows),
 * source завжди 'web', metadata не передається взагалі, а результат вставки
 * ПЕРЕВІРЯЄТЬСЯ і повертається чесно. Викликачі шлють це вогонь-і-забудь, тож
 * 500 нікому не зламає екран, зате помилка видно в логах і в відповіді.
 */
export async function POST(req: NextRequest) {
    let body: { action?: string; categories?: Record<string, unknown>; email?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

    const action = typeof body?.action === 'string' ? body.action : '';
    const rows = buildConsentRows(action, body?.categories);

    // Невідома дія — це помилка викликача, а не привід тихо нічого не робити.
    if (rows.length === 0) {
        console.error('[consent-log] unknown action, nothing written', { action });
        return NextResponse.json({ ok: false, error: `Unknown consent action: ${action || '(empty)'}` }, { status: 400 });
    }

    // Хто дав згоду. Сесія головніша за те, що прислав браузер; для гостя з
    // футера чи попапа лишається тільки прислана пошта.
    let customerId: string | null = null;
    let email: string | null = null;
    try {
        const cookieClient = await createClient();
        const { data: { user } } = await cookieClient.auth.getUser();
        if (user) {
            customerId = user.id;
            email = user.email || null;
        }
    } catch {}
    if (!email) email = readConsentEmail(body?.email) ?? readConsentEmail((body?.categories as any)?.email);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    const ua = req.headers.get('user-agent') || null;

    // customer_id має FK на customers(id). У залогіненого користувача рядок
    // клієнта майже завжди є (1279 із 1280 мають id = auth_user_id), але
    // «майже» тут замало: неіснуючий id відхилив би ВЕСЬ пакет рядків, і згода
    // знову не записалася б. Перевіряємо один раз.
    const admin = getAdminClient();
    if (customerId) {
        const { data: known } = await admin.from('customers').select('id').eq('id', customerId).maybeSingle();
        if (!known) customerId = null;
    }

    const { error } = await admin.from('consent_log').insert(
        rows.map(row => ({
            customer_id: customerId,
            email,
            consent_type: row.consent_type,
            granted: row.granted,
            policy_version: '1.0',
            ip_address: ip,
            user_agent: ua,
            source: 'web',
        })),
    );

    if (error) {
        console.error('[consent-log] insert failed', { action, rows: rows.length, error: error.message });
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, written: rows.length });
}
