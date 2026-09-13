import { getAdminClient } from '@/lib/supabase/admin';
import { normaliseMessageId } from '@/lib/email/delivery-events';

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
 *
 * ПОБІЧНА ДІЯ, про яку треба знати: logOutgoingEmail не лише пише журнал, а
 * ще й призначає відповідального за замовлення, коли той порожній. Назва
 * функції від цього вужча за її зміст, і це свідомий компроміс — саме тут
 * сходяться всі пʼять шляхів відправки, тож одне місце дає призначення з
 * будь-якої кнопки. Подробиці й причина — у коментарі до самої функції.
 */

/**
 * Чому передати не вдалося.
 *
 *  quota    — ліміт вичерпано: або наш денний бюджет, або тариф Brevo. Текст у
 *             error каже, чий саме. Це єдина причина, яка минає сама опівночі,
 *             тож змішувати її з рештою означало б ховати від менеджера
 *             єдиний випадок, коли треба просто почекати або підняти тариф.
 *  provider — Brevo відмовив з іншої причини.
 *  config   — немає ключа або налаштування.
 *  precheck — відмова ще до звернення до провайдера: немає email, поганий файл.
 */
export type FailureKind = 'quota' | 'provider' | 'config' | 'precheck';

export interface SendOutcome {
    sent: boolean;
    providerMessageId: string | null;
    error: string | null;
    failureKind: FailureKind | null;
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

/**
 * Класифікує відмову за самим обʼєктом помилки, а не за текстом.
 *
 * Наш власний ліміт розпізнається надійно: sendBrevoEmail кидає
 * EmailQuotaError з code === 'EMAIL_QUOTA_EXCEEDED', і обидві транспортні
 * обгортки повертають сам обʼєкт, тож код доступний.
 *
 * З лімітом тарифу Brevo складніше. Яким саме кодом він відповідає, з коду не
 * встановити, тож розпізнаємо 402 (класичний «потрібна оплата») і явні згадки
 * кредитів чи ліміту в тексті. Усе неоднозначне лишається 'provider': видати
 * чужу відмову за квоту гірше, ніж не розпізнати квоту.
 */
function classifyFailure(error: unknown): FailureKind {
    const e = error as any;
    if (e?.code === 'EMAIL_QUOTA_EXCEEDED') return 'quota';

    const status = Number(e?.status);
    if (status === 402) return 'quota';

    const text = `${e?.message ?? e ?? ''} ${e?.brevoCode ?? ''}`.toLowerCase();
    if (/not configured|не налаштован|api[_ ]?key/.test(text)) return 'config';
    if (/credit|quota|limit exceeded|daily limit|ліміт/.test(text)) return 'quota';

    return 'provider';
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
        return { sent: false, providerMessageId: null, error: 'Провайдер не відповів', failureKind: 'provider' };
    }

    const r = res as any;

    // sendEmail(): { success, data?, error? }
    if (typeof r.success === 'boolean') {
        return r.success
            ? { sent: true, providerMessageId: readMessageId(r.data), error: null, failureKind: null }
            : { sent: false, providerMessageId: null, error: readError(r.error), failureKind: classifyFailure(r.error) };
    }

    // getResendClient().emails.send(): { data, error }
    if ('error' in r || 'data' in r) {
        return r.error
            ? { sent: false, providerMessageId: null, error: readError(r.error), failureKind: classifyFailure(r.error) }
            : { sent: true, providerMessageId: readMessageId(r.data), error: null, failureKind: null };
    }

    return { sent: false, providerMessageId: null, error: 'Незрозуміла відповідь провайдера', failureKind: 'provider' };
}

