/**
 * Чи можна прийняти ще одну заявку на партнерство з цієї пошти.
 *
 * НАВІЩО. Форма на /partnery/apply не питала в бази нічого: вона
 * складала рядок у partnership_requests і слала два листи, хоч би скільки
 * разів ту саму пошту вже бачили. Через це 11.09.2026 з пошти, де партнер
 * «Подорожуй!» існував і працював із 14.07, зайшла друга заявка, і людині
 * ніхто не сказав, що кабінет у неї вже є.
 *
 * ЧОМУ НЕ ЖОРСТКЕ БЛОКУВАННЯ ПО ФАКТУ ЗАПИСУ. Партнерство можна припинити:
 * у agency_partners є статус, і колись у ньому стоятиме не тільки 'active'.
 * Якби форма відмовляла всім, кого вона колись бачила, колишній партнер не
 * мав би жодного способу повернутися — форма казала б йому «ви вже наш
 * партнер», а кабінет при цьому не працював би (Діана, 16.09.2026). Тому
 * дивимося на СТАН, а не на наявність рядка: дорога закрита, поки партнер
 * активний або попередня заявка ще на розгляді, і відкрита в усіх інших
 * випадках.
 */

export type GatePartner = { status?: string | null };
export type GateRequest = { status?: string | null };

/** Заявка ще в роботі — другу створювати нема сенсу. */
export const OPEN_REQUEST_STATUSES = ['new', 'contacted'];
/** Партнер працює прямо зараз. */
export const ACTIVE_PARTNER_STATUSES = ['active'];

export type GateCode = 'ok' | 'active_partner' | 'pending_request';

export interface ApplicationGate {
    /** Чи створювати новий рядок у partnership_requests. */
    allow: boolean;
    code: GateCode;
    /**
     * Чи ця пошта вже зустрічалася раніше. Рахується навіть тоді, коли заявку
     * приймаємо: адміністраторці треба бачити, що людина звертається не
     * вперше, інакше повторна заявка знову загубиться серед нових.
     */
    repeat: boolean;
    /** Текст для людини біля форми; порожній, коли заявку приймаємо. */
    message: string;
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Кабінет відкривається через вхід в акаунт, а не через токен у посиланні. */
export const PARTNER_CABINET_URL = '/uk/partner/cabinet';

export function applicationGate(
    partners: GatePartner[] | null | undefined,
    requests: GateRequest[] | null | undefined,
): ApplicationGate {
    const partnerRows = partners || [];
    const requestRows = requests || [];
    const repeat = partnerRows.length > 0 || requestRows.length > 0;

    if (partnerRows.some(p => ACTIVE_PARTNER_STATUSES.includes(norm(p?.status)))) {
        return {
            allow: false,
            code: 'active_partner',
            repeat: true,
            message: 'Ця пошта вже зареєстрована як партнерська, тож нову заявку створювати не потрібно. Увійдіть у партнерський кабінет — там ваш промокод, нарахування та історія замовлень за вашим кодом.',
        };
    }

    if (requestRows.some(r => OPEN_REQUEST_STATUSES.includes(norm(r?.status)))) {
        return {
            allow: false,
            code: 'pending_request',
            repeat: true,
            message: 'Заявку з цієї пошти ми вже отримали, і вона зараз на розгляді. Ми звʼяжемося з вами, щойно її розглянемо, тож надсилати другу заявку не потрібно.',
        };
    }

    return { allow: true, code: 'ok', repeat, message: '' };
}

/**
 * Та сама ознака повтору для списку заявок в адмінці: чи є на цю пошту
 * партнер або ще одна, старіша заявка.
 */
export function isRepeatApplication(
    request: { email?: string | null; created_at?: string | null },
    partners: Array<{ email?: string | null }> | null | undefined,
    allRequests: Array<{ email?: string | null; created_at?: string | null }> | null | undefined,
): boolean {
    const email = norm(request?.email);
    if (!email) return false;
    if ((partners || []).some(p => norm(p?.email) === email)) return true;
    const mine = new Date(request?.created_at || 0).getTime();
    return (allRequests || []).some(r => {
        if (norm(r?.email) !== email) return false;
        const other = new Date(r?.created_at || 0).getTime();
        return Number.isFinite(other) && other < mine;
    });
}
