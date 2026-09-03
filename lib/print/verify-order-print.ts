import sharp from 'sharp';
import { getAdminClient } from '@/lib/supabase/admin';
import { deriveGeometry, normalizeSizeKey, resolveProjectSizeKey, mmToPx, type SizeRow } from '@/lib/print/geometry';
import { referencedPhotoIds } from '@/lib/print/resolve-photo-paths';

/**
 * Чи відповідає надрукований комплект тому, що склала клієнтка.
 *
 * Diana, 2026-08-26: «важливо щоб ти все переглянув та сказав чи макети
 * відповідають тому що складала клієнтка». Дивитися очима на кожен аркуш —
 * саме те, що весь цей тиждень доводилось робити людям, і саме там губилися
 * помилки: обрізані до неправильного розміру розвороти TM-001233, бежева
 * обкладинка TM-001232, дванадцять порожніх аркушів TM-001234.
 *
 * Тут звіряється ЗБЕРЕЖЕНИЙ МАКЕТ із ФАЙЛАМИ, які поїдуть у друк, по кожному
 * виробу окремо:
 *
 *   1. Скільки сторінок у макеті — стільки й файлів. Недостача означає, що
 *      рендер урвався; надлишок — що лишилися файли попереднього макета.
 *   2. Жодна сторінка, на якій у макеті є фото, не приїхала порожньою.
 *   3. Кожне поставлене фото має файл у сховищі: без нього рендер малює
 *      порожнє місце, а «успіх» рендера про це не каже.
 *   4. Розмір файлів той, якого вимагає друкарня.
 *
 * Чого ця перевірка НЕ вміє і не вдає, що вміє: вона не бачить, чи те саме фото
 * стоїть на тій самій сторінці, і не судить про красу. Вона відповідає на
 * питання «чи все на місці», а не «чи гарно».
 */

/** Нижче цього розкиду каналів вважаємо аркуш порожнім. */
const FLAT_STDEV = 1.0;
const SIZE_TOLERANCE_PX = 2;
/** Стеля на замовлення, щоб перевірка вкладалася у час функції. */
const MAX_FILES = 80;
/** Скільки файлів тягнемо одночасно. */
const POOL = 4;

export interface BookVerdict {
    label: string;
    projectId: string;
    designPages: number;
    filePages: number;
    hasCover: boolean;
    photosPlaced: number;
    photosWithoutFile: number;
    blank: string[];
    wrongSize: string[];
    unchecked: number;
    ok: boolean;
    problems: string[];
}

export interface OrderPrintVerdict {
    orderNumber: string | null;
    books: BookVerdict[];
    ok: boolean;
    summary: string;
}

const catOf = (f: { file_category?: string | null; file_name?: string | null }) => {
    const c = String(f.file_category || '').toLowerCase();
    if (c === 'book-cover') return 'cover' as const;
    if (c === 'book-page') return 'page' as const;
    if (c === 'book-spread') return 'spread' as const;
    const n = String(f.file_name || '').toLowerCase();
    if (/cover/.test(n)) return 'cover' as const;
    return 'other' as const;
};

