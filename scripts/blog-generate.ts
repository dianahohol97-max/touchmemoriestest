/**
 * Генерація однієї статті блогу і постановка її в чергу.
 *
 * ЗАПУСК:
 *   npm run blog:generate -- --list
 *   npm run blog:generate -- <id-теми>
 *   npm run blog:generate -- <id-теми> --dry
 *
 * ОДНА КОМАНДА — ОДНА СТАТТЯ. Так Діана бачить кожну перед тим, як вона піде в
 * чергу, а не читає дванадцять наздогін. Пакетний режим тут свідомо
 * відсутній: черга наповнюється раз на кілька днів, поспішати нікуди, а
 * дванадцять згенерованих за раз статей ніхто ніколи не перечитує повністю.
 *
 * ЩО СКРИПТ ПЕРЕВІРЯЄ ПЕРЕД ЗАПИСОМ:
 *   1. Кожна цільова сторінка теми існує і жива — товар активний, у категорії
 *      є товари, лендінг увімкнений. Вигаданий слаг виглядає як робоче
 *      посилання рівно до кліку, і в статті його ніхто не перевіряє очима.
 *   2. Слаг статті вільний і латиницею.
 *   3. У тексті немає заборонених слів і немає цифр, які виглядають як ціна.
 *      Ціни живуть у каталозі й міняються без нас; названа в тексті сума
 *      застаріває мовчки.
 *   4. Внутрішніх посилань достатньо: щонайменше три в каталог і два на інші
 *      статті блогу.
 *   5. FAQ має від трьох до пʼяти питань, H2 — від пʼяти до восьми, обсяг —
 *      від 1200 до 1800 слів.
 * Будь-яка невдача спиняє запис. Стаття, яка не пройшла, друкується в консоль
 * разом із причиною, щоб її можна було перечитати і вирішити самому.
 *
 * КЛЮЧ ЖИВЕ ЛИШЕ ЛОКАЛЬНО. `ANTHROPIC_API_KEY` береться з `.env.local` і на
 * Vercel не ставиться: генерація — це ручна дія за столом, а не щось, що має
 * вміти робити продакшн. Чим менше місць знає ключ, тим менше місць його
 * втратить.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { TOPICS, findTopic, topicPaths, type Topic, type TopicTarget } from '../lib/blog/topics.ts';
import { slotAfterQueue } from '../lib/blog/schedule.ts';
import { checkArticle, countWords } from '../lib/blog/article-check.ts';

const MODEL = 'claude-sonnet-4-6';
const SITE = 'https://touchmemories.com.ua';

// ── Оточення ─────────────────────────────────────────────────────────────

/**
 * `.env.local` читається руками, бо скрипт запускається голим node, без
 * завантажувача Next. Наявні змінні НЕ перезаписуються: те, що експортоване в
 * оболонці, має бути сильнішим за файл, інакше тимчасовий ключ у сесії
 * непомітно ігнорувався б.
 */
