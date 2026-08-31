import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { isAllowedUpload, IMAGE_OR_PDF_RULE } from '@/lib/upload/file-type';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/orders/[id]/upload-photos
 *
 * A manager attaches the customer's photos to an order by hand (Diana,
 * 2026-08-12, after TM-001175 arrived with none: «менеджер дійсно може
 * завантажити фото на сайт в картку замовлення?» — until now, no).
 *
 * When a customer's upload dies mid-checkout, the photos exist only on their
 * phone; they re-send them in Telegram or Instagram and somebody has to get
 * them into the order. The workaround was a Google Drive link in a text field,
 * which production cannot print from and no report can see.
 *
 * Files land in the SAME place a customer's own upload does — the `order-files`
 * bucket under the order's customer folder, registered in `order_files` — so
 * the admin card, the designer constructor and the print pipeline all see them
 * without knowing who put them there. file_category records that a manager
 * did, and the order history keeps the name of the person.
 *
 * Deliberately NOT clearing the ⚠️ warning on the order: the note says the
 * CUSTOMER's upload failed, which stays true and is worth seeing next to the
 * files a manager rescued.
 */
const MAX_FILES = 60;
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'order id required' }, { status: 400 });

    const admin = getAdminClient();

    const { data: order } = await admin
        .from('orders')
        .select('id, order_number, customer_id, items')
        .eq('id', id)
        .maybeSingle();

    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: 'Очікується форма з файлами' }, { status: 400 });
    }

    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: 'Не вибрано жодного файлу' }, { status: 400 });
    if (files.length > MAX_FILES) {
        return NextResponse.json({ error: `За раз можна завантажити не більше ${MAX_FILES} файлів.` }, { status: 400 });
    }

    // The customer folder keys this order's storage, exactly as the customer's
    // own upload does; orders without a customer (guest checkout) fall back to
    // the order id so the files still live somewhere predictable.
    const folder = String((order as any).customer_id || `order-${order.id}`);
    const stamp = Date.now();
    const prefix = `${folder}/manager_${stamp}`;

    const uploaded: Array<{ name: string; path: string }> = [];
    const problems: string[] = [];

    for (const [index, file] of files.entries()) {
        if (file.size > MAX_BYTES) {
            problems.push(`${file.name}: більший за 25 МБ`);
            continue;
        }
        // isAllowedUpload falls back to the extension when the client sends
        // no Content-Type, instead of skipping the check as `file.type &&` did.
        if (!isAllowedUpload(file.name, file.type, IMAGE_OR_PDF_RULE)) {
            problems.push(`${file.name}: непідтримуваний тип (${file.type || 'без типу'})`);
            continue;
        }

        // Names arrive from a human's phone — spaces, Cyrillic, emoji. The
        // stored path is sanitised; the original name is kept in the row, which
        // is what the admin card and the print sheet show.
        const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80) || `photo_${index + 1}.jpg`;
        const path = `${prefix}/${String(index + 1).padStart(3, '0')}_${safe}`;

        const buffer = Buffer.from(await file.arrayBuffer());
        const { error: upErr } = await admin.storage
            .from('order-files')
            .upload(path, buffer, {
                contentType: file.type || 'image/jpeg',
                cacheControl: '31536000',
                upsert: false,
            });

        if (upErr) {
            problems.push(`${file.name}: ${upErr.message}`);
            continue;
        }

        const { error: rowErr } = await admin.from('order_files').insert({
            order_id: order.id,
            file_path: path,
            file_name: file.name,
            file_type: 'upload',
            file_category: 'manager-upload',
            bucket_name: 'order-files',
            file_size: file.size,
            mime_type: file.type || 'image/jpeg',
        });

        if (rowErr) {
            problems.push(`${file.name}: файл завантажено, але не зареєстровано (${rowErr.message})`);
            continue;
        }

        uploaded.push({ name: file.name, path });
    }

    if (uploaded.length) {
        await admin.from('order_history').insert({
            order_id: order.id,
            action: 'manager_photos_uploaded',
            notes: `Менеджер завантажив ${uploaded.length} фото в замовлення.`,
            added_by: null,
        });
    }

    return NextResponse.json({
        ok: uploaded.length > 0,
        uploaded: uploaded.length,
        problems,
    });
}
