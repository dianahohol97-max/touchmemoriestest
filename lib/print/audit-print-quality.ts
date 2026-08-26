import sharp from 'sharp';
import { getAdminClient } from '@/lib/supabase/admin';
import { deriveGeometry, normalizeSizeKey, resolveProjectSizeKey, mmToPx, type SizeRow } from '@/lib/print/geometry';

/**
 * Чи можна це друкувати — перевірка самих файлів, а не їхньої наявності.
 *
 * Усе, що вже стежить за друком, питає «файл є?». Жодна перевірка не питає
 * «а що в ньому?». За один день це коштувало двох замовлень:
 *
 *   · TM-001233 — розвороти обрізали до готових 400×300 мм замість аркуша
 *     420×305, і про це ми дізналися з листа друкарні, коли вона відхилила
 *     весь завантажений комплект;
 *   · TM-001232 — генератор обкладинки віддав рівно бежевий прямокутник без
 *     жодного напису, і це побачила Аліна, коли вручну качала файл.
 *
 * Обидва файли існували, лежали в order_files і були правильно названі. Обидва
 * ловляться за секунду, якщо просто відкрити картинку й подивитися на розмір і
 * на те, чи є в ній хоч щось.
 *
 * Тут рівно дві перевірки, обидві без здогадів:
 *
 *   1. РОЗМІР — тільки для розворотів і посторінкових файлів, де друкарня
 *      вимагає точне число. Обкладинки не міряються: книга побажань малюється
 *      через Satori з обмеженням довшої сторони, тож її обкладинка законно
 *      менша за 300 DPI, і міряти її означало б скаржитись на кожну.
 *   2. ПОРОЖНЕЧА — файл однієї суцільної заливки, без жодного вмісту. Це і
 *      бежевий прямокутник, і білий аркуш від рендера, який не дочекався фото.
 *
 * Чого тут навмисно немає: жодних «схоже на» і жодних припущень про красу
 * макета. Помилкова тривога змусить дівчат ігнорувати попередження, і тоді
 * від нього не буде користі взагалі.
 */

/** Наскільки рівним має бути файл, щоб вважатися порожнім. */
const FLAT_STDEV = 1.0;
/** Допуск у пікселях: округлення міліметрів дає ±1. */
const SIZE_TOLERANCE_PX = 2;
/** Скільки файлів дивимось за один прохід — декодування великих JPEG повільне. */
const MAX_FILES_PER_ORDER = 4;

export interface PrintQualityReport {
    checked: number;
    problems: string[];
}

// Клас файлу беремо з file_category, а не з імені. Імена різні в різних
// продуктів: фотокнига дає «01_spread.jpg», а тревелбук — просто «01.jpg», і
// перевірка за назвою мовчки пропускала б саме той продукт, чиї сторінки
// друкарня міряє з точністю до десятої міліметра.
const catOf = (f: { file_category?: string | null; file_name?: string | null }) => {
    const c = String(f.file_category || '').toLowerCase();
    if (c === 'book-cover') return 'cover' as const;
    if (c === 'book-page') return 'page' as const;
    if (c === 'book-spread') return 'spread' as const;
    const n = String(f.file_name || '').toLowerCase();
    if (/cover/.test(n)) return 'cover' as const;
    if (/_page\.jpe?g$/.test(n)) return 'page' as const;
    if (/_spread\.jpe?g$/.test(n)) return 'spread' as const;
    return 'other' as const;
};

/**
 * Перевіряє готові файли замовлення. Повертає список проблем українською —
 * порожній список означає «нічого підозрілого», а не «все ідеально».
 */
export async function auditOrderPrintQuality(orderId: string): Promise<PrintQualityReport> {
    const admin = getAdminClient();
    const problems: string[] = [];
    let checked = 0;

    const { data: files } = await admin
        .from('order_files')
        .select('file_name, file_path, bucket_name, file_category')
        .eq('order_id', orderId)
        .eq('file_type', 'export')
        .in('file_category', ['book-spread', 'book-page', 'book-cover'])
        .order('file_name', { ascending: true });

    const rows = files || [];
    if (!rows.length) return { checked: 0, problems: [] };

    // Геометрія потрібна лише для розворотів і сторінок. Якщо розміру визначити
    // не вдалося — міряти нічого, але порожнечу перевіряємо все одно.
    let geo: ReturnType<typeof deriveGeometry> = null;
    try {
        const { data: projs } = await admin
            .from('projects')
            .select('product_type, format, overlays_data')
            .eq('order_id', orderId)
            .order('updated_at', { ascending: false })
            .limit(1);
        const proj: any = (projs || [])[0];
        if (proj) {
            const sizeKey = resolveProjectSizeKey({
                product_type: proj.product_type,
                format: proj.format,
                config: proj?.overlays_data?.config || null,
            });
            if (sizeKey) {
                const { data: sizeRows } = await admin
                    .from('photobook_sizes')
                    .select('name, width_cm, height_cm, spread_width_mm, spread_height_mm, cover_width_mm, cover_height_mm, bleed_top_mm, bleed_bottom_mm, bleed_left_mm, bleed_right_mm, cover_fold_margin_mm');
                const row = ((sizeRows || []) as SizeRow[])
                    .find(s => normalizeSizeKey(String(s.name || '')) === normalizeSizeKey(sizeKey)) || null;
                geo = deriveGeometry(sizeKey, row);
            }
        }
    } catch { /* без геометрії лишається перевірка на порожнечу */ }

    // Спершу обкладинка, потім перші розвороти: якщо щось поламано системно,
    // воно видно вже на них, а решту дивитись немає сенсу витрачати час.
    const ordered = [
        ...rows.filter(f => catOf(f) === 'cover'),
        ...rows.filter(f => catOf(f) !== 'cover'),
    ].slice(0, MAX_FILES_PER_ORDER);

    for (const f of ordered) {
        const bucket = f.bucket_name || 'photobook-uploads';
        try {
            const { data: blob, error } = await admin.storage.from(bucket).download(f.file_path);
            if (error || !blob) continue;
            const buf = Buffer.from(await blob.arrayBuffer());
            const img = sharp(buf);
            const [meta, stats] = await Promise.all([img.metadata(), img.stats()]);
            checked++;

            // 1. Порожнеча — жоден канал не має розкиду.
            const flat = (stats.channels || []).length > 0
                && (stats.channels || []).every(c => (c.stdev ?? 0) < FLAT_STDEV);
            if (flat) {
                problems.push(`${f.file_name} — суцільна заливка без вмісту`);
                continue; // розмір такого файлу вже не має значення
            }

            // 2. Розмір — тільки там, де друкарня вимагає точне число.
            const kind = catOf(f);
            if (!geo || (kind !== 'spread' && kind !== 'page')) continue;

            const wantMm = kind === 'page' ? geo.page : geo.sheet;
            const wantW = mmToPx(wantMm.w);
            const wantH = mmToPx(wantMm.h);
            const gotW = meta.width || 0;
            const gotH = meta.height || 0;
            if (Math.abs(gotW - wantW) > SIZE_TOLERANCE_PX || Math.abs(gotH - wantH) > SIZE_TOLERANCE_PX) {
                const mmW = Math.round((gotW * 25.4) / 300);
                const mmH = Math.round((gotH * 25.4) / 300);
                problems.push(
                    `${f.file_name} — ${mmW}×${mmH} мм замість ${wantMm.w}×${wantMm.h}`,
                );
            }
        } catch {
            // Один нечитаний файл не має зупиняти перевірку решти.
        }
    }

    return { checked, problems };
}
