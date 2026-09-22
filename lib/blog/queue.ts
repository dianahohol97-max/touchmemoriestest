import { nextSlot } from './schedule';

/**
 * Черга публікацій блогу — читання і два записи, якими живе автопублікація.
 *
 * НАВІЩО ОКРЕМИЙ ФАЙЛ. Черги торкаються три місця: крон, який відкриває
 * статтю, адмінка з кнопками «Опублікувати зараз» і «Перенести», і скрипт
 * генерації, який ставить нову статтю в хвіст. Написати той самий `update`
 * тричі означало б рано чи пізно забути в одному з них `is_published` — а
 * забутий прапорець тут не видно нічим: стаття просто не зʼявляється, і
 * помітить це той, хто чекав її виходу.
 *
 * ТРИ ПОЛЯ ЗАВЖДИ РАЗОМ. Опублікована стаття має `status = 'published'`,
 * `is_published = true` і `published_at` у минулому. Гейт `onlyVisiblePosts`
 * перевіряє всі три, тож розбіжність між ними означає невидиму статтю, а не
 * половинчасто видиму. Саме тому публікація й зняття з публікації живуть тут
 * одними функціями, а не окремими викликами на місцях.
 */

export type BlogStatus = 'draft' | 'scheduled' | 'published';

/** Поля, яких вистачає, щоб показати чергу і прийняти рішення про публікацію. */
export const QUEUE_FIELDS = 'id, slug, title, status, publish_at, published_at, category_id, locale, cover_image';

export type QueuedPost = {
    id: string;
    slug: string;
    title: string;
    status: BlogStatus;
    publish_at: string | null;
    published_at: string | null;
    category_id: string | null;
    locale: string | null;
    cover_image: string | null;
};

type Db = any;

/** Уся черга попереду, від найближчої статті до найдальшої. */
export async function readQueue(db: Db): Promise<QueuedPost[]> {
    // Ліміту тут немає навмисно: черга — це одиниці статей, а не тисячі, і
    // будь-яка умова стоїть усередині запиту, а не у фільтрі після нього.
    const { data, error } = await db
        .from('blog_posts')
        .select(QUEUE_FIELDS)
        .eq('status', 'scheduled')
        .order('publish_at', { ascending: true });

    if (error) throw new Error(`не вдалося прочитати чергу блогу: ${error.message}`);
    return (data || []) as QueuedPost[];
}

/** Найстаріша стаття, чий час уже настав. Порожньо — черга ще чекає. */
export async function readDuePost(db: Db, now: Date = new Date()): Promise<QueuedPost | null> {
    const { data, error } = await db
        .from('blog_posts')
        .select(QUEUE_FIELDS)
        .eq('status', 'scheduled')
        .lte('publish_at', now.toISOString())
        .order('publish_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`не вдалося прочитати чергу блогу: ${error.message}`);
    return (data as QueuedPost) || null;
}

/**
 * Усе, що потрібно знати про статтю ПІСЛЯ публікації: які адреси скидати з
 * кешу і які надсилати в IndexNow.
 *
 * Живе тут, а не в кроні, з однієї причини: гейт видимості відсік би цей рядок
 * (на момент читання стаття ще в черзі), тож читання мусить бути прямим — а
 * прямі читання `blog_posts` поза адмінкою дозволені рівно в цьому файлі. Так
 * виняток лишається один, і перевірка в tests/blog-schedule.test.ts стереже
 * решту репозиторію без послаблень.
 */
export async function readPublishContext(db: Db, id: string): Promise<{
    translations: Record<string, any> | null;
    categorySlug: string | null;
}> {
    const { data } = await db
        .from('blog_posts')
        .select('translations, blog_categories(slug)')
        .eq('id', id)
        .maybeSingle();

    return {
        translations: (data?.translations as Record<string, any>) || null,
        categorySlug: (data as any)?.blog_categories?.slug || null,
    };
}

/**
 * Відкрити статтю.
 *
 * `published_at` береться з наміру, а не з моменту запуску крона: стаття,
 * запланована на сьому ранку, має показувати сьому ранку, навіть якщо крон
 * дістався до неї о восьмій. Порожній намір (публікація руками) падає на
 * «зараз».
 */
export async function publishNow(db: Db, post: { id: string; publish_at?: string | null }, now: Date = new Date()) {
    const intended = post.publish_at ? new Date(post.publish_at) : null;
    const publishedAt = intended && intended.getTime() <= now.getTime() ? intended : now;

    const { error } = await db
        .from('blog_posts')
        .update({
            status: 'published',
            is_published: true,
            published_at: publishedAt.toISOString(),
        })
        .eq('id', post.id);

    if (error) throw new Error(`не вдалося опублікувати статтю: ${error.message}`);
    return publishedAt;
}

/** Повернути статтю в чергу на конкретний час. */
export async function reschedule(db: Db, id: string, at: Date) {
    const { error } = await db
        .from('blog_posts')
        .update({
            status: 'scheduled',
            is_published: false,
            publish_at: at.toISOString(),
        })
        .eq('id', id);

    if (error) throw new Error(`не вдалося перенести статтю: ${error.message}`);
}

/**
 * Час для статті, яку щойно згенерували.
 *
 * Якір — остання запланована стаття, а якщо черга порожня, остання
 * опублікована. Кількість уже запланованих задає, котрий інтервал зараз по
 * черзі, тож послідовні запуски генератора вибудовують 2, 3, 2, 3 дні.
 */
export async function nextFreeSlot(db: Db, now: Date = new Date()): Promise<Date> {
    const queue = await readQueue(db);
    if (queue.length) {
        const last = queue[queue.length - 1];
        return nextSlot(last.publish_at ? new Date(last.publish_at) : null, queue.length, now);
    }

    const { data } = await db
        .from('blog_posts')
        .select('published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const anchor = data?.published_at ? new Date(data.published_at) : null;
    return nextSlot(anchor, 0, now);
}
