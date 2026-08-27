/**
 * Відстеження листів розсилки: відкриття і переходи.
 *
 * Два показники, і вони дуже різні за надійністю.
 *
 * ВІДКРИТТЯ — це прозорий піксель у листі. Число завжди ЗАВИЩЕНЕ: Apple Mail
 * Privacy Protection підвантажує всі картинки за користувача, ще до того як він
 * відкриє лист, а іноді й якщо не відкриє взагалі. Приблизно так само роблять
 * корпоративні антивіруси. Тому «відкрито 60 %» означає «стільки поштових
 * програм торкнулося картинки», а не «стільки людей прочитало».
 *
 * ПЕРЕХОДИ — це клік по кнопці в листі. Його ніхто за людину не робить, тож
 * саме це число варте довіри. Коли два показники розходяться, вірити треба
 * переходам.
 *
 * Обидва прив'язані до рядка черги, а не до адреси: у посиланні їде id рядка,
 * а не пошта, тож переслане комусь посилання нічиєї адреси не відкриває.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');

/** Прозорий піксель у кінці листа. */
export function trackingPixel(queueId: string): string {
    if (!queueId) return '';
    return `<img src="${SITE_URL}/api/email/open?q=${encodeURIComponent(queueId)}" `
        + `width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`;
}

/** Загортає посилання так, щоб перехід рахувався, а людина потрапила куди йшла. */
export function trackedLink(queueId: string, target: string): string {
    if (!queueId) return target;
    return `${SITE_URL}/api/email/click?q=${encodeURIComponent(queueId)}&u=${encodeURIComponent(target)}`;
}
