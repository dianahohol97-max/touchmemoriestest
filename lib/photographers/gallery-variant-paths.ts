/**
 * Зменшені копії фото клієнтської галереї: які розміри, де лежать і коли їх
 * треба видаляти.
 *
 * ЧОМУ ЦЕ ІСНУЄ. До 24.09.2026 сітка галереї показувала оригінали. Галерея
 * Ірини Владової — 280 фото на 3,66 ГБ, найбільше близько 21 МБ, і людина,
 * яка догортала сітку до кінця, тягнула всі 3,66 ГБ, а браузер розкодовував
 * десятки мегапікселів заради тайла в кількасот пікселів. На телефоні з
 * мобільним інтернетом це хвилини і ризик, що вкладка впаде. Це гоча 19 із
 * CLAUDE.md, тільки в галереях: для редактора її вилікували 20.09 через
 * lib/editor/photo-variant-paths.ts, сюди не перенесли.
 *
 * ЧОМУ ОДИН МОДУЛЬ БЕЗ ВАЖКИХ ІМПОРТІВ. Ті самі шляхи потрібні тому, хто пише
 * копії (sharp на сервері), тим, хто їх читає (API галереї, кабінет, лендинг),
 * і тим, хто їх видаляє (крон очищення, видалення фото, demo-seed). Шлях,
 * порахований по-різному в двох місцях, означає копію, яку ніхто не знайде, —
 * або, гірше, копію, яку ніхто не видалить і яка лишиться в R2 сиротою.
 *
 * ОРИГІНАЛ НЕ ЗАМІНЯЄТЬСЯ НІДЕ. `storage_path` лишається для завантаження
 * поштучно й архівом, а в квоту фотографа рахується тільки `size_bytes`
 * оригіналу. Вага копій пишеться окремо, у `variant_bytes`.
 */

/**
 * Довгі сторони копій, від меншої до більшої.
 *
 *   640  — сітка на компʼютері і планшеті (три-дві колонки по 300–460 px,
 *          на екрані з подвійною щільністю це 600–920 px по ширині тайла),
 *          мініатюри в кабінеті і на лендингу;
 *   1280 — сітка на телефоні: там одна колонка на всю ширину, 390 px на
 *          щільності 3 — це 1170 px, і 640 були б помітно мильні;
 *   2048 — лайтбокс і обкладинка на весь екран: лайтбокс обмежено 1600 px
 *          CSS, обкладинка на ноутбуці з подвійною щільністю просить
 *          2880 px, і 2048 — компроміс між різкістю і вагою.
 *
 * Браузер обирає сам через srcset, тож телефон не тягне 2048, а компʼютер не
 * отримує 640 на весь екран.
 */
export const GALLERY_VARIANT_EDGES = [640, 1280, 2048] as const;
export type GalleryVariantEdge = typeof GALLERY_VARIANT_EDGES[number];

/** Якість JPEG (mozjpeg). Для мініатюри трохи нижча — там її не видно. */
export const GALLERY_VARIANT_QUALITY: Record<GalleryVariantEdge, number> = {
  640: 76,
  1280: 80,
  2048: 82,
};

/**
 * Скільки разів пробувати зробити копії для фото, яке не піддається, і скільки
 * чекати між спробами. Без межі побитий файл або формат, якого не бере sharp
 * (HEIC), лишався б у черзі назавжди і щоразу їв би час функції.
 */
export const GALLERY_VARIANT_MAX_TRIES = 3;
export const GALLERY_VARIANT_RETRY_MS = 10 * 60 * 1000;

/**
 * `ph/gal/1727_IMG_1.jpg` + 640 → `ph/gal/_v640/1727_IMG_1.jpg.jpg`.
 *
 * Окрема тека, а не суфікс в імені: імена оригіналів задає людина, і суфікс
 * `_w640` міг би збігтися з іменем чужого оригіналу. Повне імʼя оригіналу
 * разом із розширенням плюс `.jpg` робить відображення однозначним: `a.png`
 * і `a.jpg` не зіллються в одну копію. Копія завжди JPEG, тому `.jpg` у кінці.
 */
export function galleryVariantPath(originalPath: string, edge: GalleryVariantEdge): string {
  const slash = originalPath.lastIndexOf('/');
  const dir = slash >= 0 ? originalPath.slice(0, slash + 1) : '';
  const base = slash >= 0 ? originalPath.slice(slash + 1) : originalPath;
  return `${dir}_v${edge}/${base}.jpg`;
}

export function allGalleryVariantPaths(originalPath: string): string[] {
  return GALLERY_VARIANT_EDGES.map(e => galleryVariantPath(originalPath, e));
}

/**
 * Які копії існують для фото таких розмірів.
 *
 * Копія робиться тільки там, де оригінал більший за її межу: розтягувати
 * маленький оригінал до 2048 означало б важчий файл без жодного пікселя
 * користі. Це ЄДИНЕ правило і для того, хто пише, і для того, хто читає,
 * тому в базі не треба зберігати перелік копій — досить розмірів оригіналу.
 */
