import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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

/**
 * Cloudflare shows the S3 endpoint as a full URL, so R2_ACCOUNT_ID is easy to
 * fill in as `https://<id>.r2.cloudflarestorage.com` or as the bare host. Both
 * used to produce the endpoint `https://<host>.r2.cloudflarestorage.com` —
 * a two-label subdomain that the wildcard certificate does not cover, so
 * Cloudflare aborted the TLS handshake and every upload died with
 * «ssl/tls alert handshake failure ... alert number 40». Reducing whatever is
 * configured back to the bare account id makes all three spellings work.
 */
function accountId(raw: string): string {
  return raw.trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .replace(/\.(eu|fedramp)?\.?r2\.cloudflarestorage\.com$/i, '')
    .toLowerCase();
}

const R2 = {
  accountId: accountId(process.env.R2_ACCOUNT_ID || ''),
  accessKeyId: (process.env.R2_ACCESS_KEY_ID || '').trim(),
  secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
  bucket: (process.env.R2_BUCKET || '').trim(),
  publicBase: (process.env.R2_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, ''),
  // Buckets created with a jurisdiction (EU data residency) answer on
  // <account>.eu.r2.cloudflarestorage.com instead of the default host.
  jurisdiction: (process.env.R2_JURISDICTION || '').trim().toLowerCase(),
};

/** The S3 endpoint we talk to. Exported for the diagnostics route. */
export function r2Endpoint(): string {
  const host = R2.jurisdiction
    ? `${R2.accountId}.${R2.jurisdiction}.r2.cloudflarestorage.com`
    : `${R2.accountId}.r2.cloudflarestorage.com`;
  return `https://${host}`;
}

/**
 * The public base has to be an absolute http(s) URL, because fileUrl() uses it
 * as a prefix: a bare host like `pub-xxxx.r2.dev` would produce the relative
 * path `pub-xxxx.r2.dev/galleries/…` and every photo in the client gallery
 * would 404 — after uploading fine, which makes it look like a display bug
 * rather than a config one.
 */
function publicBaseLooksReal(): boolean {
  try {
    const u = new URL(R2.publicBase);
    return (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.host);
  } catch {
    return false;
  }
}

export function isR2Configured(): boolean {
  // The account id is a 32-character hex string. Anything else (a pasted URL
  // fragment, a bucket name, a stray quote) would build a hostname Cloudflare
  // refuses, so we stay on Supabase rather than break every upload.
  const idLooksReal = /^[0-9a-f]{32}$/.test(R2.accountId);
  return Boolean(idLooksReal && R2.accessKeyId && R2.secretAccessKey && R2.bucket && publicBaseLooksReal());
}

/** Why R2 is not active, in Diana's words. Empty string when it is active. */
export function r2ConfigProblem(): string {
  if (!process.env.R2_ACCOUNT_ID) return 'R2_ACCOUNT_ID не задано';
  if (!/^[0-9a-f]{32}$/.test(R2.accountId)) return 'R2_ACCOUNT_ID не схожий на ідентифікатор акаунта (потрібні 32 символи 0-9a-f)';
  if (!R2.accessKeyId) return 'R2_ACCESS_KEY_ID не задано';
  if (!R2.secretAccessKey) return 'R2_SECRET_ACCESS_KEY не задано';
  if (!R2.bucket) return 'R2_BUCKET не задано';
  if (!R2.publicBase) return 'R2_PUBLIC_BASE_URL не задано';
  if (!publicBaseLooksReal()) return 'R2_PUBLIC_BASE_URL має бути повною адресою з https:// на початку, наприклад https://pub-xxxxxxxx.r2.dev';
  return '';
}

/**
 * What R2_ACCOUNT_ID boiled down to, in a form that is safe to show and
 * actually diagnostic. The account id is not a secret — it is the public S3
 * hostname — but when it is wrong the useful signal is its SHAPE: a pasted
 * dashboard URL collapses to `dash.cloudflare.com`, an access key id is 32
 * characters yet not hex, and a bucket name is far too short. Without this the
 * only feedback is «не схожий на ідентифікатор», with no way to tell which of
 * the wrong things was pasted.
 */
export function r2AccountIdShape(): { length: number; starts_with: string } | null {
  if (!R2.accountId) return null;
  return { length: R2.accountId.length, starts_with: R2.accountId.slice(0, 10) };
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
      endpoint: r2Endpoint(),
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
      // A misconfigured or unreachable R2 must not stop a photographer's
      // shoot from being uploaded: Supabase still works and every row records
      // its own provider, so a mixed gallery reads back correctly. The failure
      // is logged for us and reported by /api/photographers/storage-check.
      console.error('[r2] upload failed, falling back to Supabase:', e?.message || e);
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

/**
 * Short-lived URL that makes the browser SAVE the file under its real name.
 *
 * Supabase takes a `?download=` query parameter on its public URL, but R2's
 * public address ignores query strings entirely — a public R2 object can only
 * be served inline, so a single-photo download opened the image in a new tab
 * instead of saving it (Diana, 2026-08-06). A presigned GET can carry
 * response-content-disposition, which restores the behaviour AND keeps the
 * bytes flowing browser↔Cloudflare, costing us no egress.
 *
 * Returns null when there is no such URL to mint (Supabase, or R2 unavailable)
 * and the caller should fall back.
 */
export async function presignDownload(path: string, provider: string | null | undefined, fileName: string):
  Promise<string | null> {
  if (provider !== 'r2' || !isR2Configured()) return null;
  try {
    return await getSignedUrl(
      r2(),
      new GetObjectCommand({
        Bucket: R2.bucket,
        Key: path,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      }),
      { expiresIn: 60 * 10 },
    );
  } catch (e: any) {
    console.error('[r2] presign download failed:', e?.message || e);
    return null;
  }
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
