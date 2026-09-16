import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit } from '@/lib/wedding/rate-limit';
import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  WEDDING_BUCKET,
  isVideoMime,
} from '@/lib/wedding/config';

export const dynamic = 'force-dynamic';

// Видає підписане посилання на завантаження ОДНОГО файлу.
//
// ЧОМУ НЕ ЧЕРЕЗ НАШ РОУТ, ЯК БУЛО. Функція на Vercel приймає тіло запиту до
// 4,5 МБ — це межа платформи, і налаштуванням її не підняти. Тридцять секунд
// відео з iPhone важать понад сто мегабайтів, тож крізь наш роут вони не
// пройшли б ніколи. Тепер файл летить прямо в сховище, а ми лишаємося
// воротарем: перевіряємо тип і розмір ДО видачі посилання, а після
// завантаження ще раз дивимося, що насправді лягло в бакет (роут confirm).
//
// ПРЯМОГО ЗАПИСУ В БАКЕТ КЛІЄНТ ТАК І НЕ ДІСТАВ. Посилання підписане нашим
// службовим ключем, діє на єдиний шлях, який придумали ми, і згорає після
// одного використання. Це не те саме, що дати анонімові політику на insert:
// там він писав би скільки завгодно файлів куди завгодно в межах бакета.
//
// Побічно це полагодило приховану ваду й для фото: коли стиснення на клієнті не
// спрацьовувало (мало памʼяті, дивний профіль, старий телефон), оригінал на
// вісім мегабайтів помирав об ту саму межу 4,5 МБ ще до нашого коду, тож у
// журналах не лишалося взагалі нічого.

/** Скільки посилань за десять хвилин з однієї адреси. */
//
// Гість із пачкою на двадцять файлів мусить пройти вільно, і не один раз за
// вечір. Ціла зала при цьому часто сидить за одним NAT, тобто під однією
// адресою, тому межа щедра.
const LIMIT = 200;
const WINDOW_MS = 10 * 60 * 1000;

const SLUG_RE = /^[a-z0-9-]{3,80}$/;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  const limited = rateLimit(`wedding-signurl:${clientIp(req)}`, LIMIT, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Забагато завантажень поспіль. Зачекайте кілька хвилин і спробуйте ще раз.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    );
  }

  let body: { contentType?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Не вдалося прочитати запит.' }, { status: 400 });
  }

  // image/jpg — той самий JPEG, лише названий так, як його подають деякі
  // телефони. Без зведення до канонічної назви цілком справне фото отримало б
  // відмову і від нас, і від бакета.
  const raw = typeof body.contentType === 'string' ? body.contentType.toLowerCase() : '';
  const contentType = raw === 'image/jpg' ? 'image/jpeg' : raw;

  const isVideo = isVideoMime(contentType);
  const allowed = isVideo
    ? (ALLOWED_VIDEO_MIME as readonly string[]).includes(contentType)
    : (ALLOWED_IMAGE_MIME as readonly string[]).includes(contentType);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Такий формат ми не приймаємо. Підійдуть фото JPG, PNG, WEBP і відео MP4 або MOV.' },
      { status: 415 }
    );
  }

  const size = typeof body.size === 'number' ? body.size : 0;
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Файл порожній. Спробуйте вибрати його ще раз.' }, { status: 400 });
  }

  const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (size > cap) {
    return NextResponse.json(
      {
        error: isVideo
          ? 'Відео задовге або завелике. Ми приймаємо ролики до 200 МБ.'
          : 'Фото завелике навіть після стиснення. Спробуйте інший знімок.',
      },
      { status: 413 }
    );
  }

  const supabase = getAdminClient();

  // Подія мусить існувати. Це і перевірка адреси, і головний захист від того,
  // щоб хтось наповнював наш бакет за вигаданим слагом.
  const { data: event, error: eventError } = await supabase
    .from('wedding_events')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (eventError) {
    console.error('[wedding/upload-url] не вдалося прочитати подію:', eventError);
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  // Імʼя файлу з телефона не використовуємо взагалі: там бувають і кирилиця, і
  // пробіли, і однакові IMG_0001 у десяти гостей. Випадкове імʼя знімає і
  // збіги, і потребу чистити рядок від небезпечних символів.
  const path = `${event.id}/${crypto.randomUUID()}.${extensionFor(contentType)}`;

  const { data: signed, error: signError } = await supabase.storage
    .from(WEDDING_BUCKET)
    .createSignedUploadUrl(path);

  if (signError || !signed) {
    console.error('[wedding/upload-url] не вдалося підписати посилання:', signError);
    return NextResponse.json({ error: 'Не вдалося почати завантаження. Спробуйте ще раз.' }, { status: 502 });
  }

  // Обкладинку для відео знімає браузер гостя і кладе її поруч тим самим
  // способом, тож для неї потрібне друге посилання.
  let posterPath: string | null = null;
  let posterUrl: string | null = null;
  if (isVideo) {
    posterPath = `${event.id}/${crypto.randomUUID()}.jpg`;
    const { data: signedPoster, error: posterError } = await supabase.storage
      .from(WEDDING_BUCKET)
      .createSignedUploadUrl(posterPath);
    if (posterError || !signedPoster) {
      // Без обкладинки відео все одно завантажиться, плитка просто буде
      // темною. Втрачати через це весь ролик не варто.
      console.error('[wedding/upload-url] не вдалося підписати обкладинку:', posterError);
      posterPath = null;
    } else {
      posterUrl = signedPoster.signedUrl;
    }
  }

  return NextResponse.json({
    path,
    uploadUrl: signed.signedUrl,
    contentType,
    posterPath,
    posterUrl,
  });
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    case 'video/webm':
      return 'webm';
    default:
      return 'jpg';
  }
}
