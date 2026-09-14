import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getWatchdogChatId, sendViaPublicBot } from '@/lib/chatbot/telegram-business';
import {
    decide,
    formatAlert,
    groupRows,
    pruneStore,
    type AlertStore,
    type LogRow,
} from '@/lib/alerts/error-alerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Помилки в проді — у робочий чат, кожні пʼятнадцять хвилин.
 *
 * Привід. 14.09.2026 список замовлень в адмінці віддавав пʼятисотку кілька
 * годин, і дізналися ми випадково. Сигналу не було жодного: ні Sentry, ні
 * сповіщень, нічого. Крон закриває саме цю дірку.
 *
 * Чому крон, а не гачок у коді. Розглядали три варіанти. Гачок
 * instrumentation.ts ловить лише ВИКИНУТІ винятки, а та поломка була
 * спіймана самим маршрутом і віддана як 500 — його б не помітили. Спільна
 * обгортка для адмінських маршрутів вимагає, щоб її не забув покликати автор
 * кожного нового маршруту, і саме на «не забути покликати» ми цього тижня
 * спіймалися двічі. Крон не залежить ні від того, ні від того: він дивиться
 * на журнал постфактум і бачить усе, включно з чужим кодом.
 *
 * Ціна вибору — затримка до пʼятнадцяти хвилин. Це набагато краще за кілька
 * годин і за «дізналися випадково».
 *
 * Куди пише: у той самий чат, де сидить Софія і сторож несписаних діалогів.
 * Адреса береться з налаштування telegram_alerts_chat_id тим самим
 * getWatchdogChatId(), щоб не завести другого джерела правди про чат.
 *
 * Що потрібно з оточення: VERCEL_API_TOKEN. Без нього маршрут відповідає 503
 * і пояснює, чого бракує — монiторинг, який мовчки нічого не робить, гірший
 * за відсутній.
 *
 * Перевірка перед бойовим запуском: `?preview=1` повертає те, що НАДІСЛАЛОСЯ
 * Б, нічого не надсилаючи і не змінюючи памʼять про вже показані помилки. Це
 * той самий прийом, що в ops-digest.
 */

const VERCEL_API = 'https://api.vercel.com';
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_Oz13dkGF3W1JvSVToT8WvZBseBba';
const TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_Qve9hriFT9sNYnjWZolAcFXl';

/** Ключ, під яким памʼять про вже показані помилки лежить у settings. */
const STORE_KEY = 'error_alert_state';

/**
 * Скільки помилок показувати за один прохід.
 *
 * Якщо зламалося все одразу, двадцять повідомлень поспіль — це та сама стіна,
 * яку ніхто не читає. Решта порахована і потрапить у лічильник.
 */
const MAX_ALERTS_PER_RUN = 5;

async function readStore(): Promise<AlertStore> {
    const supabase = getAdminClient();
    const { data } = await supabase.from('settings').select('value').eq('key', STORE_KEY).maybeSingle();
    const value = (data as any)?.value;
    return value && typeof value === 'object' ? (value as AlertStore) : {};
}

async function writeStore(store: AlertStore): Promise<void> {
    const supabase = getAdminClient();
    const { error } = await supabase
        .from('settings')
        .upsert({ key: STORE_KEY, value: store, updated_at: new Date().toISOString() });
    if (error) console.error('[error-alerts] failed to save state:', error.message);
}

/** Поточний бойовий деплой — журнал читається саме по ньому. */
async function currentProductionDeployment(token: string): Promise<string | null> {
    const url = `${VERCEL_API}/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&target=production&state=READY&limit=1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) throw new Error(`deployments: ${res.status} ${await res.text()}`);
    const body = await res.json();
    return body?.deployments?.[0]?.uid || body?.deployments?.[0]?.id || null;
}

/**
 * Рядки журналу за останнє вікно.
 *
 * Vercel віддає їх потоком ND-JSON, тобто по одному обʼєкту JSON на рядок, а
 * не одним масивом. Тому читаємо текст і розбираємо построково; зіпсований
 * рядок пропускаємо, а не валимо весь прохід.
 */
async function fetchRuntimeLogs(token: string, deploymentId: string, sinceMs: number): Promise<LogRow[]> {
    const url = `${VERCEL_API}/v1/projects/${PROJECT_ID}/deployments/${deploymentId}/runtime-logs?teamId=${TEAM_ID}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) throw new Error(`runtime-logs: ${res.status} ${await res.text()}`);

    const text = await res.text();
    const rows: LogRow[] = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const parsed = JSON.parse(trimmed);
            if (Number(parsed?.timestampInMs ?? 0) >= sinceMs) rows.push(parsed as LogRow);
        } catch {
            // Один зіпсований рядок не привід втратити решту вікна.
        }
    }
    return rows;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const preview = new URL(request.url).searchParams.get('preview') === '1';

    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = process.env.VERCEL_API_TOKEN;
    if (!token) {
        return NextResponse.json(
            { error: 'VERCEL_API_TOKEN не налаштований — читати журнал немає чим' },
            { status: 503 },
        );
    }

    const now = Date.now();
    // Вікно трохи ширше за крок крону: якщо один прохід не відбувся, наступний
    // підбере його хвилини, а повтори все одно відсіє правило про дублікати.
    const sinceMs = now - 20 * 60_000;

    try {
        const deploymentId = await currentProductionDeployment(token);
        if (!deploymentId) {
            return NextResponse.json({ ok: true, sent: 0, reason: 'бойового деплою не знайдено' });
        }

        const rows = await fetchRuntimeLogs(token, deploymentId, sinceMs);
        const groups = groupRows(rows);
        const store = await readStore();
        const { decisions, nextStore } = decide(groups, store, now);
        const toReport = decisions.filter((d) => d.report);

        if (preview) {
            return NextResponse.json({
                ok: true,
                preview: true,
                deploymentId,
                rowsInWindow: rows.length,
                groups: groups.length,
                wouldSend: toReport.length,
                messages: toReport.slice(0, MAX_ALERTS_PER_RUN).map(formatAlert),
                note: 'Нічого не надіслано і памʼять не змінена.',
            });
        }

        const chatId = await getWatchdogChatId();
        if (!chatId) {
            return NextResponse.json({ ok: true, sent: 0, reason: 'чат для сповіщень не налаштований' });
        }

        let sent = 0;
        for (const decision of toReport.slice(0, MAX_ALERTS_PER_RUN)) {
            const result = await sendViaPublicBot({ chat_id: chatId, text: formatAlert(decision) });
            if (result.success) sent++;
            else console.error('[error-alerts] send failed:', result.error);
        }

        const hidden = toReport.length - Math.min(toReport.length, MAX_ALERTS_PER_RUN);
        if (hidden > 0) {
            await sendViaPublicBot({
                chat_id: chatId,
                text: `Ще ${hidden} нових помилок за це вікно не показано, щоб не завалити чат. Повний перелік — у журналі Vercel.`,
            });
        }

        // Памʼять зберігається ПІСЛЯ надсилання. Якщо надсилання впаде,
        // наступний прохід спробує ще раз, а не зарахує помилку показаною.
        await writeStore(pruneStore(nextStore, now));

        return NextResponse.json({ ok: true, rowsInWindow: rows.length, groups: groups.length, sent, hidden });
    } catch (e: any) {
        console.error('[error-alerts] run failed:', e?.message || e);
        return NextResponse.json({ error: e?.message || 'прохід не вдався' }, { status: 500 });
    }
}
