import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { drainCampaignQueue } from '@/lib/email/campaign-queue';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { consumeRunToken, isCronRequest } from '@/lib/automation/run-token';
import { buildLaunchEmail, launchEmailSubject } from '@/lib/email/campaign-launch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The daily batch of the CRM-base mailing.
 *
 * Diana picks the hour; it is not baked in. The first batch went at 16:45, the
 * second was moved to 16:00 («налаштуй розсилку завтра на 4 вечора»).
 *
 * There are two ways to arm it, and neither is a plain unattended daily cron —
 * one of those, left running, would keep mailing customers on days nobody asked
 * for.
 *
 * ONE DAY — settings('campaign_send_date') holds a single date. The cron sends
 * only if it wakes up on that date, and sending deletes the row. This is the
 * original mode, from «тільки завтра, далі вирішимо».
 *
 * A STANDING PLAN — settings('campaign_daily_plan') holds { size, from,
 * through }, and the cron sends `size` letters every day inside that window.
 * Added 2026-09-12 for «заплануй відправку решти листів по 100 в день»: the
 * remaining base is ~5.1k names, and arming fifty-two separate days by hand was
 * never going to happen. The plan still cannot run forever — `through` is a
 * hard end date, and the plan deletes itself the moment the base is exhausted,
 * so the campaign stops on its own rather than because someone remembered.
 *
 * BATCH_SIZE is Diana's original fifty and stays the size of a one-day arm; a
 * plan carries its own. Either way it is a ceiling on the run, not a target:
 * the shared marketing budget still applies, and order confirmations always
 * come first.
 */

const BATCH_SIZE = 50;
/** Стеля для ручного `?size=` — вище за неї впирається денний бюджет. */
const MAX_BATCH_SIZE = 200;
const ARMED_KEY = 'campaign_send_date';
const PLAN_KEY = 'campaign_daily_plan';
/** Скільки листів на день, якщо план є, але розмір у ньому не вказано. */
const DEFAULT_PLAN_SIZE = 100;
const REPORT_TO = 'gogolka16@gmail.com';

interface DailyPlan {
    size: number;
    from?: string;
    through?: string;
}

/**
 * Читає план із settings, не довіряючи тому, що там лежить.
 *
 * Рядок правиться руками в базі, тож зіпсований розмір («100 листів» замість
 * 100) не має означати ані нуль листів, ані двадцять тисяч: беремо типове
 * значення і тиснемо стелею партії.
 */
function readPlan(value: any): DailyPlan | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const size = Number(value.size);
    const day = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
    return {
        size: Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), MAX_BATCH_SIZE) : DEFAULT_PLAN_SIZE,
        from: day(value.from),
        through: day(value.through),
    };
}

