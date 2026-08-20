'use client';

/**
 * Upload one file to Supabase Storage through a server-issued signed URL.
 *
 * Every admin surface used to upload straight from the browser with
 * `supabase.storage.from(bucket).upload(...)`. That request runs under the
 * storage RLS policy, which calls `is_admin()` on the session JWT — and when
 * that claim is not resolvable the write dies with «new row violates row-level
 * security policy», even for someone who is signed into the admin panel and
 * whose email sits in `admin_users`. That is what blocked every product photo
 * on 2026-08-20.
 *
 * It is the same class of bug Diana already hit on 2026-08-13 with the product
 * save itself (see the comment above `save()` in app/admin/products/page.tsx):
 * a browser write subject to RLS. The save was moved server-side back then; the
 * file uploads were left behind.
 *
 * `/api/admin/storage-upload-url` is guarded by `requireAdmin`, picks the
 * destination path itself and returns a one-shot token. The token is the
 * authorisation, so RLS is never consulted. The bytes still travel
 * browser → storage directly, which keeps large photos and videos clear of the
 * few-megabyte request body limit a Vercel route handler would impose.
 */
import { createClient } from '@/lib/supabase/client';

export type UploadTarget =
    | 'product-image'
    | 'product-video'
    | 'product-asset-image'
    | 'product-asset-video';

export async function uploadViaSignedUrl(
    target: UploadTarget,
    file: File,
): Promise<string> {
    const res = await fetch('/api/admin/storage-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, fileName: file.name }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json?.error || `не вдалося отримати посилання на завантаження (HTTP ${res.status})`);
    }

    const { error } = await createClient()
        .storage.from(json.bucket)
        .uploadToSignedUrl(json.path, json.token, file);
    if (error) throw error;

    return json.publicUrl as string;
}
