import { NextRequest, NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Приватні кошики, які адмінка має право показувати співробітнику.
 *
 * Тут був лише 'order-files', хоча файли замовлень лежать у трьох кошиках:
 * order-files (5208 файлів), photobook-uploads (1855) і poster-exports (3).
 * Тобто для 72 замовлень — усіх фотокниг — цей роут відповідав «Unsupported
 * bucket», і картка не могла підписати ні прев'ю, ні завантаження.
 */
const ALLOWED_BUCKETS = new Set(['order-files', 'photobook-uploads', 'poster-exports']);

/**
 * Час життя підпису на один файл.
 *
 * Година тут навмисно, і скорочувати її не можна: BriefCoverPhoto на картці
 * замовлення підписує фото один раз при відкритті й віддає це посилання не лише
 * в <img>, а і в <a href>, який людина натискає тоді, коли дійде до нього. Якщо
 * зрізати строк до кількох хвилин, той клік почне повертати рівно той самий
 * InvalidJWT, від якого ми тут лікуємось.
 *
 * Строк — це не механізм захисту, роут і так закритий requireSection.
 */
const SIGN_TTL_SECONDS = 60 * 60;

/**
 * Час життя підпису на пачку прев'ю.
 *
 * Тут можна коротко: прев'ю йдуть у <img src> без lazy-loading, тобто браузер
 * забирає їх одразу на рендері й більше до цього посилання не повертається.
 * Завантаження файлу цією пачкою вже не користується — воно підписує себе саме
 * в момент кліку.
 */
const BATCH_SIGN_TTL_SECONDS = 60 * 10;

/**
 * GET /api/admin/storage-signed-url?bucket=order-files&path=... — підписане
 * посилання на один файл замовлення.
 *
 * Картка підписувала такі посилання прямо з браузера. Політики на
 * storage.objects для order-files дають читання лише власнику теки або
 * is_admin(), тобто знову «email є в admin_users». Для менеджера чи дизайнера
 * підпис не видавався, і фото на обкладинку в брифі показувалось порожнім
 * прямокутником без жодного пояснення.
 *
 * Кошик перевіряється за білим списком, а шлях — на спроби вийти вгору. Доступ
 * до файлів замовлень у співробітника й так є через картку та кабінет
 * дизайнера, тож роут нічого нового не відкриває — лише перестає залежати від
 * того, чи потрапила людина в admin_users.
 */
export async function GET(req: NextRequest) {
    const guard = await requireSection('orders', 'view');
    if (!guard.ok) return guard.response;

    const bucket = req.nextUrl.searchParams.get('bucket') || 'order-files';
    const path = req.nextUrl.searchParams.get('path') || '';

    if (!ALLOWED_BUCKETS.has(bucket)) {
        return NextResponse.json({ error: 'Unsupported bucket' }, { status: 400 });
    }
    if (!path || path.startsWith('/') || path.includes('..')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, SIGN_TTL_SECONDS);
    if (error || !data?.signedUrl) {
        return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ url: data.signedUrl });
}


/**
 * POST — підписати одразу пачку шляхів одного кошика.
 *
 * Картка замовлення підписувала прев'ю прямо з браузера на годину наперед. Два
 * наслідки, обидва впіймані на TM-001254 (Діана, 17.09.2026): підпис із
 * браузера підпорядкований політикам storage.objects, тож менеджеру й дизайнеру
 * він просто не видавався; а той, кому видався, через годину відкритої вкладки
 * отримував від сховища
 * {"statusCode":"400","error":"InvalidJWT","message":"\"exp\" claim timestamp check failed"}
 * — бо посилання підписали на завантаженні сторінки, а натиснули пізніше.
 *
 * Тепер підписує сервер сервісним ключем, а картка просить підпис на файл у
 * момент кліку, а не наперед. Лікує це саме друге: протухнути між відкриттям
 * картки й натисканням більше нема чому, бо підпису на той момент ще не існує.
 */
export async function POST(req: NextRequest) {
    const guard = await requireSection('orders', 'view');
    if (!guard.ok) return guard.response;

    let body: { bucket?: string; paths?: unknown };
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const bucket = body.bucket || 'order-files';
    if (!ALLOWED_BUCKETS.has(bucket)) {
        return NextResponse.json({ error: 'Unsupported bucket' }, { status: 400 });
    }

    const paths = Array.isArray(body.paths)
        ? body.paths.filter((p): p is string => typeof p === 'string' && !!p && !p.startsWith('/') && !p.includes('..'))
        : [];
    if (paths.length === 0) return NextResponse.json({ urls: {} });
    if (paths.length > 500) {
        return NextResponse.json({ error: 'Too many paths' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data, error } = await admin.storage.from(bucket).createSignedUrls(paths, BATCH_SIGN_TTL_SECONDS);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // createSignedUrls returns one entry per path, in order; a missing object
    // comes back with an error instead of a url rather than shifting the rest.
    const urls: Record<string, string> = {};
    (data || []).forEach((entry, i) => { if (entry?.signedUrl) urls[paths[i]] = entry.signedUrl; });
    return NextResponse.json({ urls });
}
