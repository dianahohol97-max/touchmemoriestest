import { NextResponse } from 'next/server';
import Jimp from 'jimp';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { hasWhiteEdges, measureWhiteEdges } from '@/lib/print/white-edge';

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

            const edges = measureWhiteEdges({ width: W, height: H, lineIsWhite });
            if (!hasWhiteEdges(edges)) {
                report.push({ file: f.file_name, status: 'skipped', reason: 'білої смужки немає', size: `${W}×${H}` });
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
        total: targets.length,
        nextOffset,
        done: nextOffset >= targets.length,
        fixed,
        failed,
        report,
    });
}
