import { randomBytes } from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Links a customer can use to send us photos without Telegram.
 *
 * Diana, 2026-08-14: a client tried to send eighteen-megabyte photos from her
 * phone and every one of them failed — Telegram gave up on a weak mobile
 * connection. A link straight into our storage removes the middleman: the
 * browser sends one file at a time and retries only the one that failed.
 *
 * The link exists BEFORE the order does, and that is the whole design. A
 * Telegram order reaches KeyCRM hours later — «maybe today in afternoon» — so
 * the manager opens a link for a PERSON, the photos arrive into a batch, and
 * the batch is attached to the order once it exists (or its link is simply
 * pasted into the CRM comment, which is how the team works today).
 *
 * The token is the credential: 32 random bytes, expiring, revocable, and good
 * for exactly one thing — adding files to one batch.
 */

const DEFAULT_DAYS = 30;

export type UploadLink = {
    token: string;
    code: string;
    label: string;
    orderId: string | null;
    orderNumber: string | null;
    expiresAt: string;
    uploads: number;
};

export function uploadLinkUrl(token: string): string {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';
    return `${base}/uk/upload/${token}`;
}

/** Short, sayable, unambiguous: no O/0/I/1. */
function shortCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (const byte of randomBytes(4)) out += alphabet[byte % alphabet.length];
    return `Ф-${out}`;
}

/** A fresh batch for a person — no order needed, and usually none exists yet. */
export async function createUploadLink(label: string, days = DEFAULT_DAYS): Promise<UploadLink | null> {
    const supabase = getAdminClient();
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const code = shortCode();

    const { error } = await supabase
        .from('order_upload_links')
        .insert({ token, code, label: String(label || '').slice(0, 120) || null, expires_at: expiresAt });
    if (error) {
        console.error('[upload-links] create failed:', error);
        return null;
    }

    return { token, code, label, orderId: null, orderNumber: null, expiresAt, uploads: 0 };
}

async function describe(row: any): Promise<UploadLink | null> {
    if (!row) return null;

    let orderNumber: string | null = null;
    if (row.order_id) {
        const { data: order } = await getAdminClient()
            .from('orders').select('order_number').eq('id', row.order_id).maybeSingle();
        orderNumber = order?.order_number ?? null;
    }

    return {
        token: row.token,
        code: row.code || '',
        label: row.label || '',
        orderId: row.order_id ?? null,
        orderNumber,
        expiresAt: row.expires_at,
        uploads: row.uploads ?? 0,
    };
}

/** Resolve a token, or null when it is unknown, expired or revoked. */
export async function resolveUploadLink(token: string): Promise<UploadLink | null> {
    if (!token || token.length < 20) return null;

    const { data } = await getAdminClient()
        .from('order_upload_links')
        .select('token, code, label, order_id, expires_at, revoked, uploads')
        .eq('token', token)
        .maybeSingle();

    if (!data || data.revoked) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return describe(data);
}

/** The same, by the short code managers paste into a CRM comment. */
export async function findUploadLinkByCode(code: string): Promise<UploadLink | null> {
    const normalised = String(code || '').trim().toUpperCase().replace(/^Ф-?/u, '');
    if (normalised.length < 3) return null;

    const { data } = await getAdminClient()
        .from('order_upload_links')
        .select('token, code, label, order_id, expires_at, revoked, uploads')
        .eq('code', `Ф-${normalised}`)
        .maybeSingle();
    return data ? describe(data) : null;
}

export async function countLinkUpload(token: string): Promise<void> {
    const supabase = getAdminClient();
    const { data } = await supabase.from('order_upload_links').select('uploads').eq('token', token).maybeSingle();
    await supabase
        .from('order_upload_links')
        .update({ uploads: (data?.uploads ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq('token', token);
}

/**
 * Attach a batch to the order it turned out to belong to. The files stay where
 * they are in storage; what changes is that the order now knows about them.
 */
export async function attachBatchToOrder(token: string, orderId: string): Promise<{ attached: number }> {
    const supabase = getAdminClient();

    const { data: files } = await supabase
        .from('upload_session_files')
        .select('id, file_path, file_name, bucket_name, file_size, mime_type')
        .eq('token', token)
        .is('attached_order_id', null);

    let attached = 0;
    for (const f of files || []) {
        const { error } = await supabase.from('order_files').insert({
            order_id: orderId,
            file_path: (f as any).file_path,
            file_name: (f as any).file_name,
            file_type: String((f as any).mime_type || '').startsWith('video/') ? 'video' : 'image',
            file_category: 'client_upload',
            bucket_name: (f as any).bucket_name,
            file_size: (f as any).file_size,
            mime_type: (f as any).mime_type,
        });
        if (error) {
            console.error('[upload-links] attach failed:', error.message);
            continue;
        }
        await supabase.from('upload_session_files').update({ attached_order_id: orderId }).eq('id', (f as any).id);
        attached++;
    }

    await supabase.from('order_upload_links').update({ order_id: orderId }).eq('token', token);
    return { attached };
}