export function variantEdgesFor(width: number | null | undefined, height: number | null | undefined): GalleryVariantEdge[] {
  const longest = Math.max(Number(width) || 0, Number(height) || 0);
  if (!(longest > 0)) return [];
  return GALLERY_VARIANT_EDGES.filter(e => longest > e);
}

/** Сторони копії з межею `edge` для оригіналу `width`×`height`. */
export function variantSize(width: number, height: number, edge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!(longest > edge)) return { width, height };
  const scale = edge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Поля рядка photographer_gallery_photos, які потрібні для роботи з копіями. */
export interface VariantRow {
  storage_path: string | null;
  storage_provider?: string | null;
  media_type?: string | null;
  width?: number | null;
  height?: number | null;
  variants_at?: string | null;
  variant_tries?: number | null;
  variant_tried_at?: string | null;
}

/** Колонки, які треба вибрати, щоб решта функцій цього модуля працювала. */
export const VARIANT_COLUMNS = 'width, height, variants_at, variant_tries';

/**
 * Чи могли для цього рядка вже лягти копії в сховище.
 *
 * Генератор ставить `variant_tries` ДО першого запису у сховище (див.
 * gallery-variants-server.ts), тож рядок без обох позначок копій не має. Для
 * такого рядка видалення не питає сховище про копії зовсім: для Supabase кожен
 * відсутній файл — це окремий запит `list()`, і галерея на дві тисячі старих
 * фото без копій інакше не вклалася б у хвилину крона.
 */
export function mayHaveVariants(row: VariantRow): boolean {
  return !!row.variants_at || (Number(row.variant_tries) || 0) > 0;
}

/**
 * Усі файли, які треба стерти зі сховища разом із цим фото: оригінал плюс
 * УСІ шляхи копій, якщо копії могли бути.
 *
 * Шляхи беруться всі три, а не лише ті, що випливають із розмірів: спроба могла
 * обірватися посередині, до запису розмірів. Відсутній файл при видаленні — не
 * помилка: R2 відповідає на ключ, якого немає, як на видалений, а Supabase
 * пропускає його і removeFiles перевіряє, що його справді немає
 * (tests/gallery-variants.test.ts). Копії живуть у того ж провайдера, що й
 * оригінал, тож провайдер береться з рядка.
 */
export function galleryFilesToRemove(row: VariantRow): { path: string; provider: string | null }[] {
  if (!row.storage_path) return [];
  const provider = row.storage_provider ?? null;
  const out = [{ path: row.storage_path, provider }];
  if (mayHaveVariants(row)) {
    for (const p of allGalleryVariantPaths(row.storage_path)) out.push({ path: p, provider });
  }
  return out;
}

/**
 * Чи варто зараз робити копії для цього рядка. Та сама умова стоїть у запиті
 * черги (gallery-variants-server.ts) — там вона фільтрує ДО ліміту (гоча 13),
 * а тут перевіряє кожен рядок перед роботою.
 */
export function rowNeedsVariants(row: VariantRow, now: number = Date.now()): boolean {
  if (!row.storage_path) return false;
  if ((row.media_type || 'photo') !== 'photo') return false; // відео не чіпаємо
  if (row.variants_at) return false;
  if ((Number(row.variant_tries) || 0) >= GALLERY_VARIANT_MAX_TRIES) return false;
  const tried = row.variant_tried_at ? Date.parse(row.variant_tried_at) : NaN;
  if (Number.isFinite(tried) && tried <= now && now - tried < GALLERY_VARIANT_RETRY_MS) return false;
  return true;
}

/** Одне джерело для srcset: ширина в пікселях і адреса. */
export interface ImageSource { w: number; url: string }

/**
 * Джерела зображення для екрана, від меншого до більшого.
 *
 * Порожній список означає «копій немає, показуй оригінал» — так виглядає
 * кожне фото до бекфілу, і сітка від цього не ламається. Коли копії є, в
 * список іде і сам оригінал, але ТІЛЬКИ якщо він не більший за найбільшу
 * копію (тобто копії 2048 для нього не робилося): тоді він і є найкраща
 * екранна версія, і важить він небагато. Великий оригінал у srcset не йде
 * ніколи, бо браузер на 4K-моніторі радо обрав би саме його.
 */
export function gallerySources(
  row: VariantRow,
  urlFor: (path: string) => string,
  originalUrl: string,
): ImageSource[] {
  if (!row.variants_at || !row.storage_path) return [];
  const w = Number(row.width) || 0;
  const h = Number(row.height) || 0;
  if (!(w > 0 && h > 0)) return [];
  const edges = variantEdgesFor(w, h);
  const out: ImageSource[] = edges.map(e => ({
    w: variantSize(w, h, e).width,
    url: urlFor(galleryVariantPath(row.storage_path as string, e)),
  }));
  if (edges.length < GALLERY_VARIANT_EDGES.length) out.push({ w, url: originalUrl });
  return out;
}
