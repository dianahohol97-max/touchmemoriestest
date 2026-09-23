'use client';

/**
 * Піпетка: колір пікселя з КАРТИНКИ, а не зі знімка полотна.
 *
 * ЧОМУ НЕ ВБУДОВАНИЙ EyeDropper. Він є лише в Chrome і Edge на комп'ютері, а
 * на телефоні його немає зовсім — тобто більшість клієнток лишилася б без
 * піпетки. Крім того він читає колір з ЕКРАНА, тобто після колірного
 * керування системи, і повернуте число може не збігтися з тим, що лежить у
 * файлі. Нам потрібне саме те, що піде в друк.
 *
 * ЧОМУ НЕ ЗНІМОК ПОЛОТНА. Полотно показує зменшену копію під зумом; піксель на
 * ньому це вже усереднення сусідів, та ще й зі згладжуванням браузера. Тому
 * клік переводиться в координати ОРИГІНАЛЬНОГО зображення, і читається саме
 * воно.
 *
 * ПРО «TAINTED CANVAS». Канва, у яку намальоване чуже зображення без дозволу
 * CORS, перестає віддавати пікселі. Сховище Supabase віддає
 * access-control-allow-origin: *, тож `crossOrigin = 'anonymous'` спрацьовує —
 * це вже перевірено підказкою кольору обкладинки, яка тим самим способом читає
 * картинки каталогу. Але читаємо ми ВЛАСНУ копію зображення, а не той елемент,
 * що стоїть на полотні: якщо браузер поклав у кеш відповідь без заголовків
 * CORS, спроба намалювати саме той елемент упала б, а окремий запит у режимі
 * CORS браузер робить наново. Свіжозавантажені фото живуть як blob:, там
 * питання CORS не виникає взагалі.
 *
 * Будь-яка невдача повертає null. Мовчки підставити неправильний колір гірше,
 * ніж чесно сказати, що не вийшло: помітили б це аж на друкованій обкладинці.
 */

/** Радіус усереднення в пікселях оригіналу. Один піксель на стиснутому JPEG — лотерея. */
const SAMPLE_RADIUS = 3;

const corsCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadCorsImage(src: string): Promise<HTMLImageElement | null> {
    const cached = corsCache.get(src);
    if (cached) return cached;
    const p = new Promise<HTMLImageElement | null>(resolve => {
        try {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        } catch { resolve(null); }
    });
    corsCache.set(src, p);
    return p;
}

const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

/**
 * Точка кліку в координатах НЕТРАНСФОРМОВАНОЇ коробки елемента.
 *
 * Слоти фото на обкладинці несуть `transform: scale(...) rotate(...)` навколо
 * центру, і getBoundingClientRect віддає вже повернуту рамку. Центр при
 * повороті й масштабі навколо центру не рухається, тож рахуємо зсув від
 * центру і розвертаємо його зворотною матрицею.
 */
function localPoint(el: HTMLElement, clientX: number, clientY: number): { x: number; y: number } | null {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!(w > 0 && h > 0)) return null;
    const rect = el.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;

    let own = 'none';
    try { own = window.getComputedStyle(el).transform || 'none'; } catch { /* лишаємо none */ }

    // Без власної трансформації рамка і коробка відрізняються хіба що
    // масштабом предка, і тоді проста пропорція точніша за будь-яку матрицю.
    if (own === 'none') {
        const x0 = (clientX - rect.left) * (w / rect.width);
        const y0 = (clientY - rect.top) * (h / rect.height);
        return (x0 < 0 || y0 < 0 || x0 > w || y0 > h) ? null : { x: x0, y: y0 };
    }

    // Масштаб і поворот у нас навколо центру, а центр при таких перетвореннях
    // не рухається. Тож рахуємо зсув від центру і розвертаємо його зворотною
    // матрицею.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx, dy = clientY - cy;
    try {
        if (typeof DOMMatrix !== 'undefined') {
            const inv = new DOMMatrix(own).inverse();
            const p = inv.transformPoint(new DOMPoint(dx, dy));
            dx = p.x; dy = p.y;
        }
    } catch { /* без матриці лишаємося на нетрансформованих координатах */ }
    const x = dx + w / 2, y = dy + h / 2;
    if (x < 0 || y < 0 || x > w || y > h) return null;
    return { x, y };
}

