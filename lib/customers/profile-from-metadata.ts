/**
 * Ім'я і дата народження з метаданих auth-користувача.
 *
 * Картку клієнта створює тригер handle_new_auth_user, і він бере лише
 * COALESCE(meta->>'name', meta->>'full_name'). Усе інше, що людина ввела при
 * реєстрації, лишається в auth.users.raw_user_meta_data і до public.customers
 * не доходить ніколи. Наслідки на 14.09.2026:
 *
 *   * 310 карток із 1280 без імені, з них 288 мають first_name у метаданих —
 *     його клав AuthModal, а тригер такого ключа не знає;
 *   * 35 людей ввели дату народження, і в базі вона рівно в нуля з них. П'ять
 *     заповнених дат прийшли іншим шляхом. Крон привітань через це працював
 *     на порожньому місці;
 *   * ще 31 картка має ім'я в метаданих, але порожнє в базі: у тригера є
 *     гілка, яка при наявному рядку з такою поштою прив'язує auth_user_id і
 *     ім'я НЕ чіпає взагалі.
 *
 * Функція одна на два боки: її кличе auth callback для кожного, хто входить, і
 * разовий прохід для тих, хто вже зареєстрований. Двох копій правила бути не
 * має — саме так розійшлися дві копії правила «оплачено повністю».
 *
 * Ніколи не ПЕРЕЗАПИСУЄ заповнене. Людина могла виправити ім'я в кабінеті, і
 * метадані з моменту реєстрації не мають права це відкотити.
 */

export interface ProfilePatch {
    name?: string;
    birthday?: string;
}

/** Рядок, який справді щось містить. Інакше null. */
function text(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const s = v.trim().replace(/\s+/g, ' ');
    return s.length > 0 ? s : null;
}

/**
 * Ім'я з метаданих, у порядку надійності.
 *
 * name і full_name кладуть Google і сторінка /register. first_name з
 * last_name — AuthModal; last_name він не збирає взагалі, тож зазвичай
 * лишається саме ім'я без прізвища, і це нормально: краще «Оксана», ніж
 * порожньо.
 */
export function nameFromMetadata(meta: any): string | null {
    if (!meta || typeof meta !== 'object') return null;
    const direct = text(meta.name) ?? text(meta.full_name);
    if (direct) return direct;
    const first = text(meta.first_name);
    const last = text(meta.last_name);
    const joined = [first, last].filter(Boolean).join(' ');
    return text(joined);
}

/**
 * Дата народження з метаданих.
 *
 * Приймається лише повний ISO-вигляд РРРР-ММ-ДД і лише правдоподібна дата:
 * усі 35 наявних значень саме такі. Вгадувати формати на кшталт 05.11.1990 не
 * будемо — дата народження потрапляє в привітальні листи, і помилка тут
 * означає лист не в той день.
 */
export function birthdayFromMetadata(meta: any): string | null {
    if (!meta || typeof meta !== 'object') return null;
    const raw = text(meta.birthday);
    if (!raw) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!m) return null;

    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 1900 || y > new Date().getUTCFullYear()) return null;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

    // 31 лютого проходить перевірку вище, але датою не є.
    const probe = new Date(Date.UTC(y, mo - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;

    return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Чого бракує в картці і що з цього можна взяти з метаданих.
 *
 * Порожній результат означає «нічого не робити» — саме так і має бути для
 * переважної більшості входів.
 */
export function profilePatchFromMetadata(
    customer: { name?: unknown; birthday?: unknown },
    meta: any,
): ProfilePatch {
    const patch: ProfilePatch = {};

    if (!text(customer?.name)) {
        const n = nameFromMetadata(meta);
        if (n) patch.name = n;
    }
    if (!text(customer?.birthday)) {
        const b = birthdayFromMetadata(meta);
        if (b) patch.birthday = b;
    }
    return patch;
}
