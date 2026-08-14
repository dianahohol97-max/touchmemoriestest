import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveUploadLink, countLinkUpload } from '@/lib/orders/upload-links';
import { sendWorkChatAlert } from '@/lib/chatbot/telegram-business';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The customer's own upload endpoint: one file per request, straight into the
 * order-files bucket, authorised by the link token alone.
 *
 * One file per request on purpose. That is the whole point of the page — a
 * failed 18 MB photo is retried by itself instead of taking the other forty
 * with it, which is exactly how Telegram lost them (Diana, 2026-08-14).
 */

const BUCKET = 'order-files';
const MAX_BYTES = 60 * 1024 * 1024;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif|avif|gif)|application\/pdf|video\/(mp4|quicktime))$/i;

/** What the page shows before anything is uploaded. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const link = await resolveUploadLink(token);
    if (!link) return NextResponse.json({ error: 'link-invalid' }, { status: 404 });

    return NextResponse.json({
        ok: true,
        // The batch usually has no order yet — a Telegram order reaches the
        // CRM hours later — so the page greets by the label the manager gave
        // it and never promises an order number it does not have.
        label: link.label,
        orderNumber: link.orderNumber,
        uploads: link.uploads,
        expiresAt: link.expiresAt,
    });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const link = await resolveUploadLink(token);
    if (!link) return NextResponse.json({ error: 'link-invalid' }, { status: 404 });

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: 'bad-form' }, { status: 400 });
    }

    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'no-file' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too-big' }, { status: 413 });

    const type = String(file.type || '').toLowerCase();
    if (type && !ALLOWED.test(type)) return NextResponse.json({ error: 'bad-type' }, { status: 415 });

    // The original name is kept for the workshop but never used as a path: a
    // customer's file name can contain anything at all.
    const safeName = String(file.name || 'photo.jpg').replace(/[^\w.\-()Ѐ-ӿ ]+/g, '_').slice(0, 120);
    // Filed under the batch code while there is no order; the code is what the
    // manager pastes into the CRM comment.
    const folder = link.orderNumber || link.code || 'batch';
    const path = `client-uploads/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

    const supabase = getAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: type || 'application/octet-stream', upsert: false });
    if (upErr) {
        console.error('[upload-link] storage failed:', upErr.message);
        return NextResponse.json({ error: 'storage', detail: upErr.message }, { status: 500 });
    }

    // With an order — straight onto its card. Without one — into the batch,
    // which a manager attaches later.
    if (link.orderId) {
        const { error: rowErr } = await supabase.from('order_files').insert({
            order_id: link.orderId,
            file_path: path,
            file_name: safeName,
            file_type: type.startsWith('video/') ? 'video' : 'image',
            file_category: 'client_upload',
            bucket_name: BUCKET,
            file_size: file.size,
            mime_type: type || null,
        });
        if (rowErr) console.error('[upload-link] order_files insert failed:', rowErr.message);
    } else {
        const { error: rowErr } = await supabase.from('upload_session_files').insert({
            token,
            file_path: path,
            file_name: safeName,
            bucket_name: BUCKET,
            file_size: file.size,
            mime_type: type || null,
        });
        if (rowErr) console.error('[upload-link] session insert failed:', rowErr.message);
    }

    await countLinkUpload(token);

    // The first file of a batch is worth a word in the work chat: nobody is
    // watching a page they sent to a customer an hour ago.
    if (link.uploads === 0) {
        const who = link.label || link.orderNumber || link.code;
        sendWorkChatAlert(`📥 Пішли фото від «${who}» (${link.code}). Прикріпити до замовлення: /upload <номер> ${link.code}`)
            .catch(e => console.error('[upload-link] alert failed:', e));
    }

    return NextResponse.json({ ok: true, name: safeName });
}
