import { getLocalized } from '@/lib/i18n/localize';
import { LOCALES, stripBrandSuffix, type Locale } from '@/lib/seo/locales';

/**
 * Читання статті для публічної сторінки: мови, мета-теги, товари.
 *
 * НАВІЩО ОКРЕМИЙ ФАЙЛ. Сторінка статті, генерація OG-картинки, RSS, sitemap і
 * `llms.txt` беруть із посту те саме — заголовок, опис, набір мов, — і щойно
 * кожен порахує це по-своєму, у видачі зʼявиться один текст, а на сторінці
 * інший. Найдорожча з цих розбіжностей — набір мов: hreflang, який обіцяє
 * переклад, тоді як за адресою лежить український текст, це не «запасний
 * варіант», а дубль, про який ми повідомили самі.
 */

/** Довжина мета-тегів, з якою рахується пошукова видача. */
export const META_TITLE_MAX = 60;
export const META_DESCRIPTION_MIN = 140;
export const META_DESCRIPTION_MAX = 160;

/**
 * Мови, якими стаття СПРАВДІ існує.
 *
 * Базова мова береться з `locale`, решта — з ключів `translations`, але лише
 * тих, де є і заголовок, і тіло. Порожній обʼєкт перекладу (а такі заводяться
 * автоматично, коли хтось відкрив вкладку мови й нічого не написав) не робить
 * статтю перекладеною.
 */
export function postLocales(post: any): Locale[] {
    const base = ((post?.locale || 'uk') as Locale);
    const known = new Set<Locale>([base]);

    const translations = (post?.translations || {}) as Record<string, any>;
    for (const [key, value] of Object.entries(translations)) {
        if (!(LOCALES as readonly string[]).includes(key)) continue;
        const hasTitle = typeof value?.title === 'string' && value.title.trim().length > 0;
        const hasBody = typeof value?.content === 'string' && value.content.trim().length > 0;
        if (hasTitle && hasBody) known.add(key as Locale);
    }

    return LOCALES.filter(l => known.has(l));
}

/** Чи має стаття текст цією мовою — чи відвідувач побачить базову. */
export function hasLocale(post: any, locale: Locale): boolean {
    return postLocales(post).includes(locale);
}

/**
 * Заголовок для `<title>`.
 *
 * Рветься по слову, а не по символу: обрізане посередині слово в видачі
 * виглядає як помилка сайту. Бренд додається сторінкою окремо, тому тут він
 * зрізається — у базі половина `meta_title` уже несе «| Touch.Memories», і
 * без цього кроку суфікс друкувався двічі.
 */
export function metaTitle(post: any, locale: Locale): string {
    const tr = ((post?.translations || {}) as any)[locale] || {};
    const raw = String(
        tr.meta_title || post?.meta_title || tr.title || getLocalized(post, locale, 'title') || '',
    );
    return clampWords(stripBrandSuffix(raw), META_TITLE_MAX);
}

/**
 * Опис для `<meta name="description">`.
 *
 * Google ріже довші за ~160 символів, а коротші за ~140 частіше замінює своїм
 * фрагментом зі сторінки. Тому короткий опис доповнюється початком статті, а
 * не лишається обрубком у два слова.
 */
export function metaDescription(post: any, locale: Locale): string {
    const tr = ((post?.translations || {}) as any)[locale] || {};
    let text = String(
        tr.meta_description || post?.meta_description || tr.excerpt || getLocalized(post, locale, 'excerpt') || '',
    ).replace(/\s+/g, ' ').trim();

    if (text.length < META_DESCRIPTION_MIN) {
        const body = plainTextLead(getLocalized(post, locale, 'content') || '');
        if (body) text = `${text} ${body}`.replace(/\s+/g, ' ').trim();
    }

    return clampWords(text, META_DESCRIPTION_MAX);
}

/** Перші речення тіла статті без розмітки — щоб доповнити короткий опис. */
function plainTextLead(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}#{1,6}\s+.*$/gm, ' ')
        .replace(/[*_`>#|-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, META_DESCRIPTION_MAX * 2);
}

/** Ріже по межі слова, не лишаючи хвостової пунктуації. */
export function clampWords(text: string, max: number): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;

    const cut = clean.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    // Слово, довше за ліміт, різати по пробілу нема де — тоді ріжемо як є.
    const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
    return body.replace(/[\s.,;:—–-]+$/u, '');
}

export type ProductCard = {
    id: string;
    slug: string;
    name: string;
    price: number | null;
    image: string | null;
};

/**
 * Картки товарів для блоку «Що з цього можна зробити».
 *
 * Два джерела навмисно. Нові статті пишуть `related_product_slugs` — slug
 * читається очима в адмінці й переживає перенесення бази, — а шістнадцять
 * наявних статей мають `related_product_ids` з uuid. Підтримувати обидва
 * дешевше, ніж мігрувати uuid у slug і виявити через місяць, що десь лишився
 * порожній блок.
 *
 * Неактивні товари відсіюються в САМОМУ запиті: стаття, яка веде на знятий з
 * продажу товар, гірша за статтю без блоку товарів.
 */
export async function loadProductCards(db: any, post: any, limit = 3): Promise<ProductCard[]> {
    const slugs: string[] = Array.isArray(post?.related_product_slugs) ? post.related_product_slugs : [];
    const ids: string[] = Array.isArray(post?.related_product_ids) ? post.related_product_ids : [];
    if (!slugs.length && !ids.length) return [];

    const columns = 'id, slug, name, price, images, translations';
    const rows: any[] = [];

    if (slugs.length) {
        const { data } = await db.from('products').select(columns)
            .in('slug', slugs.slice(0, limit * 2)).eq('is_active', true);
        rows.push(...(data || []));
    }
    if (ids.length && rows.length < limit) {
        const { data } = await db.from('products').select(columns)
            .in('id', ids.slice(0, limit * 2)).eq('is_active', true);
        rows.push(...(data || []));
    }

    const seen = new Set<string>();
    const cards: ProductCard[] = [];
    // Порядок задає стаття, а не база: спершу те, що назвав автор слагами.
    const order = [...slugs, ...ids];
    rows.sort((a, b) => {
        const ai = Math.min(...[order.indexOf(a.slug), order.indexOf(a.id)].filter(i => i >= 0).concat(999));
        const bi = Math.min(...[order.indexOf(b.slug), order.indexOf(b.id)].filter(i => i >= 0).concat(999));
        return ai - bi;
    });

    for (const row of rows) {
        if (seen.has(row.id) || cards.length >= limit) continue;
        seen.add(row.id);
        cards.push({
            id: row.id,
            slug: row.slug,
            name: row.name,
            price: typeof row.price === 'number' ? row.price : null,
            image: Array.isArray(row.images) && row.images[0] ? row.images[0] : null,
        });
    }

    return cards;
}

/**
 * Прев'ю чернетки за секретним посиланням.
 *
 * Порівняння посимвольне і довжина звіряється окремо, щоб порожній
 * `BLOG_PREVIEW_SECRET` не відкривав чернетки всім підряд — без цієї перевірки
 * відсутня змінна означала б `'' === ''` на запит без токена.
 */
export function isPreviewToken(token: string | null | undefined): boolean {
    const secret = process.env.BLOG_PREVIEW_SECRET;
    if (!secret || !token) return false;
    if (secret.length !== token.length) return false;

    let diff = 0;
    for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ token.charCodeAt(i);
    return diff === 0;
}
