import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/supabase/like-escape';

/**
 * GET /api/designer/order-photos?order_id=<uuid>
 *
 * Returns the customer's uploaded photos for a designer order as signed URLs,
 * so the layout constructor (BookLayoutEditor in designer_mode) and the admin
 * order page can actually show / load them.
 *
 * Background: the designer-order flow uploads the customer's photos to the
 * `order-files` Storage bucket and links them in `order_files`
 * (file_type='upload', category 'designer-order' / 'designer-cover'). Nothing
 * on the consumption side ever read them back — the constructor opened with an
 * empty photo pool and the admin "Файли" card only showed a manual Drive link.
 * This endpoint is that missing read path.
 *
 * Staff-only (admin_users OR staff), mirroring /api/designer/free-orders.
 */
export async function GET(req: NextRequest) {
    const cookieClient = await createClient();
    const { data: { user } } = await cookieClient.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();

    // Allow admin or any staff member (same gate as the free-order queue).
    let allowed = false;
    if (user.email) {
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('id')
            .ilike('email', likeEscape(user.email))
            .maybeSingle();
        if (adminRow) allowed = true;

        if (!allowed) {
            const { data: staffRow } = await admin
                .from('staff')
                .select('id')
                .ilike('email', likeEscape(user.email))
                .maybeSingle();
            if (staffRow) allowed = true;
        }
    }

    if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orderId = req.nextUrl.searchParams.get('order_id');
    if (!orderId) {
        return NextResponse.json({ error: 'order_id required' }, { status: 400 });
    }

    // The order's customer_id doubles as the storage folder key for this order's
    // files (order-files/{customer_id}/...), so we need it for the fallback scan.
    const { data: orderRow } = await admin
        .from('orders')
        .select('customer_id, items')
        .eq('id', orderId)
        .maybeSingle();
    const customerFolder = (orderRow as any)?.customer_id || null;
    // Product ids of THIS order — the folder scan below may only surface
    // sub-folders that belong to one of them. The customer folder is shared by
    // every order of the customer, and an unfiltered scan pulled a photoprint
    // order's 101 files into a wishbook's card as its «макет» (TM-001180).
    const orderProductIds = new Set(
        (Array.isArray((orderRow as any)?.items) ? (orderRow as any).items : [])
            .map((i: any) => String(i?.product_id || ''))
            .filter(Boolean),
    );

    // Travel-book cover: the chosen cover URL never reaches order.items[] — it
    // only lives in the saved design. Two shapes: a catalog city/landmark cover
    // (overlays_data.config.selectedCover) or a PRINTED cover whose background
    // photo lives in cover_data.printedBgImage. Resolve either so the admin card
    // can show which cover the client picked.
    let coverImageUrl: string | null = null;
    // The cover's NAME, when it is one of ours. A picture alone made the card
    // say «якась готова обкладинка» and left the girls to recognise the city by
    // eye; the design now records which cover was applied, so say it out loud.
    let coverName: string | null = null;
    try {
        const { data: projs } = await admin
            .from('projects')
            .select('overlays_data, cover_data')
            .eq('order_id', orderId)
            .limit(5);
        for (const p of (projs || []) as any[]) {
            const sc = p?.overlays_data?.config?.selectedCover;
            const cd = p?.cover_data;
            const url = sc?.image_url || sc?.thumbnail_url || cd?.printedBgImage || cd?.printedPhotoUrl;
            if (url) {
                coverImageUrl = url;
                coverName = cd?.readyCoverName || sc?.city_name || sc?.name || null;
                break;
            }
        }
    } catch { /* non-critical: card falls back to files/catalog */ }

    // Книги замовлення. Одне замовлення може містити кілька окремих виробів
    // (TM-001234 — пʼять тревелбуків), і кожен має свій макет. Файли всіх пʼяти
    // лежать в одній таблиці з однаковими іменами «01.jpg», «cover.jpg», тож без
    // цієї прив'язки картка показує їх однією купою, у якій неможливо
    // розібратися, який аркуш до якої книги.
    const books: Array<{ id: string; pages: number | null; label: string; isPrintSet: boolean; slug: string | null }> = [];
    try {
        const { data: projRows } = await admin
            .from('projects')
            .select('id, total_pages, format, created_at, product_type, cart_payload')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true });
        (projRows || []).forEach((p: any, i: number) => {
            const pages = typeof p.total_pages === 'number' ? p.total_pages : null;
            // Конструктор фотодруку теж зберігає сесію в projects, з
            // product_type='photo-print'. Такий «виріб» НЕ має макета: його
            // результат — готові відбитки у pp_<ts>, які не лежать під id
            // проєкту, тож bookOf() не привʼязує до нього жодного файлу.
            // Картка через це малювала полароїд і 9x13 як два вироби з
            // червоним «Макета немає взагалі — не віддавайте в друк»
            // (TM-001252), хоча всі 70 відбитків були на місці, і ще й
            // підписувала їх «20 стор.» — сесія зберегла проміжну кількість,
            // до товару з 50 фото вона не має стосунку. Прапорець дозволяє
            // адмінці не показувати їх серед макетів.
            const slug = typeof p?.cart_payload?.slug === 'string' ? p.cart_payload.slug : null;
            const isPrintSet = String(p.product_type || '').toLowerCase() === 'photo-print';
            books.push({
                id: String(p.id),
                pages,
                label: `Виріб ${i + 1}${p.format ? ` · ${p.format}` : ''}${pages ? ` · ${pages} стор.` : ''}`,
                isPrintSet,
                slug,
            });
        });
    } catch { /* без списку книг картка просто не групуватиме */ }
    const bookIds = new Set(books.map(b => b.id));
    /** id макета, до якого належить файл — шукається у шляху сховища. */
    const bookOf = (path: string): string | null => {
        for (const seg of String(path || '').split('/')) {
            if (bookIds.has(seg)) return seg;
        }
        return null;
    };

    /**
     * Партія фотодруку, до якої належить файл.
     *
     * PhotoPrintConstructor складає всі відбитки ОДНОГО товару в кошику у теку
     * pp_<timestamp> (exportFolderRef, один на сесію конструктора), тож цей
     * сегмент шляху — єдине, що надійно розділяє два різні фотодруки в одному
     * замовленні. Без нього картка показувала 20 полароїдів і 50 фото 9x13
     * однією купою з 70 мініатюр, і виробництво не могло зрозуміти, де чиї
     * (TM-001252).
     */
    const printBatchOf = (path: string): string | null =>
        String(path || '').split('/').find(seg => /^pp_\d+$/.test(seg)) || null;

    const { data: files, error } = await admin
        .from('order_files')
        .select('id, file_path, file_name, file_category, bucket_name, page_number, mime_type, file_type')
        .eq('order_id', orderId)
        .in('file_type', ['upload', 'export'])
        .order('page_number', { ascending: true, nullsFirst: true })
        .order('file_name', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Do NOT early-return on an empty table: magnet-only orders keep their
    // print files only in storage (scanned further below), with no order_files
    // rows at all — an early return here is exactly why they showed nothing.
    const fileRows = files || [];

    // Sign in batches per bucket (createSignedUrls returns results aligned to
    // the input path order).
    const byBucket: Record<string, typeof fileRows> = {};
    for (const f of fileRows) {
        const bucket = f.bucket_name || 'order-files';
        (byBucket[bucket] ||= []).push(f);
    }

    const photos: Array<{
        id: string;
        name: string;
        url: string | null;
        category: string | null;
        isCover: boolean;
        isExport: boolean;
        page_number: number | null;
        mime_type: string | null;
        product_id?: string | null;
        bookId?: string | null;
        printBatch?: string | null;
    }> = [];

    const ONE_DAY = 60 * 60 * 24;
    for (const [bucket, list] of Object.entries(byBucket)) {
        const paths = list.map(f => f.file_path);
        const { data: signed } = await admin.storage.from(bucket).createSignedUrls(paths, ONE_DAY);
        (signed || []).forEach((s, i) => {
            const f = list[i];
            photos.push({
                id: f.id,
                name: f.file_name,
                url: s?.signedUrl || null,
                category: f.file_category,
                isCover: (f.file_category || '').toLowerCase().includes('cover'),
                // Imposition sheets (file_type='print_sheet') are print
                // artifacts too — they belong in «Макет для друку» and in the
                // «Тільки макет» ZIP, not among the client's raw photos.
                isExport: f.file_type === 'export' || f.file_type === 'print_sheet',
                page_number: f.page_number,
                mime_type: f.mime_type,
                product_id: null,
                bookId: bookOf(f.file_path),
                printBatch: printBatchOf(f.file_path),
            });
        });
    }

    // Fallback: some product flows (photo-magnets in particular) upload their
    // print-ready files to order-files/{customer_id}/{product_id}_{ts}/ but never
    // register an order_files row — so the query above misses them entirely and
    // the card had nothing to show. Enumerate that folder directly and surface
    // anything found, tagged with the product_id parsed from the sub-folder name
    // so the card can match each file to the right order item.
    if (customerFolder) {
        try {
            // Paths already registered in order_files are served above with their
            // REAL category. Re-surfacing them here would duplicate each photo as
            // a fake isExport tile — poster orders showed their raw slot photos
            // under "Макет для друку · готовий" even when no composite existed.
            const registered = new Set(fileRows.map((f) => f.file_path));
            const { data: subdirs } = await admin.storage.from('order-files').list(customerFolder, { limit: 200 });
            for (const dir of (subdirs || []) as any[]) {
                if (!dir?.name || dir.id) continue; // folders have id === null; skip stray top-level files
                const productId = String(dir.name).split('_')[0] || null;
                // Only folders traceable to THIS order's items. The customer
                // folder holds every order of the customer — photoprint export
                // folders (pp_<ts>) and other orders' product folders must not
                // masquerade as this order's макет.
                if (!productId || !orderProductIds.has(productId)) continue;
                const prefix = `${customerFolder}/${dir.name}`;
                const { data: entries } = await admin.storage.from('order-files').list(prefix, { limit: 200 });
                const dirFiles = ((entries || []) as any[]).filter((f) => f?.id && f.name && !registered.has(`${prefix}/${f.name}`));
                if (!dirFiles.length) continue;
                const paths = dirFiles.map((f) => `${prefix}/${f.name}`);
                const { data: signed } = await admin.storage.from('order-files').createSignedUrls(paths, ONE_DAY);
                (signed || []).forEach((sg: any, i: number) => {
                    const f = dirFiles[i];
                    if (!f) return;
                    photos.push({
                        id: `${prefix}/${f.name}`,
                        name: f.name,
                        url: sg?.signedUrl || null,
                        category: 'print',
                        isCover: false,
                        isExport: true,
                        page_number: null,
                        mime_type: f.metadata?.mimetype || null,
                        product_id: productId,
                    });
                });
            }
        } catch { /* non-critical: card falls back to catalog image */ }
    }

    // Fallback: constructor / "оформити повторно" orders keep the customer's
    // photos in the linked `projects` row (uploaded_photos), NOT in order_files —
    // the print files only get rendered on payment. So an order that hasn't been
    // rendered yet (typically still unpaid) showed an EMPTY card even though the
    // full design exists, and the missing-print-files cron even flagged it as
    // "макет відсутній". If we surfaced no customer uploads above, read them from
    // the linked project(s) and sign them from their own bucket.
    const hasUploads = photos.some(p => !p.isExport);
    if (!hasUploads) {
        try {
            const { data: projs } = await admin
                .from('projects')
                .select('uploaded_photos, cover_data, pages_data, overlays_data')
                .eq('order_id', orderId)
                .limit(5);
            for (const pr of (projs || []) as any[]) {
                const allUps = Array.isArray(pr?.uploaded_photos) ? pr.uploaded_photos : [];
                // Only photos the design actually USES. The project keeps the
                // whole upload library, so a photo added and then removed from
                // the cover stayed in the card — staff saw «фото є» on an order
                // whose макет has no photo at all (wishbook, 2026-08-07).
                const usedIds = new Set<string>();
                const collect = (v: any) => { if (typeof v === 'string' && v) usedIds.add(v); };
                for (const page of (Array.isArray(pr?.pages_data) ? pr.pages_data : [])) {
                    for (const s of (Array.isArray(page?.slots) ? page.slots : [])) collect(s?.photoId);
                }
                const freeSlots = pr?.overlays_data?.freeSlots || {};
                for (const arr of Object.values(freeSlots)) {
                    for (const s of (Array.isArray(arr) ? arr : [])) collect((s as any)?.photoId);
                }
                const cd: any = pr?.cover_data || {};
                for (const cp of (Array.isArray(cd?.coverPhotos) ? cd.coverPhotos : [])) collect(cp?.photoId);
                for (const ps of (Array.isArray(cd?.printedPhotoSlots) ? cd.printedPhotoSlots : [])) collect(ps?.photoId);
                // cover_data.photoId is a LEFTOVER when a ready cover was
                // applied afterwards (printedBgImage set, photo slot removed):
                // flagging that photo as «обкладинка» showed a random customer
                // photo instead of the ready cover Alina chose. The ready
                // artwork itself is the cover in that case — and the leftover
                // photo does NOT count as used.
                const slot: any = cd?.printedPhotoSlot;
                const slotRemoved = slot && !((slot.w ?? 0) > 0 && (slot.h ?? 0) > 0);
                const usesReadyCover = !!cd?.printedBgImage;
                const coverPhotoId = (usesReadyCover || slotRemoved) ? null : (cd?.photoId || null);
                if (usesReadyCover && !coverImageUrl) {
                    coverImageUrl = String(cd.printedBgImage);
                    coverName = cd?.readyCoverName || coverName;
                }
                collect(coverPhotoId);
                const ups = allUps.filter((u: any) => usedIds.has(u?.id));
                const byB: Record<string, any[]> = {};
                for (const up of ups) {
                    if (up?.path) (byB[up.bucket || 'photobook-uploads'] ||= []).push(up);
                }
                for (const [bucket, list] of Object.entries(byB)) {
                    const paths = list.map((u: any) => u.path);
                    const { data: signed } = await admin.storage.from(bucket).createSignedUrls(paths, ONE_DAY);
                    (signed || []).forEach((s: any, i: number) => {
                        const u = list[i];
                        photos.push({
                            id: `project:${u.id}`,
                            name: u.name || 'photo',
                            url: s?.signedUrl || null,
                            category: 'upload',
                            isCover: !!coverPhotoId && u.id === coverPhotoId,
                            isExport: false,
                            page_number: null,
                            mime_type: null,
                            product_id: null,
                        });
                    });
                }
            }
        } catch { /* non-critical: card falls back to catalog image */ }
    }

    // Export (print-ready) files first, then covers, so staff see the final
    // layout at the top of the grid; raw customer uploads follow.
    photos.sort((a, b) => (Number(b.isExport) - Number(a.isExport)) || (Number(b.isCover) - Number(a.isCover)));

    return NextResponse.json({ photos, coverImageUrl, coverName, books });
}
