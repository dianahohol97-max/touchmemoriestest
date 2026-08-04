import { S3Client, PutObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAdminClient } from '@/lib/supabase/admin';
import { GALLERY_BUCKET } from './helpers';

/**
 * Storage backend for photographer gallery files.
 *
 * Supabase egress ($0.09/GB) is what makes galleries expensive — a single
 * 400-photo gallery browsed by the couple and their families runs ~11 GB.
 * Cloudflare R2 charges nothing for egress, so gallery FILES move there
 * while the database, auth and every other bucket stay on Supabase
 * (Diana, 2026-08-04).
 *
 * The switch is env-driven and per-file: when R2 credentials are present new
 * uploads go to R2 and their rows record storage_provider='r2'; without the
 * env the code behaves exactly as before. Existing Supabase files keep
 * working forever because every read resolves the URL from the row's own
 * provider — galleries expire in 30–90 days, so the old ones simply age out
 * and no migration is needed.
 *
 * Required env (Vercel → Settings → Environment Variables):
 *   R2_ACCOUNT_ID        Cloudflare account id (the S3 endpoint host)
 *   R2_ACCESS_KEY_ID     R2 API token key
 *   R2_SECRET_ACCESS_KEY R2 API token secret
 *   R2_BUCKET            bucket name, e.g. touchmemories-galleries
 *   R2_PUBLIC_BASE_URL   public base, e.g. https://pub-xxxx.r2.dev
 *                        (or a custom domain bound to the bucket)
 */

export type StorageProvider = 'supabase' | 'r2';

const R2 = {
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET || '',
  publicBase: (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
};

export function isR2Configured(): boolean {
  return Boolean(R2.accountId && R2.accessKeyId && R2.secretAccessKey && R2.bucket && R2.publicBase);
}

/** Where NEW uploads go. Reads always follow the row's stored provider. */
export function activeProvider(): StorageProvider {
  return isR2Configured() ? 'r2' : 'supabase';
}

let client: S3Client | null = null;
function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
    });
  }
  return client;
}

/** Public URL of a stored file, resolved by the provider the row recorded. */
export function fileUrl(path: string, provider?: string | null): string {
  if (provider === 'r2' && R2.publicBase) {
    // Keep the slashes of the key, escape everything else.
    return `${R2.publicBase}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  const admin = getAdminClient();
  return admin.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Server-side upload (photos, branding, demo seeding). */
export async function putFile(path: string, body: Buffer, contentType: string):
  Promise<{ provider: StorageProvider } | { error: string }> {
  if (isR2Configured()) {
    try {
      await r2().send(new PutObjectCommand({
        Bucket: R2.bucket, Key: path, Body: body, ContentType: contentType,
      }));
      return { provider: 'r2' };
    } catch (e: any) {
      return { error: e?.message || 'R2 upload failed' };
    }
  }
  const admin = getAdminClient();
  const { error } = await admin.storage
    .from(GALLERY_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) return { error: error.message };
  return { provider: 'supabase' };
}

/** Single-use upload URL for large files the browser PUTs directly
 *  (videos — they exceed the serverless request body limit). */
export async function presignUpload(path: string, contentType: string):
  Promise<{ url: string; provider: StorageProvider } | { error: string }> {
  if (isR2Configured()) {
    try {
      const url = await getSignedUrl(
        r2(),
        new PutObjectCommand({ Bucket: R2.bucket, Key: path, ContentType: contentType }),
        { expiresIn: 60 * 30 },
      );
      return { url, provider: 'r2' };
    } catch (e: any) {
      return { error: e?.message || 'R2 presign failed' };
    }
  }
  const admin = getAdminClient();
  const { data, error } = await admin.storage.from(GALLERY_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message || 'Не вдалося підготувати аплоад' };
  return { url: data.signedUrl, provider: 'supabase' };
}

/** Verify an object really landed (never trust the client's word on a
 *  direct-to-storage upload) and report its size. */
export async function fileExists(path: string, provider: StorageProvider):
  Promise<{ ok: boolean; size?: number }> {
  if (provider === 'r2') {
    try {
      const head = await r2().send(new HeadObjectCommand({ Bucket: R2.bucket, Key: path }));
      return { ok: true, size: head.ContentLength ?? undefined };
    } catch {
      return { ok: false };
    }
  }
  const admin = getAdminClient();
  const dir = path.slice(0, path.lastIndexOf('/'));
  const base = path.slice(path.lastIndexOf('/') + 1);
  const { data } = await admin.storage.from(GALLERY_BUCKET).list(dir, { search: base, limit: 1 });
  const obj = (data || []).find(o => o.name === base);
  return obj ? { ok: true, size: (obj.metadata as any)?.size } : { ok: false };
}

/** Delete files, grouped by the provider each one lives on. */
export async function removeFiles(files: { path: string; provider?: string | null }[]): Promise<string | null> {
  const r2Keys = files.filter(f => f.provider === 'r2').map(f => f.path);
  const sbKeys = files.filter(f => f.provider !== 'r2').map(f => f.path);

  if (r2Keys.length && isR2Configured()) {
    for (let i = 0; i < r2Keys.length; i += 1000) {
      try {
        await r2().send(new DeleteObjectsCommand({
          Bucket: R2.bucket,
          Delete: { Objects: r2Keys.slice(i, i + 1000).map(Key => ({ Key })) },
        }));
      } catch (e: any) {
        return e?.message || 'R2 delete failed';
      }
    }
  }
  if (sbKeys.length) {
    const admin = getAdminClient();
    for (let i = 0; i < sbKeys.length; i += 100) {
      const { error } = await admin.storage.from(GALLERY_BUCKET).remove(sbKeys.slice(i, i + 100));
      if (error) return error.message;
    }
  }
  return null;
}