/** Today's date in Kyiv, as YYYY-MM-DD. */
function kyivDate(): string {
    return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
    const viaToken = await consumeRunToken(request, 'campaign_batch_token');
    if (!viaToken && !isCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();
    const today = kyivDate();

    // Розмір партії. Cron завжди шле свої пʼятдесят; `?size=` — це коли Diana
    // каже конкретне число на конкретний день («відправляй сьогодні 100»), і
    // саме тому воно приймається тільки в токен-запуску. Денний бюджет усе одно
    // головніший: якщо на маркетинг лишилося менше, піде скільки лишилося.
    const askedSize = parseInt(new URL(request.url).searchParams.get('size') || '', 10);

    const [{ data: armedRow }, { data: planRow }] = await Promise.all([
        admin.from('settings').select('value').eq('key', ARMED_KEY).maybeSingle(),
        admin.from('settings').select('value').eq('key', PLAN_KEY).maybeSingle(),
    ]);
    const armedFor = typeof armedRow?.value === 'string'
        ? armedRow.value
        : (armedRow?.value as any)?.date;

    const plan = readPlan(planRow?.value);
    // Дати порівнюються як рядки YYYY-MM-DD, і саме тому вони в такому форматі:
    // лексикографічний порядок тут збігається з календарним, а Date не треба.
    const planActive = !!plan
        && (!plan.from || plan.from <= today)
        && (!plan.through || today <= plan.through);

    // A token run is a deliberate «send it now» and skips the date gate; the
    // scheduled run never does.
    if (!viaToken && armedFor !== today && !planActive) {
        const planNote = plan
            ? plan.from && plan.from > today
                ? ` План почнеться ${plan.from}.`
                : ` План діяв до ${plan.through}.`
            : '';
        return NextResponse.json({
            ok: true,
            skipped: true,
            reason: (armedFor
                ? `Розсилку заряджено на ${armedFor}, сьогодні ${today} — нічого не надсилаю.`
                : 'Розсилку не заряджено на жоден день — нічого не надсилаю.') + planNote,
        });
    }

    // Розмір партії. Явне `?size=` головніше за все, далі — щоденний план, і
    // лише потім початкові пʼятдесят одноденного заряду.
    const batchSize = viaToken && Number.isFinite(askedSize) && askedSize > 0
        ? Math.min(askedSize, MAX_BATCH_SIZE)
        : planActive ? plan!.size : BATCH_SIZE;

    // Rows wait as 'scheduled', not 'pending', and that is what keeps them from
    // leaving early. The general queue drain at 19:00 Kyiv takes everything
    // marked pending, so a batch prepared the evening before would have gone
    // out that same night at the wrong hour. Releasing exactly BATCH_SIZE rows
    // here is what makes the send time mean something.
    const { data: waiting } = await admin
        .from('email_campaign_queue')
        .select('id, campaign_id')
        .eq('status', 'scheduled')
        .order('created_at', { ascending: true })
        .limit(batchSize);

    const releaseIds = (waiting || []).map(r => r.id);
    if (releaseIds.length) {
        await admin.from('email_campaign_queue').update({ status: 'pending' }).in('id', releaseIds);
    }

    // The letter must carry TODAY's code. The body is rebuilt from the shared
    // template right before sending rather than typed in when the batch was
    // prepared — a batch queued yesterday would otherwise ship yesterday's code,
    // and the customer would tap a promo that expired a day early.
    const campaignIds = Array.from(new Set((waiting || []).map(r => r.campaign_id).filter(Boolean)));
    if (campaignIds.length) {
        const { data: liveCode } = await admin
            .from('promo_codes')
            .select('code')
            .like('code', 'SITE%')
            .eq('is_active', true)
            .gt('valid_until', new Date().toISOString())
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (liveCode?.code) {
            await admin
                .from('email_campaigns')
                .update({ body_html: buildLaunchEmail({ code: liveCode.code }), subject: launchEmailSubject() })
                .in('id', campaignIds);
        } else {
            console.error('[campaign-daily-batch] no live SITE code — sending with the stored body');
        }
    }

    const result = await drainCampaignQueue(batchSize);

    // Everything still waiting for a future batch — the honest "how much base
    // is left" number, which `remaining` alone does not give since it counts
    // only rows already released into the queue.
    const { count: scheduledLeft } = await admin
        .from('email_campaign_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled');

    // Disarm the one-day arm: one batch means one batch. The next one has to be
    // asked for.
    await admin.from('settings').delete().eq('key', ARMED_KEY);

    // Щоденний план, на відміну від заряду на один день, переживає відправку —
    // інакше «по 100 в день» довелося б заряджати вручну пʼятдесят два рази.
    // Але він і не вічний: щойно база закінчилася або минула кінцева дата,
    // рядок видаляється. Кампанія зупиняється сама, а не тому, що хтось
    // згадав її вимкнути.
    let planNote = '';
    if (plan && planActive) {
        const exhausted = !scheduledLeft && !result.remaining;
        const expired = !!plan.through && today >= plan.through;
        if (exhausted || expired) {
            await admin.from('settings').delete().eq('key', PLAN_KEY);
            planNote = exhausted
                ? 'Базу пройдено до кінця — щоденний план виконано і знято.'
                : `Сьогодні останній день плану (${plan.through}) — далі розсилка мовчить.`;
        } else {
            const daysLeft = Math.ceil((scheduledLeft || 0) / Math.max(1, plan.size));
            planNote = `Щоденний план: ${plan.size} листів на день до ${plan.through || 'скасування'}.`
                + ` За такої швидкості лишилося приблизно ${daysLeft} днів.`;
        }
    }

    // Відкриття й переходи по ВСІХ надісланих раніше листах. Свіжа партія ще
    // нічого не встигла показати, тож сенс має тільки накопичена картина —
    // інакше у звіті щоразу стояли б нулі.
    let engagement = '';
    try {
        const { count: sentTotal } = await admin.from('email_campaign_queue')
            .select('id', { count: 'exact', head: true }).eq('status', 'sent');
        const { count: openedTotal } = await admin.from('email_campaign_queue')
            .select('id', { count: 'exact', head: true }).not('opened_at', 'is', null);
        const { count: clickedTotal } = await admin.from('email_campaign_queue')
            .select('id', { count: 'exact', head: true }).not('clicked_at', 'is', null);
        const pct = (n: number) => (sentTotal ? Math.round((n / sentTotal) * 100) : 0);
        engagement = [
            '',
            `Загалом надіслано за весь час: ${sentTotal}.`,
            `Відкрили: ${openedTotal} (${pct(openedTotal || 0)}%) — число завищене, Apple Mail підвантажує картинки сам.`,
            `Перейшли на сайт: ${clickedTotal} (${pct(clickedTotal || 0)}%) — оце справжній показник.`,
        ].join('\n');
    } catch (e) {
        console.error('[campaign-daily-batch] engagement stats failed:', e);
    }

    const text = [
        `Партію розіслано: ${result.sent} листів.`,
        result.failed ? `Не пройшло: ${result.failed}.` : '',
        `У черзі лишилося: ${result.remaining}.`,
        `Заготовлено на наступні партії: ${scheduledLeft}.`,
        '',
        engagement,
        '',
        planNote || 'Наступної партії не буде, доки ви не скажете — розсилка знову роззброєна.',
    ].filter(Boolean).join('\n');

    try {
        await sendBrevoEmail({
            to: REPORT_TO,
            subject: `Розсилка: надіслано ${result.sent}, лишилося ${result.remaining}`,
            html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">
                     ${text.split('\n').map(l => `<p style="margin:0 0 10px">${l}</p>`).join('')}
                   </div>`,
            kind: 'marketing',
        });
    } catch (e) {
        console.error('[campaign-daily-batch] report email failed:', e);
    }

    return NextResponse.json({ ok: true, armedFor, plan: planActive ? plan : null, batchSize, scheduledLeft, ...result });
}
