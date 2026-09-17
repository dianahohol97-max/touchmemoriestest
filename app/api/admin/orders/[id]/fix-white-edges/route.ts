import { NextResponse } from 'next/server';
import Jimp from 'jimp';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { inspectWhiteEdges } from '@/lib/print/white-edge';
import { deriveGeometry, normalizeSizeKey, type SizeRow } from '@/lib/print/geometry';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/orders/[id]/fix-white-edges
 *
 * Заповнює білу смужку по краю відрендерених аркушів продовженням малюнка.
 *
 * Навіщо. Розворот їде у друк аркушем разом із вильотом, і друкарня перевіряє
 * саме цей розмір (див. strip-bleed — там пояснено, чому виліт не можна
 * зрізати). Виліт має бути заповнений продовженням малюнка, інакше ніж лишає
 * на готовій сторінці білу риску. На TM-001254 він заповнений не до кінця:
 * кілька пікселів по лівому й правому краю лишились білими. Перегенерація не
 * допомагає — смужку робить сам сервіс рендеру на Railway, тож кожен новий
 * файл виходить такий самий.
 *
 * Що робить цей маршрут. НЕ ріже: розмір аркуша лишається піксель у піксель
 * тим самим, інакше друкарня відхилить файл. Білі лінії по краю замінюються
 * найближчою небілою лінією, тобто малюнок продовжується назовні рівно так,
 * як виліт і мав бути заповнений. Пікселі всередині готового розміру не
 * змінюються взагалі.
 *
 * Ідемпотентний: файл без білої смужки повертається як `skipped`.
 *
 * Партіями, з тієї ж причини, що й strip-bleed: декодування аркуша 4961×3602
 * у jimp триває секунди, і ціла книжка в одному виклику не вкладається в
 * бюджет функції. Викликач іде за `nextOffset`, доки не дійде до `total`.
 */
/**
 * Поріг «білого» і допуск на лінію підібрані на справжньому файлі TM-001254.
 *
 * 250 по кожному каналу виявилось надто строго: JPEG зберігає колірність у
 * меншій роздільності, ніж яскравість, тож у білій смужці окремі пікселі
 * мають один канал на кілька одиниць нижчим. Око бачить білу лінію, а
 * перевірка її не бачила — на тому самому файлі 250 не знаходило нічого, тоді
 * як 240 дає рівно ту смужку, яку видно і яку я поміряла окремо: один піксель
 * ліворуч, шість праворуч. 235 дає той самий результат, тобто 240 стоїть
 * посеред стабільної ділянки, а не на її краю.
 */