function loadEnvLocal() {
    try {
        const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
        for (const line of raw.split('\n')) {
            const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
            if (!m) continue;
            const value = m[2].replace(/^["']|["']$/g, '');
            if (process.env[m[1]] === undefined) process.env[m[1]] = value;
        }
    } catch {
        // Файла може не бути — тоді все має прийти з оточення.
    }
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        fail(`Немає змінної ${name}. Генерація працює локально і читає .env.local.`);
    }
    return value!;
}

function fail(message: string): never {
    console.error(`\n✖ ${message}\n`);
    process.exit(1);
}

// ── Перевірка цільових сторінок ──────────────────────────────────────────

const UA_TO_DB_CATEGORY: Record<string, string> = {
    'fotoknygy': 'photobooks',
    'trevel-buky': 'travelbooks',
    'druk-foto': 'prints',
    'fotokalendari': 'calendars',
    'fotomahnity': 'photomagnets',
    'postery': 'posters',
    'pazly': 'puzzles',
    'knyha-pobazhan': 'guestbooks',
    'albomy-dlya-vkleyky': 'scrapbook-albums',
    'fotoalbomy': 'photoalbomy-failykovi',
    'dytyachi-fototovary': 'kids',
    'foto-podarunky': 'gifts',
    'aksesuary': 'accessories',
    'sertyfikaty': 'certificates',
    'vypuskni-knyhy': 'graduation-books',
};

/**
 * Чи справді існує сторінка, на яку веде тема.
 *
 * Категорія без жодного активного товару НЕ проходить: сторінка такої
 * категорії віддає 301 на каталог, тож посилання в статті стало б переходом у
 * нікуди конкретного. Це та сама пастка, через яку `guestbook-kids` місяцями
 * лежав у sitemap і відповідав переадресацією.
 */
async function verifyTarget(db: any, target: TopicTarget): Promise<string | null> {
    if (target.kind === 'page') return null; // власні сторінки лежать у коді

    if (target.kind === 'product') {
        const slug = target.path.replace('/catalog/', '');
        const { data } = await db.from('products').select('slug, is_active').eq('slug', slug).maybeSingle();
        if (!data) return `товару «${slug}» у базі немає`;
        if (!data.is_active) return `товар «${slug}» знятий з публікації`;
        return null;
    }

    const parts = target.path.replace('/category/', '').split('/');
    const dbSlug = UA_TO_DB_CATEGORY[parts[0]] || parts[0];

    const { data: category } = await db.from('categories')
        .select('id, is_active').eq('slug', dbSlug).maybeSingle();
    if (!category) return `категорії «${parts[0]}» у базі немає`;
    if (!category.is_active) return `категорія «${parts[0]}» вимкнена`;

    const { count } = await db.from('products')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', category.id).eq('is_active', true);
    if (!count) return `у категорії «${parts[0]}» немає жодного активного товару, її сторінка віддає 301`;

    if (target.kind === 'landing') {
        const { data: landingRow } = await db.from('landing_pages')
            .select('is_active').eq('category_slug', dbSlug).eq('occasion', parts[1]).maybeSingle();
        if (!landingRow) return `лендінга «${parts[0]}/${parts[1]}» у базі немає`;
        if (!landingRow.is_active) return `лендінг «${parts[0]}/${parts[1]}» вимкнений`;
    }

    return null;
}

// ── Промт ────────────────────────────────────────────────────────────────

function buildPrompt(topic: Topic, links: string[], recent: Array<{ title: string; slug: string }>): string {
    const linkList = links.map(l => `- ${l}`).join('\n');
    const recentList = recent.map(p => `- ${p.title} → ${SITE}/uk/blog/${p.slug}`).join('\n');

    return `Напиши статтю для блогу українського бренду touch.memories.

ТЕМА: ${topic.title}
КЛЮЧОВИЙ ЗАПИТ: ${topic.query}
ГОЛОВНА ЦІЛЬОВА СТОРІНКА: ${SITE}/uk${topic.target.path}

ПРО БРЕНД. touch.memories робить фотокниги, тревелбуки, глянцеві журнали про людину, книги побажань, фотодрук, полароїд-картки, фотомагніти, постери, пазли та календарі. Людина або збирає макет сама в онлайн-конструкторі, або замовляє верстку в дизайнерки студії. Назву бренду пиши рівно так: touch.memories. Ніколи інакше — ні з великої літери, ні без крапки, ні як «Touch Memories».

ОБСЯГ І СТРУКТУРА:
- від 1200 до 1800 слів українською;
- вступ на два-три абзаци, і ключовий запит має стояти в перших ста словах;
- від пʼяти до восьми заголовків другого рівня (##), між ними списки й короткі абзаци;
- у кінці мʼякий заклик із посиланням на головну цільову сторінку;
- окремо поле faq: від трьох до пʼяти питань, які людина справді ставить у пошуку, з відповідями на два-чотири речення.

ТОН. Пиши так, як пише людина, що робить ці книги руками: спокійно, конкретно, без захвату й без окличних знаків. Звертайся на «ви». Не починай речення з «Отже», «Тож», «Адже» більше одного разу на статтю.

КЛЮЧОВІ СЛОВА. Вплети ключовий запит природно і додай пʼять-вісім близьких варіантів. Переспаму бути не має: якщо фраза не звучить як жива мова, її там не треба.

ВНУТРІШНІ ПОСИЛАННЯ. Постав у тексті щонайменше три посилання на ці сторінки (звичайним markdown, з осмисленим текстом посилання, а не «тут»):
${linkList}

І ще щонайменше два посилання на інші статті блогу з цього переліку:
${recentList}

${topic.independent
    ? 'ЦЕ НЕЗАЛЕЖНА СТАТТЯ. Людина шукає її без наміру щось купувати. Продукт згадується ЛИШЕ в останньому розділі й лише одним абзацом. У заголовку статті, у заголовках розділів і у вступі продукту бути не має взагалі. Уся решта тексту — це корисна відповідь на питання, з якого людина прийшла.'
    : 'Продукт можна згадувати по ходу тексту, але стаття має лишатися корисною тому, хто нічого не купить.'}

ЩО ЗАБОРОНЕНО КАТЕГОРИЧНО:
- називати будь-які суми, ціни, знижки чи «від N грн». Ціни живуть у каталозі й міняються без статті;
- вигадувати цифри, відсотки, дослідження, опитування й «за статистикою»;
- згадувати Canva чи будь-які інструменти дизайну;
- згадувати виробничого партнера, друкарню, типографію чи де саме друкується замовлення;
- згадувати ретуш і обробку фотографій як послугу;
- обіцяти терміни виготовлення й доставки;
- писати про процес інакше, ніж «робимо», «збираємо», «створюємо»;
- ставити емодзі будь-де;
- речення з одного чи двох слів.

ФОРМАТ ВІДПОВІДІ. Поверни JSON за наданою схемою. У полі content — чистий markdown без заголовка першого рівня: заголовок статті віддається окремим полем і на сторінці вже є. Поле slug — латиницею, коротке, з ключовим запитом, слова через дефіс. Поле meta_title — до 60 символів, ключовий запит на початку. Поле meta_description — від 140 до 160 символів.`;
}

const SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string', description: 'Заголовок статті, він же H1' },
        slug: { type: 'string', description: 'Латиниця, слова через дефіс, без цифр року' },
        meta_title: { type: 'string', description: 'До 60 символів, ключовий запит на початку' },
        meta_description: { type: 'string', description: 'Від 140 до 160 символів' },
        excerpt: { type: 'string', description: 'Одне-два речення, анонс для списку блогу' },
        content: { type: 'string', description: 'Тіло статті в markdown, без H1' },
        cover_alt: { type: 'string', description: 'Опис обкладинки для alt, без назви бренду' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Три-пʼять тегів українською' },
        faq: {
            type: 'array',
            items: {
                type: 'object',
                properties: { q: { type: 'string' }, a: { type: 'string' } },
                required: ['q', 'a'],
                additionalProperties: false,
            },
        },
    },
    required: ['title', 'slug', 'meta_title', 'meta_description', 'excerpt', 'content', 'cover_alt', 'tags', 'faq'],
    additionalProperties: false,
} as const;

