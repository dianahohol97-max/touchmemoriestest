import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Журнал вихідних листів клієнту — одна функція на всі шляхи відправки.
 *
 * Проблема, заради якої це існує: вставка в email_logs була написана руками в
 * чотирьох різних місцях, і вони встигли розійтися. Двоє писали body, ЖОДЕН не
 * писав provider_message_id (нуль значень на 255 рядків), а лист «замовлення
 * прийнято» з create-invoice узагалі летів через `.catch(() => {})` і при
 * відмові не лишав ні рядка, ні сліду в інтерфейсі. Менеджер бачив «успішно»
 * там, де провайдер відмовив.
 *
 * Тепер рядок пише тільки ця функція, і вона пише його ЗАВЖДИ — і на успіх, і
 * на помилку, — з усіма чотирма полями, які раніше губилися: знімком тексту,
 * ідентифікатором листа в Brevo, автором і його імʼям.
 *
 * Дві транспортні обгортки в репо повертають результат по-різному: sendEmail
 * віддає { success, data, error }, а getResendClient().emails.send() віддає
 * { data, error }. Розбирає їх readSendOutcome, щоб кожен виклик не робив це
 * по-своєму — саме на такому «по-своєму» і загубився provider_message_id.
 */

export interface SendOutcome {
    sent: boolean;
    providerMessageId: string | null;
    error: string | null;
}

/** Витягує текст помилки з чого завгодно, що повернув транспорт. */
function readError(value: unknown): string {
    if (!value) return 'Невідома помилка провайдера';
    if (typeof value === 'string') return value;
    const message = (value as any)?.message;
    if (typeof message === 'string' && message.trim()) return message;
    try {
        return JSON.stringify(value).slice(0, 300);
    } catch {
        return String(value);
    }
}

/** Brevo віддає { messageId } — це і є ідентифікатор листа в провайдера. */
function readMessageId(data: unknown): string | null {
    const id = (data as any)?.messageId ?? (data as any)?.message_id ?? null;
    return id ? String(id).slice(0, 300) : null;
}

/**
 * Зводить відповідь будь-якої з двох обгорток до одного вигляду.
 *
 * Порожній результат — це відмова, а не успіх. Саме так виглядає обірваний
 * виклик, і саме його раніше приймали за «надіслано».
 */
export function readSendOutcome(res: unknown): SendOutcome {
    if (res === null || res === undefined) {
        return { sent: false, providerMessageId: null, error: 'Провайдер не відповів' };
    }

    const r = res as any;

    // sendEmail(): { success, data?, error? }
    if (typeof r.success === 'boolean') {
        return r.success
            ? { sent: true, providerMessageId: readMessageId(r.data), error: null }
            : { sent: false, providerMessageId: null, error: readError(r.error) };
    }

    // getResendClient().emails.send(): { data, error }
    if ('error' in r || 'data' in r) {
        return r.error
            ? { sent: false, providerMessageId: null, error: readError(r.error) }
            : { sent: true, providerMessageId: readMessageId(r.data), error: null };
    }

    return { sent: false, providerMessageId: null, error: 'Незрозуміла відповідь провайдера' };
}

/** Відмова, яка сталася ДО звернення до провайдера (немає email, поганий файл). */
export function failedOutcome(message: string): SendOutcome {
    return { sent: false, providerMessageId: null, error: message };
}

/**
 * Текстовий знімок листа, зібраного з HTML-шаблону.
 *
 * У журнал іде саме текст, а не сира розмітка. Причина не в місці: картка
 * замовлення показує body як звичайний текст із pre-wrap, тож двадцять
 * кілобайтів тегів зробили б історію нечитабельною рівно там, де її й
 * читають. Текст, який побачив клієнт, доводить зміст листа не гірше за
 * розмітку і лишається придатним для очей.
 */
export function htmlToTextSnapshot(html: string, limit = 4000): string {
    const text = String(html || '')
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[ \t]+/g, ' ')
        // Пробіли навколо переносу. Закривальний тег дає \n, а наступний
        // відкривальний — пробіл із загального зняття тегів, тож без цього
        // рядка кожен абзац починався б із пробілу.
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * Автор, що приїхав у тілі запиту, зведений до безпечного вигляду.
 *
 * Транзакційний маршрут смикають сервер-до-сервера з cron-секретом, тож куки
 * туди не доїжджають і сесії немає — автора доводиться передавати явно. Все,
 * що звідти приходить, обрізається за довжиною і зводиться до рядка: у журнал
 * не має права потрапити ні обʼєкт замість імені, ні кілобайт тексту замість
 * uuid.
 */
export function readActor(value: unknown): { id: string | null; name: string | null } | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as any;
    const id = typeof raw.id === 'string' && UUID_RE.test(raw.id) ? raw.id : null;
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 200) : null;
    return id || name ? { id, name } : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OutgoingEmailEntry {
    orderId: string | null;
    /** Кому пішов лист. */
    to: string;
    /** Тип листа: 'manual', 'order_placed', 'order_paid' тощо. */
    template: string;
    subject: string;
    /** Знімок тексту. Обовʼязковий: журнал без тексту не доводить нічого. */
    body: string;
    /** Хто натиснув. Порожній автор означає автоматичну відправку. */
    actor?: { id: string | null; name: string | null } | null;
    outcome: SendOutcome;
}

/**
 * Пише рядок журналу. Ніколи не кидає.
 *
 * Лист уже або пішов, або ні, і провалений запис у журнал не має права
 * перетворити доставлений лист на помилку в інтерфейсі. Тому помилка вставки
 * лише логується в консоль.
 */
export async function logOutgoingEmail(entry: OutgoingEmailEntry): Promise<void> {
    try {
        const admin = getAdminClient();
        const { error } = await admin.from('email_logs').insert({
            order_id: entry.orderId,
            customer_email: entry.to,
            template: entry.template,
            subject: entry.subject,
            body: entry.body,
            provider_message_id: entry.outcome.providerMessageId,
            status: entry.outcome.sent ? 'sent' : 'failed',
            error: entry.outcome.error,
            sent_by: entry.actor?.id || null,
            sent_by_name: entry.actor?.name || null,
            sent_at: new Date().toISOString(),
        });
        if (error) {
            console.error('[email-log] insert failed', { orderId: entry.orderId, template: entry.template, error: error.message });
        }
    } catch (e) {
        console.error('[email-log] insert threw (email itself unaffected):', e);
    }
}