/** Точка в координатах ОРИГІНАЛУ зображення з урахуванням objectFit і objectPosition. */
function sourcePoint(img: HTMLImageElement, local: { x: number; y: number }): { x: number; y: number } | null {
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const bw = img.offsetWidth, bh = img.offsetHeight;
    if (!(nw > 0 && nh > 0 && bw > 0 && bh > 0)) return null;

    const cs = window.getComputedStyle(img);
    const fit = cs.objectFit || 'fill';
    let sx: number, sy: number;
    if (fit === 'cover' || fit === 'contain' || fit === 'scale-down') {
        const k = fit === 'cover'
            ? Math.max(bw / nw, bh / nh)
            : Math.min(bw / nw, bh / nh, fit === 'scale-down' ? 1 : Infinity);
        const dw = nw * k, dh = nh * k;
        const [px, py] = parseObjectPosition(cs.objectPosition, bw, bh, dw, dh);
        sx = (local.x - px) / k;
        sy = (local.y - py) / k;
    } else if (fit === 'none') {
        const [px, py] = parseObjectPosition(cs.objectPosition, bw, bh, nw, nh);
        sx = local.x - px;
        sy = local.y - py;
    } else {
        sx = local.x / bw * nw;
        sy = local.y / bh * nh;
    }
    if (sx < 0 || sy < 0 || sx >= nw || sy >= nh) return null;
    return { x: sx, y: sy };
}

/** `50% 50%`, `left top`, `20px 4px` — усе, що браузер віддає обчисленим. */
function parseObjectPosition(value: string, boxW: number, boxH: number, drawW: number, drawH: number): [number, number] {
    const parts = String(value || '50% 50%').trim().split(/\s+/);
    const one = (raw: string, box: number, draw: number): number => {
        const v = String(raw || '50%');
        if (v.endsWith('%')) return (box - draw) * (parseFloat(v) / 100);
        if (v.endsWith('px')) return parseFloat(v);
        if (v === 'left' || v === 'top') return 0;
        if (v === 'right' || v === 'bottom') return box - draw;
        if (v === 'center') return (box - draw) / 2;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : (box - draw) / 2;
    };
    return [one(parts[0], boxW, drawW), one(parts[1] ?? parts[0], boxH, drawH)];
}

/** Середній колір навколо точки оригіналу, або null, якщо канва не віддала пікселі. */
async function readColorAt(src: string, x: number, y: number): Promise<string | null> {
    const img = await loadCorsImage(src);
    if (!img) return null;
    try {
        const r = SAMPLE_RADIUS;
        const size = r * 2 + 1;
        const sx = Math.max(0, Math.min(img.naturalWidth - size, Math.round(x) - r));
        const sy = Math.max(0, Math.min(img.naturalHeight - size, Math.round(y) - r));
        const w = Math.min(size, img.naturalWidth);
        const h = Math.min(size, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let rr = 0, gg = 0, bb = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            rr += data[i]; gg += data[i + 1]; bb += data[i + 2]; n++;
        }
        if (!n) return null;
        return '#' + hex2(rr / n) + hex2(gg / n) + hex2(bb / n);
    } catch {
        // Саме сюди приводить зіпсована канва. Каже про це виклик, не ми.
        return null;
    }
}

export type PickResult =
    | { ok: true; hex: string }
    | { ok: false; reason: 'no-image' | 'unreadable' };

/**
 * Колір у точці екрана, узятий із картинки під нею.
 *
 * Картинки перебираються у зворотному порядку документа, тобто верхня має
 * перевагу: фото клієнтки лежить над готовою обкладинкою і в розмітці стоїть
 * пізніше. Хіт-тестом браузера користуватися не можна — картинки на полотні
 * навмисно мають pointer-events: none, щоб не заважати перетягуванню, а
 * elementsFromPoint такі елементи пропускає.
 */
export async function pickColorAt(
    container: HTMLElement | null,
    clientX: number,
    clientY: number,
): Promise<PickResult> {
    if (!container) return { ok: false, reason: 'no-image' };
    const images = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        if (!img.src || !img.complete || !img.naturalWidth) continue;
        const local = localPoint(img, clientX, clientY);
        if (!local) continue;
        const src = sourcePoint(img, local);
        if (!src) continue;
        const hex = await readColorAt(img.src, src.x, src.y);
        return hex ? { ok: true, hex } : { ok: false, reason: 'unreadable' };
    }
    return { ok: false, reason: 'no-image' };
}
