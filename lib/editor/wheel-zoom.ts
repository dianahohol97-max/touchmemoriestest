'use client';

import { useRef } from 'react';

/**
 * Колесо над фотографією масштабує тільки тоді, коли людина цього просила.
 *
 * ЧОМУ ЦЕ ІСНУЄ. У конструкторі колесо над фото міняло масштаб знімка всередині
 * рамки замість того, щоб прокрутити полотно. На TM-001352 це бачили і клієнтка,
 * і адміністраторка: курсор над сторінкою, прокрутка вниз, і замість наступного
 * розвороту фотографія зменшується, а навколо неї з'являються білі поля.
 *
 * Причин було дві, і вони складалися.
 *
 * Перша: обробники в BookLayoutEditor перевіряли `photoEditSlot !== key`, тобто
 * масштабували лише в режимі кадрування, але сам режим вмикався ОДНИМ кліком по
 * фото і не вимикався кліком повз. Після першого ж кліку знімок назавжди з'їдав
 * колесо під курсором. Скидання режиму лікується окремо, в редакторі.
 *
 * Друга живе тут: `e.preventDefault()` усередині React-обробника `onWheel` не
 * працює взагалі. React реєструє `wheel` (разом із `touchstart` і `touchmove`)
 * як passive — це видно в react-dom, у місці, де він додає слухача на корінь
 * застосунку. Тому захист, який мав утримати полотно, ніколи не спрацьовував:
 * фото масштабувалося І полотно прокручувалося водночас. Ту саму пастку вже
 * описали в PhotoPrintConstructor і обійшли там рідним слухачем; конструктор
 * книги обходу не мав.
 *
 * ЩО РОБИТЬ ЦЕЙ ФАЙЛ. Вішає рідний слухач із `passive: false`, тобто такий, у
 * якого `preventDefault()` має силу, і пропускає подію далі, коли масштабувати
 * не треба. Просте колесо над фото більше нічого не масштабує — сторінка
 * прокручується, як усюди. Масштаб міняють рівно два жести:
 *
 *   · колесо, коли слот У ЯВНОМУ режимі кадрування (`enabled`);
 *   · колесо з Ctrl або Cmd — сюди ж потрапляє щипок на трекпаді Mac, який
 *     браузер віддає як `wheel` із `ctrlKey: true`. Без `preventDefault()` цей
 *     щипок масштабував би всю сторінку браузера, а не фотографію.
 *
 * Крок масштабу пропорційний силі жесту. Колесо миші приходить кроком близько
 * ста пікселів і дає рівно ті 0,05, що були тут завжди, а щипок на трекпаді —
 * десятками дрібних подій по кілька пікселів, і фіксований крок проніс би
 * масштаб через увесь діапазон за пів секунди.
 */

/** Крок для звичайного кроку колеса миші (≈100 px). Такий самий, як був. */
export const WHEEL_ZOOM_STEP = 0.05;
const WHEEL_ZOOM_STEP_MIN = 0.01;
const WHEEL_ZOOM_STEP_MAX = 0.1;
/** Скільки пікселів `deltaY` вважаємо одним «кроком» колеса. */
const WHEEL_PIXELS_PER_STEP = 100;

/** На скільки змінити масштаб для цієї події колеса. Знак — напрямок. */
export function wheelZoomDelta(e: WheelEvent): number {
    const raw = (Math.abs(e.deltaY) / WHEEL_PIXELS_PER_STEP) * WHEEL_ZOOM_STEP;
    const step = Math.min(WHEEL_ZOOM_STEP_MAX, Math.max(WHEEL_ZOOM_STEP_MIN, raw));
    return e.deltaY > 0 ? -step : step;
}

/** Чи натиснуто модифікатор масштабу (він же щипок на трекпаді Mac). */
export function isZoomModifier(e: WheelEvent): boolean {
    return Boolean(e.ctrlKey || e.metaKey);
}

export interface WheelZoomOptions {
    /**
     * Слот у явному режимі кадрування. Тоді просте колесо теж масштабує —
     * людина сама в цей режим зайшла і бачить панель інструментів.
     */
    enabled: boolean;
    /** Застосувати зміну масштабу. Знак і величина вже враховані. */
    onZoom: (delta: number) => void;
}

/**
 * Прив'язувач слухачів. Повертає функцію `(key, options) => ref`, яку ставлять
 * на контейнер фотографії всередині слота.
 *
 * Посилання для одного ключа СТАЛЕ між рендерами, а свіжі `options` читаються з
 * мапи в момент події. Так зроблено навмисно: ref, який міняє себе щорендеру,
 * відчіплював би і чіпляв слухача на кожному кадрі перетягування, а слухач, що
 * замкнув `options` у собі один раз (як це було у FreeSlotLayer), працював би з
 * масштабом, застарілим на цілу сесію.
 */
export function useWheelZoomBinder() {
    const optsRef = useRef(new Map<string, WheelZoomOptions>());
    const refsRef = useRef(new Map<string, (el: HTMLElement | null) => (() => void) | void>());

    return (key: string, options: WheelZoomOptions) => {
        optsRef.current.set(key, options);
        let bind = refsRef.current.get(key);
        if (!bind) {
            bind = (el: HTMLElement | null) => {
                if (!el) return;
                const handler = (e: WheelEvent) => {
                    const cur = optsRef.current.get(key);
                    if (!cur) return;
                    if (!cur.enabled && !isZoomModifier(e)) return; // полотно прокручується
                    e.preventDefault();
                    e.stopPropagation();
                    cur.onZoom(wheelZoomDelta(e));
                };
                el.addEventListener('wheel', handler, { passive: false });
                return () => el.removeEventListener('wheel', handler);
            };
            refsRef.current.set(key, bind);
        }
        return bind;
    };
}