// ── Основний хід ─────────────────────────────────────────────────────────

async function main() {
    loadEnvLocal();

    const args = process.argv.slice(2);
    const dry = args.includes('--dry');
    const id = args.find(a => !a.startsWith('--'));

    if (args.includes('--list') || !id) {
        console.log('\nТеми:\n');
        for (const t of TOPICS) {
            const mark = t.blocked ? '⛔' : (t.independent ? '○' : '●');
            console.log(`  ${mark} ${t.id.padEnd(40)} ${t.title}`);
            if (t.blocked) console.log(`     ↳ ${t.blocked}`);
        }
        console.log('\n  ● під продукт   ○ незалежна   ⛔ немає живої сторінки\n');
        console.log('  Запуск: npm run blog:generate -- <id-теми> [--dry]\n');
        return;
    }

    const topic = findTopic(id);
    if (!topic) fail(`Теми «${id}» немає. Перелік: npm run blog:generate -- --list`);
    if (topic!.blocked) fail(`Тема «${id}» заблокована. ${topic!.blocked}`);

    const db = createClient(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    );

    console.log(`\nТема: ${topic!.title}`);

    // 1. Сторінки, на які стаття вестиме, мусять існувати ДО генерації.
    const targets = topicPaths(topic!);
    const bad: string[] = [];
    for (const t of targets) {
        const problem = await verifyTarget(db, t);
        if (problem) bad.push(`${t.path}: ${problem}`);
    }
    if (bad.length) {
        fail(`Цільові сторінки теми не готові:\n  ${bad.join('\n  ')}`);
    }
    const links = targets.map(t => `${SITE}/uk${t.path}`);
    console.log(`Сторінки перевірені: ${links.length}`);

    // 2. Статті, на які можна послатися: та сама категорія має пріоритет.
    const { data: catRow } = await db.from('blog_categories')
        .select('id').eq('slug', topic!.category).maybeSingle();
    if (!catRow) fail(`Категорії блогу «${topic!.category}» у базі немає`);

    const { data: sameCat } = await db.from('blog_posts')
        .select('title, slug').eq('status', 'published').eq('category_id', catRow.id)
        .order('published_at', { ascending: false }).limit(4);
    const { data: anyPost } = await db.from('blog_posts')
        .select('title, slug').eq('status', 'published')
        .order('published_at', { ascending: false }).limit(6);

    const recent = [...(sameCat || []), ...(anyPost || [])]
        .filter((p, i, all) => all.findIndex(o => o.slug === p.slug) === i)
        .slice(0, 6);
    if (recent.length < 2) fail('У блозі менше двох опублікованих статей — немає на що посилатися');

    // 3. Генерація.
    const client = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
    console.log(`Пишемо статтю через ${MODEL}…`);

    const response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { format: { type: 'json_schema', schema: SCHEMA as any } },
        messages: [{ role: 'user', content: buildPrompt(topic!, links, recent) }],
    });

    const text = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');

    let article: any;
    try {
        article = JSON.parse(text);
    } catch {
        fail(`Відповідь не розібралася як JSON. Сире тіло:\n\n${text.slice(0, 2000)}`);
    }

    // 4. Перевірка написаного.
    const problems = checkArticle(article, {
        query: topic!.query,
        independent: topic!.independent,
        links,
        blogSlugs: recent.map(p => p.slug),
    });

    const { data: taken } = await db.from('blog_posts').select('id').eq('slug', article.slug).maybeSingle();
    if (taken) problems.push(`слаг «${article.slug}» уже зайнятий`);

    report(article, topic!, problems);

    if (problems.length) {
        fail(`Стаття не пройшла перевірку (${problems.length}). У чергу вона НЕ потрапила — перечитайте вище і запустіть ще раз.`);
    }
    if (dry) {
        console.log('\n--dry: у базу нічого не записано.\n');
        return;
    }

    // 5. У чергу.
    // Розклад рахує та сама чиста функція, що й крон із адмінкою. Читання
    // черги тут своє, бо скрипт ходить у базу власним клієнтом.
    const { data: queued } = await db.from('blog_posts')
        .select('publish_at').eq('status', 'scheduled');
    const { data: lastPublished } = await db.from('blog_posts')
        .select('published_at').eq('status', 'published')
        .order('published_at', { ascending: false }).limit(1).maybeSingle();
    const slot = slotAfterQueue(
        (queued || []).map((p: any) => p.publish_at),
        lastPublished?.published_at ?? null,
    );
    const words = countWords(article.content);

    const { error } = await db.from('blog_posts').insert({
        title: article.title,
        slug: article.slug,
        category_id: catRow.id,
        excerpt: article.excerpt,
        content: article.content,
        meta_title: article.meta_title,
        meta_description: article.meta_description,
        cover_image_alt: article.cover_alt,
        author_name: 'touch.memories',
        tags: article.tags,
        faq: article.faq,
        related_product_slugs: targets.filter(t => t.kind === 'product').map(t => t.path.replace('/catalog/', '')),
        internal_links: targets.map(t => ({ path: t.path, kind: t.kind })),
        reading_time: Math.max(1, Math.round(words / 200)),
        locale: 'uk',
        status: 'scheduled',
        is_published: false,
        publish_at: slot.toISOString(),
    });

    if (error) fail(`Запис не пройшов: ${error.message}`);

    console.log(`\n✔ У черзі на ${slot.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })} за Києвом.`);
    console.log(`  Прев'ю: ${SITE}/uk/blog/${article.slug}?preview=$BLOG_PREVIEW_SECRET\n`);
}

