import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit } from '@/lib/wedding/rate-limit';
import {
  ALLOWED_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  WEDDING_BUCKET,
  isVideoMime,
} from '@/lib/wedding/config';

export const dynamic = 'force-dynamic';

// Створює рядок ПІСЛЯ того, як файл уже ліг у бакет.
//
// ЧОМУ ПЕРЕВІРЯЄМО ЩЕ РАЗ, ЯКЩО ВЖЕ ПЕРЕВІРИЛИ ПЕРЕД ВИДАЧЕЮ ПОСИЛАННЯ. Тому що
// там ми вірили клієнту на слово: він казав тип і розмір, а ми на це слово
// підписували посилання. Тут ми питаємо саме сховище, що насправді лежить за
// цим шляхом, і звіряємо з тим, що дозволено. Без цього кроку хтось міг би
// попросити посилання на маленьку картинку, а покласти за ним що завгодно.
//
// Шлях клієнт не вигадує: він мусить збігтися з текою події і мати наш формат,
// інакше рядок не створиться, хай би що там лежало.

const LIMIT = 200;
const WINDOW_MS = 10 * 60 * 1000;

const SLUG_RE = /^[a-z0-9-]{3,80}$/;
const PATH_RE =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$/i;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  const limited = rateLimit(`wedding-confirm:${clientIp(req)}`, LIMIT, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Забагато завантажень поспіль. Зачекайте кілька хвилин.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Не вдалося прочитати запит.' }, { status: 400 });
  }

  const path = typeof body.path === 'string' ? body.path : '';
  if (!PATH_RE.test(path)) {
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: event, error: eventError } = await supabase
    .from('wedding_events')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (eventError) {
    console.error('[wedding/confirm] не вдалося прочитати подію:', eventError);
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  // Шлях мусить лежати в теці саме цієї події. Інакше гість одного весілля міг
  // би підчепити свій файл до чужого.
  const [folder, fileName] = path.split('/');
  if (folder !== event.id) {
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 400 });
  }

  const info = await describeObject(supabase, folder, fileName);
  if (!info) {
    return NextResponse.json(
      { error: 'Файл не долетів. Спробуйте надіслати його ще раз.' },
      { status: 404 }
    );
  }

  const mimeType = info.mimeType === 'image/jpg' ? 'image/jpeg' : info.mimeType;

  if (!(ALLOWED_MIME as readonly string[]).includes(mimeType)) {
    await supabase.storage.from(WEDDING_BUCKET).remove([path]);
    return NextResponse.json(
      { error: 'Такий формат ми не приймаємо. Підійдуть фото JPG, PNG, WEBP і відео MP4 або MOV.' },
      { status: 415 }
    );
  }

  const isVideo = isVideoMime(mimeType);
  if (info.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
    await supabase.storage.from(WEDDING_BUCKET).remove([path]);
    return NextResponse.json({ error: 'Файл завеликий.' }, { status: 413 });
  }

  const posterPath =
    isVideo && typeof body.posterPath === 'string' && PATH_RE.test(body.posterPath)
      ? body.posterPath
      : null;

  const { data: photo, error: insertError } = await supabase
    .from('wedding_photos')
    .insert({
      event_id: event.id,
      guest_name: trimmed(body.guestName, 60),
      // Побажанням запис стає лише тоді, коли гість натиснув окрему кнопку
      // і надіслав відео. Ролик із танцполу, кинутий просто в галерею,
      // книгою побажань не вважається — у базі на це стоїть перевірка.
      is_wish: body.isWish === true && isVideo,
      storage_path: path,
      poster_path: posterPath,
      mime_type: mimeType,
      width: toPositiveInt(body.width),
      height: toPositiveInt(body.height),
      duration_seconds: toDuration(body.durationSeconds),
    })
    .select('id, guest_name, is_wish, width, height, created_at, mime_type, duration_seconds')
    .single();

  if (insertError || !photo) {
    // Файл уже в бакеті, а рядка немає — галерея читає саме рядки, тож такий
    // файл ніколи не зʼявиться на сторінці й лишиться висіти мертвим вантажем.
    const orphans = posterPath ? [path, posterPath] : [path];
    await supabase.storage.from(WEDDING_BUCKET).remove(orphans);
    console.error('[wedding/confirm] не вдалося записати в базу:', insertError);
    return NextResponse.json({ error: 'Не вдалося зберегти. Спробуйте ще раз.' }, { status: 500 });
  }

  return NextResponse.json({ photo });
}

/**
 * Питає в сховища, що насправді лежить за шляхом.
 *
 * list із search — єдиний спосіб дістати розмір і тип обʼєкта, не завантажуючи
 * його: на стомегабайтному ролику завантаження заради перевірки коштувало б
 * дорожче за саму перевірку.
 */
async function describeObject(
  supabase: ReturnType<typeof getAdminClient>,
  folder: string,
  fileName: string
): Promise<{ size: number; mimeType: string } | null> {
  const { data, error } = await supabase.storage
    .from(WEDDING_BUCKET)
    .list(folder, { search: fileName, limit: 1 });

  if (error) {
    console.error('[wedding/confirm] сховище не відповіло про файл:', error);
    return null;
  }

  const found = data?.find((entry) => entry.name === fileName);
  if (!found) return null;

  const metadata = (found.metadata ?? {}) as { size?: number; mimetype?: string };
  return {
    size: typeof metadata.size === 'number' ? metadata.size : 0,
    mimeType: (metadata.mimetype || '').toLowerCase(),
  };
}

/** Порожній рядок стає NULL: у базі на це стоїть перевірка. */
function trimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, max);
  return clean ? clean : null;
}

function toPositiveInt(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000) return null;
  return Math.round(parsed);
}

function toDuration(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 86_400) return null;
  return Math.round(parsed * 10) / 10;
}
