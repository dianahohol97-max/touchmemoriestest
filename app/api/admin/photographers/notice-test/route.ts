import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';
import { consumeRunToken } from '@/lib/automation/run-token';
import { sendLoggedEmail } from '@/lib/email/send-logged';
import { expiryNoticeEmail, storageNoticeEmail, purgeNoticeEmail } from '@/lib/photographers/notice-emails';
import { NOTICE_TEMPLATES } from '@/lib/photographers/notices';
import { DEMO_PHOTOGRAPHER_EMAIL } from '@/lib/photographers/notice-rules';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/admin/photographers/notice-test — по одному примірнику листів
 * фотографу («галерея скоро згасне» в обох варіантах, «місце закінчується»,
 * «файли видалено»),
 * щоб Діана побачила їх у справжній скриньці, а не на знімку HTML.
 *
 * Будує листи ТИМИ САМИМИ функціями, що й крон та аплоад, тож затверджений тут
 * лист — це те, що отримає фотограф. У журнал вони йдуть із суфіксом `_test` у
 * шаблоні, і жодна позначка в photographer_galleries чи photographers тут не
 * ставиться: тестовий лист не має закрити справжній.
 *
 * Дані зразкові: демо-галерея, термін за три з половиною доби, заповнення як у
 * найповнішого кабінету на 24.09.2026 (3 655 431 429 байтів із 4 ГіБ).
 * Кнопка «Відкрити кабінет» веде в демо-кабінет.
 *
 * Доступ: адмін-сесія або одноразовий токен у settings
 * (`photographer_notice_test_token`, див. lib/automation/run-token.ts).
 * `?to=` міняє адресу.
 */

const DEFAULT_TO = 'dianahohol97@gmail.com';

export async function GET(req: NextRequest) {
    const viaToken = await consumeRunToken(req, 'photographer_notice_test_token');
    if (!viaToken) {
        const guard = await requireAdmin();
        if (!guard.ok) return guard.response;
    }

    const to = (new URL(req.url).searchParams.get('to') || DEFAULT_TO).trim();
    if (!to.includes('@')) return NextResponse.json({ error: 'Некоректна адреса' }, { status: 400 });

    const { data: demo } = await getAdminClient()
        .from('photographers')
        .select('cabinet_token')
        .ilike('email', DEMO_PHOTOGRAPHER_EMAIL)
        .maybeSingle();
    const cabinetToken = demo?.cabinet_token || 'demo';

    const now = Date.now();
    const title = 'Весілля Марії та Андрія';
    const letters = [
        { template: NOTICE_TEMPLATES.expiry, mail: expiryNoticeEmail({ galleryTitle: title, expiresAt: new Date(now + 3.5 * 86_400_000).toISOString(), cabinetToken, variant: 'extend' }) },
        { template: NOTICE_TEMPLATES.expiry, mail: expiryNoticeEmail({ galleryTitle: title, expiresAt: new Date(now + 3.5 * 86_400_000).toISOString(), cabinetToken, variant: 'upgrade' }) },
        { template: NOTICE_TEMPLATES.storage, mail: storageNoticeEmail({ usedBytes: 3_655_431_429, limitBytes: 4 * 1024 ** 3, planName: 'Безкоштовно' }) },
        { template: NOTICE_TEMPLATES.purge, mail: purgeNoticeEmail({ galleryTitle: title, purgedAt: new Date(now).toISOString(), cabinetToken }) },
    ];

    const results: { template: string; subject: string; sent: boolean; error: string | null }[] = [];
    for (const { template, mail } of letters) {
        const outcome = await sendLoggedEmail(
            { to, subject: mail.subject, html: mail.html },
            { template: `${template}_test` },
        );
        results.push({ template, subject: mail.subject, sent: outcome.sent, error: outcome.error });
    }
    return NextResponse.json({ to, results }, { status: results.every(r => r.sent) ? 200 : 502 });
}
