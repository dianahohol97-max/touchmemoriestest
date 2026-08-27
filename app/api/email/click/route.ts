import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');

/**
 * GET /api/email/click?q=<queueId>&u=<url>
 *
 * Перехід за посиланням із листа: зараховуємо клік і одразу відправляємо людину
 * туди, куди вона йшла. Людина важливіша за статистику — якщо запис не вдався,
 * перенаправлення все одно відбувається.
 *
 * `u` пускаємо ТІЛЬКИ на власний сайт. Відкритий редирект на будь-яку адресу
 * перетворив би наш домен на зручний інструмент для чужих фішингових листів.
 */
export async function GET(req: Request) {
    const params = new URL(req.url).searchParams;
    const q = params.get('q') || '';
    const raw = params.get('u') || SITE_URL;

    let target = SITE_URL;
    try {
        const u = new URL(raw, SITE_URL);
        const allowed = new URL(SITE_URL);
        if (u.protocol === 'https:' && (u.hostname === allowed.hostname || u.hostname.endsWith(`.${allowed.hostname}`))) {
            target = u.toString();
        } else {
            console.warn('[email-click] refused off-site redirect', { raw });
        }
    } catch { /* лишається головна */ }

    if (q) {
        try {
            const admin = getAdminClient();
            const { data: row } = await admin
                .from('email_campaign_queue')
                .select('id, clicked_at, click_count')
                .eq('id', q)
                .maybeSingle();
            if (row) {
                await admin.from('email_campaign_queue').update({
                    clicked_at: (row as any).clicked_at || new Date().toISOString(),
                    click_count: (((row as any).click_count as number) || 0) + 1,
                    // Клік означає, що лист точно бачили — навіть якщо піксель
                    // не долетів (картинки вимкнені).
                    opened_at: (row as any).opened_at || new Date().toISOString(),
                }).eq('id', q);
            }
        } catch (e) {
            console.error('[email-click] failed', e);
        }
    }

    return NextResponse.redirect(target, 302);
}
