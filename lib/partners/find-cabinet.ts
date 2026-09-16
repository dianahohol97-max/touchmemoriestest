import { normalizeBindingEmail as normalizeEmail } from '@/lib/agency/binding';

/**
 * Відновлення доступу до партнерського кабінету поштою.
 *
 * ЗАДАЧА. Кабінет відкривається одним лише `cabinet_token`, і той приходить
 * вітальним листом. Лист губиться, скринька змінюється, людина просто не
 * памʼятає — і партнер лишається без доступу до власних нарахувань. Другий
 * шлях, вхід акаунтом сайту через `/uk/partner/cabinet`, вимагає, щоб акаунт
 * був на ТІЙ САМІЙ пошті, а це не завжди так. Форма «знайти мій кабінет»
 * закриває решту випадків.
 *
 * ЧОМУ ВІДПОВІДЬ ЗАВЖДИ ОДНАКОВА. Якби форма казала «такого партнера немає»,
 * вона стала б довідником: перебором адрес можна було б зʼясувати, хто
 * співпрацює з touch.memories, а це комерційна таємниця Діани і чужа
 * персональна інформація заразом. Тому відповідь на екрані одна для всіх
 * випадків — знайшли, не знайшли, партнер призупинений, — і код відповіді теж
 * один, `200`. Різні коди статусу видали б рівно те, що ховає текст.
 *
 * ПОСИЛАННЯ НЕ ПОКАЗУЄТЬСЯ НІКОЛИ. На екран не потрапляє ні токен, ні назва
 * агенції, ні навіть факт її існування. Єдиний вихід посилання назовні —
 * лист НА ПОШТУ З ЗАПИСУ ПАРТНЕРА. Введена в форму адреса використовується
 * тільки як ключ пошуку і адресатом не стає ніколи: інакше досить було б
 * знати чужу пошту, щоб отримати чужий кабінет собі.
 *
 * ЧЕСНО ПРО МЕЖУ. Відповідь однакова, а от час відповіді ні: коли партнер
 * знайшовся, роут іще ходить у Brevo, і це сотні мілісекунд різниці. Закрити
 * це можна було б лише відправкою поза запитом, а вона на serverless
 * обривається разом із ним. При пʼяти спробах на годину з адреси перебирати
 * базу за таймінгом непрактично, тож межа лишається названою, а не вдаваною.
 */

/** Скільки разів з однієї адреси можна попросити посилання. */
export const FIND_CABINET_IP_LIMIT = 5;
export const FIND_CABINET_IP_WINDOW_MS = 60 * 60_000;

/**
 * Скільки лист не повторюється на ту саму пошту.
 *
 * Ліміт на IP сам по собі скриньку не захищає: адрес багато, скринька одна.
 * Пятнадцять хвилин — це достатньо, щоб людина, яка не дочекалася листа,
 * спробувала ще раз, і замало, щоб формою можна було завалити чужу пошту.
 */
export const FIND_CABINET_EMAIL_COOLDOWN_MS = 15 * 60_000;

/**
 * Єдина відповідь форми. Не каже ні «знайшли», ні «не знайшли» — лише те, що
 * станеться, якщо пошта в системі є.
 */
export const FIND_CABINET_REPLY =
    'Якщо ця пошта є в нашій системі, ми щойно надіслали на неї посилання на партнерський кабінет. Перевірте вхідні та теку зі спамом.';

export interface WindowState { count: number; resetAt: number }

/**
 * Лічильник спроб у вікні. Сховище передається ззовні, щоб правило можна було
 * перевірити тестом, а не чекати годину реального часу.
 */
export function overWindowLimit(
    store: Map<string, WindowState>,
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now(),
): boolean {
    const entry = store.get(key);
    if (!entry || now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return false;
    }
    entry.count++;
    return entry.count > limit;
}

/**
 * Чи можна слати лист на цю пошту просто зараз. Позначка ставиться ЛИШЕ тоді,
 * коли лист справді йде: інакше невдала спроба на неіснуючу адресу блокувала б
 * наступну, справжню.
 */
export function onEmailCooldown(
    store: Map<string, number>,
    email: string,
    cooldownMs: number,
    now: number = Date.now(),
): boolean {
    const last = store.get(email);
    return typeof last === 'number' && now - last < cooldownMs;
}

export function markEmailSent(store: Map<string, number>, email: string, now: number = Date.now()): void {
    store.set(email, now);
}

/**
 * Партнерський рядок у тому вигляді, в якому це рішення його потребує.
 */
export interface RecoveryCandidate {
    email: string | null;
    cabinet_token: string | null;
    status: string | null;
    agency_name?: string | null;
}