const WHITE_LEVEL = 240;
/** Частка пікселів у лінії, які мають бути білими, щоб вважати лінію білою. */
const WHITE_SHARE = 0.95;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const url = new URL(req.url);
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.min(6, Math.max(1, parseInt(url.searchParams.get('limit') || '3', 10) || 3));
    const dryRun = url.searchParams.get('dry') === '1';

    const { id } = await params;
    const admin = getAdminClient();

    const { data: order } = await admin.from('orders').select('id, order_number').eq('id', id).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

    /*
     * Межа пошуку береться з вильоту САМЕ ЦЬОГО розміру, і по кожній осі
     * окремо. Раніше тут не було геометрії взагалі, а вимірювач мав усередині
     * 2% на обидві осі — і на 20×30, де виліт 2.38% ширини, смужка на всю
     * ширину вильоту не вкладалась у запобіжник. Файл лишався недоторканим, а
     * відповідь була «білої смужки немає». TM-001254 — це саме 20×30, і саме
     * тому кожен прогін виглядав успішним, поки лінії лишались на місці.
     *
     * Запас у чверть вильоту — на округлення в пікселі й на те, що рендер
     * інколи лишає смужку на пів пікселя ширшою за розрахункову. Далі за виліт
     * не пускаємо: там починається макет, і затирати його не можна.
     */
    const { data: projects } = await admin
        .from('projects')
        .select('product_type, format, overlays_data')
        .eq('order_id', id)
        .order('updated_at', { ascending: false });
    const proj = (projects || [])[0] as any;
    const config = proj?.overlays_data?.config || {};
    const PRODUCT_SIZE: Record<string, string> = { travelbook: '20x30' };
    const sizeKey = normalizeSizeKey(String(
        config.selectedSize || proj?.format || PRODUCT_SIZE[String(proj?.product_type || '')] || ''
    ));
    const { data: sizeRows } = await admin
        .from('photobook_sizes')
        .select('name, width_cm, height_cm, spread_width_mm, spread_height_mm, cover_width_mm, cover_height_mm, bleed_top_mm, bleed_bottom_mm, bleed_left_mm, bleed_right_mm, cover_fold_margin_mm');
    const sizeRow = ((sizeRows || []) as SizeRow[])
        .find(r => normalizeSizeKey(String(r.name || '')) === sizeKey) || null;
    const geo = sizeKey ? deriveGeometry(sizeKey, sizeRow) : null;

    const BLEED_HEADROOM = 1.25;
    const fractionFor = (bleedMm: number, sheetMm: number): number | undefined => {
        if (!(bleedMm > 0) || !(sheetMm > 0)) return undefined;
        return (bleedMm / sheetMm) * BLEED_HEADROOM;
    };
    const maxFractionX = geo ? fractionFor(geo.overhang.x, geo.sheet.w) : undefined;
    const maxFractionY = geo ? fractionFor(geo.overhang.y, geo.sheet.h) : undefined;

    const { data: files } = await admin
        .from('order_files')
        .select('id, file_path, file_name, bucket_name, file_type')
        .eq('order_id', id)
        .eq('file_type', 'export')
        .order('page_number', { ascending: true, nullsFirst: true })
        .order('file_name', { ascending: true });

    const targets = (files || []).filter(f => /\.jpe?g$/i.test(String(f.file_name || '')));
    if (targets.length === 0) {
        return NextResponse.json({ error: 'У замовлення немає відрендерених файлів' }, { status: 400 });
    }

    const batch = targets.slice(offset, offset + limit);
    const report: any[] = [];

    for (const f of batch) {
        const bucket = f.bucket_name || 'photobook-uploads';
        try {
            const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(f.file_path);
            if (dlErr || !blob) throw new Error(dlErr?.message || 'не вдалося завантажити файл');

            const img = await Jimp.read(Buffer.from(await blob.arrayBuffer()));
            const W = img.getWidth(), H = img.getHeight();

            const isWhitePixel = (x: number, y: number) => {
                const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(x, y));
                return r >= WHITE_LEVEL && g >= WHITE_LEVEL && b >= WHITE_LEVEL;
            };
            const lineIsWhite = (axis: 'col' | 'row', index: number) => {
                const len = axis === 'col' ? H : W;
                // Рахуємо частку, а не «всі до одного»: JPEG після стискання
                // лишає поодинокі пікселі на пару одиниць темнішими, і вимога
                // абсолютної білизни пропускала б реальні смужки.
                let need = Math.ceil(len * WHITE_SHARE);
                let allowedMisses = len - need;
                for (let i = 0; i < len; i++) {
                    const ok = axis === 'col' ? isWhitePixel(index, i) : isWhitePixel(i, index);
                    if (!ok && --allowedMisses < 0) return false;
                }
                return true;
            };

            const reading = inspectWhiteEdges({ width: W, height: H, lineIsWhite, maxFractionX, maxFractionY });
            const edges = reading.edges;
            if (reading.verdict !== 'found') {
                // Причина називається вголос. «Смужки немає» і «біле тягнеться
                // далі за виліт» — різні діагнози: перший означає, що файл уже
                // чистий, другий — що біле є, але воно завелике, щоб бути
                // вильотом, і дивитись треба на макет.
                const REASON: Record<string, string> = {
                    clean: 'край аркуша не білий, смужки немає',
                    'wider-than-bleed': `біле тягнеться далі за виліт (межа ${reading.caps.x}×${reading.caps.y} пкс) — це вже макет, не чіпаю`,
                    degenerate: 'не вдалося прочитати розмір зображення',
                };
                report.push({
                    file: f.file_name,
                    status: 'skipped',
                    verdict: reading.verdict,
                    reason: REASON[reading.verdict] || reading.verdict,
                    size: `${W}×${H}`,
                });
                continue;
            }
            if (dryRun) {
                report.push({ file: f.file_name, status: 'found', edges, size: `${W}×${H}` });
                continue;
            }

            // Спершу стовпці на всю висоту, потім рядки на всю ширину — тоді
            // кути заповнюються вже виправленими пікселями, а не білими.
            for (let x = 0; x < edges.left; x++) {
                for (let y = 0; y < H; y++) img.setPixelColor(img.getPixelColor(edges.left, y), x, y);
            }
            for (let k = 0; k < edges.right; k++) {
                const x = W - 1 - k;
                for (let y = 0; y < H; y++) img.setPixelColor(img.getPixelColor(W - 1 - edges.right, y), x, y);
            }
            for (let y = 0; y < edges.top; y++) {
                for (let x = 0; x < W; x++) img.setPixelColor(img.getPixelColor(x, edges.top), x, y);
            }
            for (let k = 0; k < edges.bottom; k++) {
                const y = H - 1 - k;
                for (let x = 0; x < W; x++) img.setPixelColor(img.getPixelColor(x, H - 1 - edges.bottom), x, y);
            }

            const out = await img.quality(95).getBufferAsync(Jimp.MIME_JPEG);
            const { error: upErr } = await admin.storage
                .from(bucket)
                .upload(f.file_path, out, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
            if (upErr) throw new Error(upErr.message);

            await admin.from('order_files').update({ file_size: out.length }).eq('id', f.id);
            report.push({ file: f.file_name, status: 'ok', edges, size: `${W}×${H}` });
        } catch (e: any) {
            report.push({ file: f.file_name, status: 'error', reason: String(e?.message || e) });
        }
    }

    const fixed = report.filter(r => r.status === 'ok').length;
    const failed = report.filter(r => r.status === 'error').length;
    const nextOffset = offset + batch.length;

    return NextResponse.json({
        ok: failed === 0,
        orderNumber: order.order_number,
        // Без цього неможливо відрізнити «на цьому розмірі нема чого шукати»
        // від «розмір не визначився, і межа впала на запасні 2%».
        size: sizeKey || null,
        sheetMm: geo ? `${geo.sheet.w}×${geo.sheet.h}` : null,
        bleedMm: geo ? `${geo.overhang.x}×${geo.overhang.y}` : null,
        total: targets.length,
        nextOffset,
        done: nextOffset >= targets.length,
        fixed,
        failed,
        report,
    });
}
