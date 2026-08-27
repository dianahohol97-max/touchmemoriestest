import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/open?q=<queueId>
 *
 * Прозорий піксель із листа розсилки. Відповідає картинкою ЗАВЖДИ — навіть коли
 * запис не знайдено або база недоступна: зламана картинка в чужому листі гірша
 * за незарахований показ.
 *
 * Число відкриттів завищене за своєю природою (Apple Mail підвантажує картинки
 * сам) — див. lib/email/tracking.ts. Довіряти треба переходам.
 */
const PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
);

export async function GET(req: Request) {
    const q = new URL(req.url).searchParams.get('q') || '';
    if (q) {
        try {
            const admin = getAdminClient();
            // Перше відкриття фіксуємо часом, наступні лише збільшують лічильник,
            // щоб не втратити момент, коли лист прочитали вперше.
            const { data: row } = await admin
                .from('email_campaign_queue')
                .select('id, opened_at, open_count')
                .eq('id', q)
                .maybeSingle();
            if (row) {
                await admin.from('email_campaign_queue').update({
                    opened_at: (row as any).opened_at || new Date().toISOString(),
                    open_count: (((row as any).open_count as number) || 0) + 1,
                }).eq('id', q);
            }
        } catch (e) {
            console.error('[email-open] failed', e);
        }
    }
    return new NextResponse(PIXEL, {
        status: 200,
        headers: {
            'Content-Type': 'image/gif',
            'Content-Length': String(PIXEL.length),
            // Без кешу, інакше повторні відкриття не долітають.
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
        },
    });
}