export type RecoveryAction =
    | { kind: 'ignore'; reason: 'bad_email' | 'not_found' | 'inactive' | 'no_token' | 'no_partner_email' }
    | { kind: 'send'; to: string; cabinetToken: string; agencyName: string | null };

/**
 * Що робити з поданою поштою. Уся логіка рішення тут, окремо від роуту, саме
 * щоб її можна було перевірити тестом, а не довірою до очей.
 *
 * ГОЛОВНЕ ПРАВИЛО ЖИВЕ В ТИПІ: адреса, на яку піде лист, береться з
 * `partner.email`, тобто з бази, і ніколи з того, що людина набрала у формі.
 * Різниця здається косметичною, бо партнера щойно шукали за тією ж адресою —
 * але саме вона відділяє «надіслати власнику» від «надіслати тому, хто знає
 * чужу пошту». Поки адресат приходить із рядка партнера, жодна майбутня правка
 * пошуку (збіг за старою адресою, за доменом, за схожістю) не перетворить
 * форму на видачу чужих кабінетів.
 *
 * Призупинений партнер відсіюється свідомо: його промокод на той час уже
 * вимкнений, тож обіцяти йому робочий кабінет означало б обіцяти те, чого
 * система не дотримає. Назовні ця відмова не відрізняється ні від якої іншої.
 */
export function decideCabinetRecovery(input: {
    submittedEmail: string | null | undefined;
    partner: RecoveryCandidate | null | undefined;
}): RecoveryAction {
    if (!normalizeEmail(input.submittedEmail)) return { kind: 'ignore', reason: 'bad_email' };
    const partner = input.partner;
    if (!partner) return { kind: 'ignore', reason: 'not_found' };
    if (String(partner.status || '').trim().toLowerCase() !== 'active') return { kind: 'ignore', reason: 'inactive' };
    if (!partner.cabinet_token) return { kind: 'ignore', reason: 'no_token' };

    const to = normalizeEmail(partner.email);
    if (!to) return { kind: 'ignore', reason: 'no_partner_email' };

    return { kind: 'send', to, cabinetToken: partner.cabinet_token, agencyName: partner.agency_name ?? null };
}

const SITE = 'https://touchmemories.com.ua';

/**
 * Лист із посиланням на кабінет.
 *
 * Свідомо коротший за вітальний: умови партнерства людина вже знає, їй потрібен
 * вхід. Окремим абзацом — як більше не залежати від листів: акаунт на цю саму
 * пошту і вхід через /uk/partner/cabinet.
 */
export function buildCabinetRecoveryEmail(input: { agencyName: string | null; cabinetToken: string; email: string }) {
    const cabinetLink = `${SITE}/uk/partner/${input.cabinetToken}`;
    const name = input.agencyName || 'партнере';
    const subject = 'Ваш партнерський кабінет touch.memories';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
        <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
          <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 12px">Вітаємо, ${name}!</h2>
          <p style="font-size:14px;color:#334155;margin:0 0 16px">Ви попросили посилання на свій партнерський кабінет, і ось воно. У кабінеті видно ваші нарахування, суму до виплати й реквізити для виведення коштів.</p>
          <div style="text-align:center;margin:18px 0"><a href="${cabinetLink}" style="display:inline-block;background:#263A99;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Відкрити партнерський кабінет</a></div>
          <p style="font-size:13px;color:#64748b;margin:0 0 16px">Це посилання відкриває кабінет без пароля, тому нікому його не пересилайте. Щоб більше не залежати від листів — <a href="${SITE}/uk/register" style="color:#263A99">створіть акаунт</a> на цю саму пошту (${input.email}), і далі заходьте через <a href="${SITE}/uk/partner/cabinet" style="color:#263A99">touchmemories.com.ua/uk/partner/cabinet</a>, кабінет привʼяжеться сам.</p>
          <p style="font-size:13px;color:#94a3b8;margin:0">Якщо посилання просили не ви, просто видаліть цей лист: доступ ні до чого іншого він не дає, а показати його ми могли тільки власнику цієї скриньки.</p>
        </div>
      </div>`;

    const text = [
        `Вітаємо, ${name}! Ось посилання на ваш партнерський кабінет touch.memories.`,
        cabinetLink,
        `Посилання відкриває кабінет без пароля, тому нікому його не пересилайте.`,
        `Щоб заходити без листів, створіть акаунт на цю саму пошту (${input.email}) і користуйтеся ${SITE}/uk/partner/cabinet.`,
    ].join('\n\n');

    return { subject, html, text };
}