/** Показує статтю так, щоб її можна було оцінити, не відкриваючи базу. */
function report(article: any, topic: Topic, problems: string[]) {
    const line = '─'.repeat(72);
    console.log(`\n${line}`);
    console.log(`Заголовок      ${article.title}`);
    console.log(`Слаг           ${article.slug}`);
    console.log(`Meta title     ${article.meta_title}  (${(article.meta_title || '').length}/60)`);
    console.log(`Meta descr.    ${article.meta_description}  (${(article.meta_description || '').length}/140–160)`);
    console.log(`Анонс          ${article.excerpt}`);
    console.log(`Обсяг          ${countWords(article.content)} слів`);
    console.log(`Теги           ${(article.tags || []).join(', ')}`);
    console.log(`${line}`);

    console.log('Розділи:');
    for (const h of (article.content.match(/^##\s+(.+)$/gm) || [])) {
        console.log(`  ${h.replace(/^##\s+/, '')}`);
    }

    console.log('\nFAQ:');
    for (const item of (article.faq || [])) console.log(`  — ${item.q}`);

    console.log('\nПосилання в тексті:');
    for (const href of (article.content.match(/\]\(([^)]+)\)/g) || [])) {
        console.log(`  ${href.slice(2, -1)}`);
    }

    if (problems.length) {
        console.log('\nПроблеми:');
        for (const p of problems) console.log(`  ✖ ${p}`);
    } else {
        console.log(`\n✔ Перевірку пройдено. Тема ${topic.independent ? 'незалежна' : 'під продукт'}.`);
    }
    console.log(`${line}`);
}

main().catch(e => fail(e?.message || String(e)));
