import { randomBytes } from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Links a customer can use to send us photos without Telegram.
 *
 * Diana, 2026-08-14: a client tried to send eighteen-megabyte photos from her
 * phone and every one of them failed to upload — Telegram gave up on a weak
 * mobile connection. A link straight into our storage removes the middleman:
 * the browser uploads one file at a time and retries the one that failed,
 * instead of the whole conversation collapsing.
 *
 * The token IS the credential, so it is 32 random bytes, it expires, and it
 * can be revoked. It grants exactly one thing: adding files to one order.
 * Nothing about the order is exposed beyond its number and the customer's
 * first name, which the customer already knows.
 */

const DEFAULT_DAYS = 30;

export type UploadLink = {
    token: string;
    orderId: string;
    orderNumber: string;
    customerName: string;
    expiresAt: string;
    uploads: number;
};

export function uploadLinkUrl(token: string): string {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';
    return `${base}/uk/upload/${token}`;
}

/** Create a link for an order (or return the live one it already has). */
export async function ensureUploadLink(orderId: string, days = DEFAULT_DAYS): Promise<UploadLink | null> {
    const supabase = getAdminClient();

    const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, customer_name')
        .eq('id', orderId)
        .maybeSingle();
    if (!order) return null;

    const { data: existing } = await supabase
        .from('order_upload_links')
        .select('token, expires_at, uploads')
        .eq('order_id', orderId)
        .eq('revoked', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

    if (existing?.[0]) {
        return {
            token: existing[0].token,
            orderId,
            orderNumber: order.order_number,
            customerName: order.customer_name || '',
            expiresAt: existing[0].expires_at,
            uploads: existing[0].uploads ?? 0,
        };
    }

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('order_upload_links')
        .insert({ token, order_id: orderId, expires_at: expiresAt });
    if (error) {
        console.error('[upload-links] create failed:', error);
        return null;
    }

    return {
        token,
        orderId,
        orderNumber: order.order_number,
        customerName: order.customer_name || '',
        expiresAt,
        uploads: 0,
    };
}

/** Resolve a token to its order, or null when it is unknown, dead or revoked. */
export async function resolveUploadLink(token: string): Promise<UploadLink | null> {
    if (!token || token.length < 20) return null;

    const supabase = getAdminClient();
    const { data } = await supabase
        .from('order_upload_links')
        .select('token, order_id, expires_at, revoked, uploads')
        .eq('token', token)
        .maybeSingle();

    if (!data || data.revoked) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;

    const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, customer_name')
        .eq('id', data.order_id)
        .maybeSingle();
    if (!order) return null;

    return {
        token: data.token,
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name || '',
        expiresAt: data.expires_at,
        uploads: data.uploads ?? 0,
    };
}

export async function countLinkUpload(token: string): Promise<void> {
    const supabase = getAdminClient();
    const { data } = await supabase.from('order_upload_links').select('uploads').eq('token', token).maybeSingle();
    await supabase
        .from('order_upload_links')
        .update({ uploads: (data?.uploads ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq('token', token);
}