/** Відмова, яка сталася ДО звернення до провайдера (немає email, поганий файл). */
export function failedOutcome(message: string, kind: FailureKind = 'precheck'): SendOutcome {
    return { sent: false, providerMessageId: null, error: message, failureKind: kind };
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

/**
 * Скільки годин той самий лист вважається вже надісланим.
 *
 * Доба — це вікно однієї події. Повтори, від яких лікуємося, приходять
 * секундами й хвилинами: Monobank повторює вебхук, поки не отримає 200,
 * адміністратор двічі тисне «Позначити оплаченим», а два шляхи оплати
 * спрацьовують на одне й те саме зарахування. Усе це вкладається в добу з
 * величезним запасом.
 *
 * Довше робити не можна: подія, яка справді повторилася через тиждень (нова
 * відправка після повернення, наприклад), мусить дійти до клієнта. Константа
 * тут одна на весь маршрут, щоб поріг не розповзся числами по коду.
 */
export const DUPLICATE_WINDOW_HOURS = 24;

/**
 * Чи діє на цю дію захист від повторів.
 *
 * 'paid' і 'shipped' описують ПОДІЮ, яка стається з замовленням один раз:
 * гроші зайшли, посилка поїхала. Другий такий лист — завжди помилка.
 *
 * 'placed' свідомо поза правилом (Diana, 13.09.2026). Той самий лист стоїть за
 * кнопкою «Надіслати посилання клієнту», і менеджер тисне її навмисно, коли
 * клієнт каже, що нічого не отримав або загубив посилання на оплату. Захист
 * тут перетворив би робочу кнопку на кнопку, яка мовчки нічого не робить.
 */
export function isDuplicateGuardedAction(action: string): boolean {
    return action === 'paid' || action === 'shipped';
}

/** Початок вікна, у якому шукаємо попередній успішний лист. */
export function duplicateWindowStart(now: Date = new Date(), hours: number = DUPLICATE_WINDOW_HOURS): string {
    return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Чи йшов уже цей самий лист за цим замовленням, і успішно.
 *
 * Успішно — тобто status = 'sent'. Провалена відправка не блокує нічого: лист
 * не дійшов, і повторити його треба обовʼязково. Так само не блокує помилка
 * читання самого журналу: мовчання про отриману оплату гірше за другий лист,
 * тож при збої ми надсилаємо.
 */
export async function findRecentSuccessfulSend(params: {
    orderId: string;
    template: string;
    withinHours?: number;
}): Promise<{ id: string; sent_at: string | null } | null> {
    try {
        const admin = getAdminClient();
        const { data, error } = await admin
            .from('email_logs')
            .select('id, sent_at')
            .eq('order_id', params.orderId)
            .eq('template', params.template)
            .eq('status', 'sent')
            .gte('sent_at', duplicateWindowStart(new Date(), params.withinHours ?? DUPLICATE_WINDOW_HOURS))
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[email-log] duplicate check failed, sending anyway', { orderId: params.orderId, template: params.template, error: error.message });
            return null;
        }
        return (data as any) || null;
    } catch (e) {
        console.error('[email-log] duplicate check threw, sending anyway:', e);
        return null;
    }
}

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
 * Пише рядок журналу і, за потреби, закріплює замовлення за автором листа.
 * Ніколи не кидає.
 *
 * Лист уже або пішов, або ні, і провалений запис у журнал не має права
 * перетворити доставлений лист на помилку в інтерфейсі. Тому помилка вставки
 * лише логується в консоль. Те саме стосується призначення.
 *
 * ПРО ПРИЗНАЧЕННЯ. orders.manager_id існує давно, разом із випадайками в
 * списку і в картці, і на 13.09.2026 був заповнений у НУЛЯ замовлень із 1092.
 * Добровільна дія вже існувала і не спрацювала, тож відповідальним стає той,
 * хто першим написав клієнту: це єдиний момент, коли людина точно взялася за
 * замовлення. Ручна випадайка лишається — вона тепер для ПЕРЕДАЧІ іншому, а не
 * для першого призначення.
 *
 * Заповнене поле не перезаписується ніколи, і умова стоїть у WHERE самого
 * UPDATE, а не в читанні перед записом: так її не обійти навіть у гонці двох
 * одночасних листів.
 *
 * Невдала відправка теж призначає (Diana, 13.09.2026). Людина взялася за
 * замовлення незалежно від того, чи Brevo відмовив, а замовлення без
 * відповідального — це рівно те, від чого лікуємося.
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
            // Нормалізований, щоб зійтися з message-id із вебхука Brevo:
            // формати відрізняються кутовими дужками й регістром, а незбіг тут
            // не помітний нічим — події приходять, рядок не оновлюється.
            provider_message_id: normaliseMessageId(entry.outcome.providerMessageId),
            status: entry.outcome.sent ? 'sent' : 'failed',
            error: entry.outcome.error,
            failure_kind: entry.outcome.failureKind,
            sent_by: entry.actor?.id || null,
            sent_by_name: entry.actor?.name || null,
            sent_at: new Date().toISOString(),
        });
        if (error) {
            console.error('[email-log] insert failed', { orderId: entry.orderId, template: entry.template, error: error.message });
        }

        // Закріпити замовлення за тим, хто написав, якщо воно ще нічиє.
        if (entry.orderId && entry.actor?.id) {
            const { error: assignErr } = await admin
                .from('orders')
                .update({ manager_id: entry.actor.id, updated_at: new Date().toISOString() })
                .eq('id', entry.orderId)
                .is('manager_id', null);
            if (assignErr) {
                console.error('[email-log] manager auto-assign failed (mail unaffected)', {
                    orderId: entry.orderId, error: assignErr.message,
                });
            }
        }
    } catch (e) {
        console.error('[email-log] insert threw (email itself unaffected):', e);
    }
}
