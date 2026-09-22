import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';
import { SHOP_CONTACT_EMAIL } from '@/lib/email/contact-address';
import { readDuePost, readQueue, publishNow, readPublishContext, type QueuedPost } from '@/lib/blog/queue';
import { submitToIndexNow } from '@/lib/seo/indexnow';
import { LOCALES, getCanonicalUrl, getBaseUrl } from '@/lib/seo/locales';

/**
 * Автопублікація блогу: одна стаття за прохід.
 *
 * РОЗКЛАД. Крон стоїть на `0 5 * * *`, тобто сьома ранку за Києвом узимку і
 * восьма влітку. Точнішого Vercel не дає — він рахує тільки UTC, а Київ двічі
 * на рік переводить годинник. Умова публікації — `publish_at <= now`, тож
 * стаття ніколи не виходить РАНІШЕ за свою дату, а година запізнення влітку
 * нікого не стосується.
 *
 * ЧОМУ ОДНА, А НЕ ВСІ ПРОСТРОЧЕНІ. Якщо крон кілька днів не працював, черга
 * накопичує прострочені статті. Відкрити їх усі одним проходом означало б
 * викинути три-чотири статті одним ранком — і в стрічці, і в RSS, і в
 * IndexNow одним пакетом. Виходить сплеск, схожий на спам, а далі тиждень
 * тиші. По одній за прохід черга розсмоктується сама, зберігаючи ритм.
 *
 * СТОРОЖ. Порожня черга не видно нічим: сайт працює, статті просто перестають
 * виходити, і помічається це тижнів через три. Тому крон пише в `settings`
 * рядок `blog_queue_watch` КОЖНОГО разу — і коли опублікував, і коли черга
 * порожня. Сторож, який мовчить, і сторож, якого ніхто не запускав, виглядають
 * однаково, а це різні речі (гоча 15 у CLAUDE.md). Лист про порожню чи
 * коротку чергу йде не частіше ніж раз на добу: сторож, який кричить вовк,
 * зрештою опиняється у спамі.
 *
 * ЛИСТ ІДЕ НЕ ЧЕРЕЗ `sendLoggedEmail`. Це лист НАМ САМИМ на робочу скриньку, а
 * такі в `email_logs` не заводяться свідомо (гоча 20).
 */

export const dynamic = 'force-dynamic';

const WATCH_KEY = 'blog_queue_watch';
const LOW_QUEUE_THRESHOLD = 3;

type Watch = {
    last_checked_at?: string;
    last_published_slug?: string | null;
    outcome?: string;
    queue_left?: number;
    last_warned_at?: string | null;
};

/** Адреси статті в усіх локалях, де вона справді існує. */
function postUrls(post: QueuedPost, translations: Record<string, any> | null): string[] {
    const base = (post.locale || 'uk') as (typeof LOCALES)[number];
    const extra = Object.keys(translations || {}).filter(
        l => (LOCALES as readonly string[]).includes(l) && l !== base,
    ) as Array<(typeof LOCALES)[number]>;

    return [base, ...extra].map(l => getCanonicalUrl(l, `/blog/${post.slug}`));
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: watchRow } = await supabase
        .from('settings').select('value').eq('key', WATCH_KEY).maybeSingle();
    const watch = ((watchRow?.value as Watch) || {});

    const heartbeat = async (patch: Watch) => {
        await supabase.from('settings').upsert({
            key: WATCH_KEY,
            value: { ...watch, last_checked_at: nowIso, ...patch },
            updated_at: nowIso,
        });
    };

    try {
        const due = await readDuePost(supabase, now);

        let publishedSlug: string | null = null;
        let indexNow: any = null;

        if (due) {
            const { translations, categorySlug } = await readPublishContext(supabase, due.id);

            await publishNow(supabase, due, now);
            publishedSlug = due.slug;

            // Сторінки блогу стоять на ISR із годинним і двогодинним вікном —
            // без примусового скидання стаття зʼявилася б із запізненням на це
            // вікно, а sitemap і llms.txt показували б стару чергу.
            for (const locale of LOCALES) {
                revalidatePath(`/${locale}/blog/${due.slug}`);
                revalidatePath(`/${locale}/blog`);
                revalidatePath(`/${locale}`);
                if (categorySlug) revalidatePath(`/${locale}/blog/category/${categorySlug}`);
            }
            revalidatePath('/sitemap.xml');
            revalidatePath('/blog-sitemap.xml');
            revalidatePath('/llms.txt');

            indexNow = await submitToIndexNow(postUrls(due, translations));
        }

        const queue = await readQueue(supabase);
        const left = queue.length;

        // Попередження раз на добу: два проходи поспіль з порожньою чергою — це
        // той самий факт, а не дві новини.
        const warnedRecently = watch.last_warned_at
            && now.getTime() - new Date(watch.last_warned_at).getTime() < 20 * 3600 * 1000;

        let warned = false;
        if (left <= LOW_QUEUE_THRESHOLD && !warnedRecently) {
            warned = await warn(left, queue, publishedSlug);
        }

        await heartbeat({
            outcome: publishedSlug ? 'published' : (left ? 'waiting' : 'empty'),
            last_published_slug: publishedSlug ?? watch.last_published_slug ?? null,
            queue_left: left,
            last_warned_at: warned ? nowIso : (watch.last_warned_at ?? null),
        });

        return NextResponse.json({
            published: publishedSlug,
            queue_left: left,
            next_at: queue[0]?.publish_at ?? null,
            warned,
            indexnow: indexNow,
        });
    } catch (e: any) {
        console.error('[Cron] blog-publish failed:', e?.message || e);
        await heartbeat({ outcome: `error: ${e?.message || e}` });
        return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 });
    }
}

/** Лист про те, що черга закінчується. Повертає, чи він справді пішов. */
async function warn(left: number, queue: QueuedPost[], publishedSlug: string | null): Promise<boolean> {
    const base = getBaseUrl();
    const rows = queue.map(p => {
        const when = p.publish_at ? new Date(p.publish_at).toLocaleDateString('uk-UA') : 'без дати';
        return `<li>${when} — ${p.title}</li>`;
    }).join('');

    const headline = left === 0
        ? 'Черга блогу порожня, залишилось 0 статей'
        : `Черга блогу закінчується, залишилось ${left}`;

    try {
        const res: any = await sendEmail({
            to: SHOP_CONTACT_EMAIL,
            subject: headline,
            html: `
                <h2>${headline}</h2>
                ${publishedSlug ? `<p>Сьогодні вийшла стаття <a href="${base}/uk/blog/${publishedSlug}">${publishedSlug}</a>.</p>` : ''}
                ${left ? `<p>Що ще стоїть у черзі:</p><ul>${rows}</ul>` : '<p>Наступної статті немає жодної, і завтра вранці не вийде нічого.</p>'}
                <p>Щоб додати статтю, запустіть генерацію локально: <code>npm run blog:generate -- &lt;тема&gt;</code>.</p>
                <p><a href="${base}/admin/blog">Відкрити блог в адмінці</a></p>
            `,
        });
        // `sendEmail` не кидає на відмову Brevo, а повертає `success: false` —
        // тож перевіряти треба саме прапорець. «Не дійшло» і «не відправляли»
        // мають виглядати по-різному в рядку сторожа, інакше наступного разу
        // ми дивитимемося на порожню чергу і думатимемо, що лист був.
        return res?.success === true;
    } catch (e: any) {
        console.error('[Cron] blog-publish warning email failed:', e?.message || e);
        return false;
    }
}
