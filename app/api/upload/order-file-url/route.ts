import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Підписане посилання на завантаження ОДНОГО файлу клієнта — і перевірка того,
 * що по ньому справді доїхало.
 *
 * ЧОМУ ЦЕ ЗʼЯВИЛОСЯ. Фото клієнта йшли через /api/upload/order-file, тобто
 * тілом запиту до функції на Vercel. Функція приймає близько 4,5 МБ, і це межа
 * платформи, яку не піднімає жодне налаштування: запит ріжеться ще до того, як
 * наш код запуститься, тож ані журналу, ані змістовної помилки не лишається —
 * тільки голе 413. Живі числа з upload_attempt_log показують межу до байта:
 * найбільший файл, який колись доїхав, важив 4 487 593 байти, а найменший, який
 * упав, — 4 497 036. Між ними девʼять кілобайтів.
 *
 * Даунскейл на клієнті від цього не рятував, бо дивиться лише на сторону в
 * пікселях: знімок 4032×3024 з айфона проходить перевірку і летить як є, усі
 * свої пʼять мегабайтів. З восьмого серпня по сімнадцяте вересня так тихо
 * загубилися фото в шістнадцяти замовленнях, найгірше в TM-001305 (девʼять
 * знімків із двадцяти шести) і TM-001306 (десять із двадцяти семи).
 *
 * ЧОМУ САМЕ ТАК, А НЕ СТИСНЕННЯМ. Стиснути до прохідної ваги означало б
 * свідомо погіршити якість найбільших файлів, а саме вони йдуть у друк. Тут
 * файл летить прямо в сховище повз наші функції, тож стеля зникає зовсім.
 * Той самий хід Антигравіті зробив для весільної сторінки — див.
 * app/api/wedding/[slug]/upload-url.
 *
 * ПРЯМОГО ЗАПИСУ В БАКЕТ КЛІЄНТ НЕ ОТРИМУЄ. Посилання підписане службовим
 * ключем, діє на єдиний шлях, який назвали ми, і згорає після одного
 * використання. Це не те саме, що відкрити анонімові політику на insert.
 *
 * PATCH — друга половина роута і причина, чому він не просто «видай посилання».
 * Коли файл ішов крізь нашу функцію, вона звіряла заявлений розмір із тим, що
 * дочитала, і відмовляла на розбіжності: саме це перетворило тиху втрату
 * TM-001245 на звичайну помилку з повтором. Пряме завантаження цю перевірку
 * забрало б, тому після нього ми питаємо сховище, що там НАСПРАВДІ лежить.
 * «Успіх» і далі означає, що байти на місці.
 */

const ALLOWED_BUCKETS = new Set(['order-files', 'photobook-uploads', 'poster-exports']);
const ALLOWED_CT = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/avif', 'application/pdf',
  'application/json', 'text/plain',
]);
const MAX_BYTES = 50 * 1024 * 1024;

// Та сама межа, що й у сусідньому роуті: перезаписати можна лише свіжий обʼєкт.
const OVERWRITE_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Той самий захист від чужих сторінок, що й у /api/upload/order-file. */
function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // старі вебвʼю не шлють заголовок
  let host = '';
  try { host = new URL(origin).hostname; } catch { return false; }
  return host === request.nextUrl.hostname
    || host === 'touchmemories.com.ua' || host === 'www.touchmemories.com.ua'
    || host.endsWith('.vercel.app') || host === 'localhost';
}

type Body = { path?: unknown; bucket?: unknown; contentType?: unknown; size?: unknown };

function readBody(body: Body) {
  const path = String(body.path || '');
  const bucket = String(body.bucket || 'order-files');
  let contentType = String(body.contentType || '').toLowerCase();
  if (contentType === 'image/jpg') contentType = 'image/jpeg';
  if (!ALLOWED_CT.has(contentType)) contentType = 'application/octet-stream';
  const size = Number(body.size);
  return { path, bucket, contentType, size };
}

function validate(path: string, bucket: string, size: number): string | null {
  if (!path || path.length > 512 || path.includes('..') || path.startsWith('/')) return 'invalid path';
  if (!ALLOWED_BUCKETS.has(bucket)) return 'bucket not allowed';
  if (!Number.isFinite(size) || size <= 0) return 'empty file';
  if (size > MAX_BYTES) return 'file too large';
  return null;
}

/** Видати підписане посилання. */
export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: 'origin not allowed' }, { status: 403 });
  }

  let body: Body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'expected json' }, { status: 400 });
  }

  const { path, bucket, contentType, size } = readBody(body);
  const bad = validate(path, bucket, size);
  if (bad) return NextResponse.json({ error: bad }, { status: bad === 'file too large' ? 413 : 400 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'storage unavailable' }, { status: 503 });

  try {
    const aged = await agedObjectBlocks(admin, bucket, path);
    if (aged) return NextResponse.json({ error: aged }, { status: 409 });

    const { data: signed, error } = await admin.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !signed?.token) {
      console.error('[upload/order-file-url] sign failed:', error?.message, { bucket, path });
      return NextResponse.json({ error: error?.message || 'could not sign upload' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, path, bucket, token: signed.token, contentType });
  } catch (e: any) {
    console.error('[upload/order-file-url] exception:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'sign failed' }, { status: 500 });
  }
}

/** Звірити, що по посиланню лягло рівно стільки байтів, скільки обіцяли. */
export async function PATCH(request: NextRequest) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: 'origin not allowed' }, { status: 403 });
  }

  let body: Body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'expected json' }, { status: 400 });
  }

  const { path, bucket, size } = readBody(body);
  const bad = validate(path, bucket, size);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'storage unavailable' }, { status: 503 });

  try {
    const stored = await storedSize(admin, bucket, path);
    if (stored === null) {
      return NextResponse.json({ error: 'file did not arrive' }, { status: 404 });
    }
    if (stored !== size) {
      console.warn('[upload/order-file-url] size mismatch', { bucket, path, expected: size, got: stored });
      return NextResponse.json(
        { error: `truncated upload: expected ${size} bytes, got ${stored}` },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, path, bucket, size: stored });
  } catch (e: any) {
    console.error('[upload/order-file-url] verify exception:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'verify failed' }, { status: 500 });
  }
}

/** Розмір обʼєкта в сховищі, або null, якщо його там немає. */
async function storedSize(admin: any, bucket: string, path: string): Promise<number | null> {
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data } = await admin.storage.from(bucket).list(dir, { search: name, limit: 10 });
  const match = (data || []).find((f: any) => f.name === name);
  if (!match) return null;
  const size = Number(match?.metadata?.size);
  return Number.isFinite(size) ? size : null;
}

/** Чи це спроба перезаписати старий обʼєкт. Повертає текст відмови або null. */
async function agedObjectBlocks(admin: any, bucket: string, path: string): Promise<string | null> {
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data } = await admin.storage.from(bucket).list(dir, { search: name, limit: 10 });
  const match = (data || []).find((f: any) => f.name === name);
  if (!match) return null;
  const createdAt = new Date(match.created_at || match.updated_at || 0).getTime();
  if (!createdAt || Date.now() - createdAt > OVERWRITE_WINDOW_MS) {
    console.warn('[upload/order-file-url] blocked overwrite of aged object', { bucket, path });
    return 'file already exists and can no longer be replaced';
  }
  return null;
}
