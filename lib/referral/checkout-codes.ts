/**
 * Який код підставляє чекаут і що з нього йде в атрибуцію.
 *
 * Логіка винесена сюди з app/[locale]/checkout/page.tsx, бо вона єдина в
 * ланцюжку, яка стосується ВСІХ замовлень, а не тільки партнерських. Той самий
 * шматок вирішує долю коду з листа розсилки і долю порожнього кошика, тож
 * помилка в ньому коштувала б не комісії партнера, а знижки, обіцяної в листі,
 * або зламаного чекауту взагалі. Чистою функцією її можна перевірити тестом;
 * усередині ефекту — лише очима.
 *
 * ДВА РЕЗУЛЬТАТИ, І ЦЕ НЕ ОДНЕ Й ТЕ САМЕ.
 *
 * `code` — що пробувати застосувати як знижку. `partnerCode` — чия це комісія.
 * У старій моделі обидві ролі ніс один рядок, і тому відмова від знижки
 * забирала в партнера комісію, а введений поверх промокод — тим паче.
 *
 * ПОРЯДОК ДЖЕРЕЛ збережено від старої версії дослівно, бо він уже обдуманий:
 * спершу ?promo= в адресі, далі партнерський код (із ?ref= або відкладений), і
 * лише останнім — акційний код, відкладений із листа. Останнім саме тому, що
 * партнерський означає комісію агенції, і код із розсилки не має права її
 * перебивати.
 */

/** Партнерські коди бувають кирилицею — їх генерують із назв агенцій. */
const CODE_RE = /^[A-Za-z0-9А-ЯІЇЄҐа-яіїєґ]{4,16}$/;

export interface CheckoutCodeSources {
    /** ?promo= з адреси сторінки. */
    urlPromo?: string | null;
    /** ?ref= з адреси сторінки. */
    urlRef?: string | null;
    /** Відкладений реферальний код, уже перевірений на 90-денний строк. */
    storedRef?: string | null;
    /** Відкладений акційний код із листа, уже перевірений на свій строк. */
    storedPromo?: string | null;
}

export interface CheckoutCodes {
    /** Код, який пробуємо застосувати як знижку; порожній рядок — нічого. */
    code: string;
    /** Код партнера для атрибуції; порожній рядок — партнера немає. */
    partnerCode: string;
}

const clean = (value: string | null | undefined): string =>
    String(value ?? '').trim().toUpperCase();

/** Чи схожий рядок на код узагалі. Та сама перевірка, що в решті ланцюжка. */
export function isCheckoutCodeShaped(code: string | null | undefined): boolean {
    return CODE_RE.test(clean(code));
}

export function selectCheckoutCodes(sources: CheckoutCodeSources): CheckoutCodes {
    const urlPromo = clean(sources.urlPromo);
    const urlRef = clean(sources.urlRef);
    const storedRef = clean(sources.storedRef);
    const storedPromo = clean(sources.storedPromo);

    // Партнерський код збирається НЕЗАЛЕЖНО від того, яку знижку застосують:
    // він відповідає за комісію. Свіжий перехід (?ref=) важить більше за
    // відкладений, бо це те, що людина зробила щойно.
    const partnerCode = isCheckoutCodeShaped(urlRef)
        ? urlRef
        : isCheckoutCodeShaped(storedRef) ? storedRef : '';

    // Знижка: адресний ?promo=, далі партнерський, далі код із листа.
    let code = isCheckoutCodeShaped(urlPromo) ? urlPromo : '';
    if (!code) code = partnerCode;
    if (!code && isCheckoutCodeShaped(storedPromo)) code = storedPromo;

    return { code, partnerCode };
}