export async function verifyOrderPrint(orderId: string): Promise<OrderPrintVerdict> {
    const admin = getAdminClient();

    const { data: order } = await admin
        .from('orders').select('order_number').eq('id', orderId).maybeSingle();

    const { data: projects } = await admin
        .from('projects')
        .select('id, product_type, format, total_pages, pages_data, cover_data, overlays_data, uploaded_photos, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

    const { data: files } = await admin
        .from('order_files')
        .select('file_name, file_path, bucket_name, file_category')
        .eq('order_id', orderId)
        .eq('file_type', 'export');

    const rows = files || [];
    const books: BookVerdict[] = [];
    let budget = MAX_FILES;

    for (const [i, p] of (projects || []).entries()) {
        const proj: any = p;
        const mine = rows.filter(f => String(f.file_path || '').includes(String(proj.id)));

        const pages = Array.isArray(proj.pages_data) ? proj.pages_data : [];
        // pages_data[0] — обкладинка, решта сторінки.
        const designPages = Math.max(0, pages.length - 1);

        // Скільки фото поставлено і скільки з них має файл у сховищі. Форзаци й
        // текстові сторінки законно порожні, тому далі порожнеча перевіряється
        // не «на кожній сторінці», а тільки там, де фото справді є.
        const referenced = referencedPhotoIds(proj);
        const byId = new Map<string, any>();
        for (const ph of (Array.isArray(proj.uploaded_photos) ? proj.uploaded_photos : [])) {
            if (ph?.id) byId.set(String(ph.id), ph);
        }
        let photosWithoutFile = 0;
        for (const id of referenced) {
            const ph = byId.get(id);
            if (!ph || !ph.path) photosWithoutFile++;
        }

        // Геометрія цього виробу.
        let geo: ReturnType<typeof deriveGeometry> = null;
        try {
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
        } catch { /* без геометрії розмір не перевіряємо */ }

        const pageFiles = mine.filter(f => catOf(f) === 'page' || catOf(f) === 'spread');
        const hasCover = mine.some(f => catOf(f) === 'cover');

        const blank: string[] = [];
        const wrongSize: string[] = [];
        let unchecked = 0;

        const toCheck = mine.slice(0, Math.max(0, budget));
        unchecked += mine.length - toCheck.length;
        budget -= toCheck.length;

        let cursor = 0;
        const worker = async () => {
            for (;;) {
                const idx = cursor++;
                if (idx >= toCheck.length) return;
                const f: any = toCheck[idx];
                try {
                    const bucket = f.bucket_name || 'photobook-uploads';
                    const { data: blob, error } = await admin.storage.from(bucket).download(f.file_path);
                    if (error || !blob) { unchecked++; continue; }
                    const buf = Buffer.from(await blob.arrayBuffer());
                    const img = sharp(buf);
                    const [meta, stats] = await Promise.all([img.metadata(), img.stats()]);

                    const flat = (stats.channels || []).length > 0
                        && (stats.channels || []).every(c => (c.stdev ?? 0) < FLAT_STDEV);
                    if (flat) blank.push(f.file_name);

                    const kind = catOf(f);
                    if (geo && (kind === 'page' || kind === 'spread')) {
                        const wantMm = kind === 'page' ? geo.page : geo.sheet;
                        const dw = Math.abs((meta.width || 0) - mmToPx(wantMm.w));
                        const dh = Math.abs((meta.height || 0) - mmToPx(wantMm.h));
                        if (dw > SIZE_TOLERANCE_PX || dh > SIZE_TOLERANCE_PX) {
                            const mmW = Math.round(((meta.width || 0) * 25.4) / 300);
                            const mmH = Math.round(((meta.height || 0) * 25.4) / 300);
                            wrongSize.push(`${f.file_name} (${mmW}×${mmH} мм замість ${wantMm.w}×${wantMm.h})`);
                        }
                    }
                } catch { unchecked++; }
            }
        };
        await Promise.all(Array.from({ length: Math.min(POOL, toCheck.length) }, worker));

        const problems: string[] = [];
        // ПОРОЖНЯ ЗАДНЯ ОБКЛАДИНКА.
        //
        // На TM-001257 вона пішла у друк суцільною бордовою заливкою, без
        // жодного елемента, а замовлення при цьому мало статус «макет для друку
        // готовий». Це найпомітніший дефект готового виробу: клієнт тримає
        // журнал із порожньою спинкою.
        //
        // У конструкторі попередження вже стоїть, але через нього можна
        // свідомо пройти, а переекспорт дизайнера конструктора взагалі не
        // торкається. Тому та сама перевірка потрібна й тут, де рішення
        // приймає той, хто віддає файли в друк.
        //
        // Сама заливка помилкою не є — колір спинки обирають свідомо. Тому це
        // рядок у звіті перевірки, а не заборона: людина бачить його поруч із
        // рештою і вирішує сама.
        const cover = (proj?.cover_data && typeof proj.cover_data === 'object')
            ? proj.cover_data as Record<string, any> : null;
        if (cover?.backCoverEnabled) {
            const backHasPhoto = !!cover.backCoverPhotoId;
            const backHasText = Array.isArray(cover.backCoverTexts)
                && cover.backCoverTexts.some((b: any) => String(b?.text || '').trim().length > 0);
            if (!backHasPhoto && !backHasText) {
                problems.push('задня обкладинка порожня — лише заливка, без фото і без тексту');
            }
        }
        if (!referenced.size) problems.push('у макеті не розставлено жодного фото — це порожня чернетка');
        if (!hasCover) problems.push('немає файлу обкладинки');
        if (pageFiles.length === 0) problems.push('немає жодного файлу сторінок');
        else if (pageFiles.length < designPages) problems.push(`сторінок у файлах ${pageFiles.length}, а в макеті ${designPages} — рендер не дійшов до кінця`);
        else if (pageFiles.length > designPages) problems.push(`сторінок у файлах ${pageFiles.length}, а в макеті ${designPages} — лишилися файли попереднього макета`);
        if (photosWithoutFile > 0) problems.push(`${photosWithoutFile} поставлених фото не мають файлу у сховищі — на папері буде порожньо`);
        if (blank.length) problems.push(`порожні аркуші: ${blank.slice(0, 8).join(', ')}${blank.length > 8 ? ` і ще ${blank.length - 8}` : ''}`);
        if (wrongSize.length) problems.push(`не той розмір: ${wrongSize.slice(0, 4).join('; ')}${wrongSize.length > 4 ? ` і ще ${wrongSize.length - 4}` : ''}`);
        if (unchecked > 0) problems.push(`${unchecked} файлів не вдалося перевірити — перевірте вручну`);

        books.push({
            label: `Виріб ${i + 1}${proj.format ? ` · ${proj.format}` : ''} · ${designPages} стор.`,
            projectId: String(proj.id),
            designPages,
            filePages: pageFiles.length,
            hasCover,
            photosPlaced: referenced.size,
            photosWithoutFile,
            blank,
            wrongSize,
            unchecked,
            ok: problems.length === 0,
            problems,
        });
    }

    const bad = books.filter(b => !b.ok);
    return {
        orderNumber: (order as any)?.order_number || null,
        books,
        ok: bad.length === 0 && books.length > 0,
        summary: books.length === 0
            ? 'До замовлення не привʼязано жодного макета.'
            : bad.length === 0
                ? `Перевірено ${books.length} виріб(ів) — усі файли на місці й відповідають макету.`
                : `${bad.length} з ${books.length} виробів мають проблеми.`,
    };
}
