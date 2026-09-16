import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit } from '@/lib/wedding/rate-limit';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, WEDDING_BUCKET } from '@/lib/wedding/config';

export const dynamic = 'force-dynamic';

// Гість кладе одне фото. Клієнт шле файли по одному, а не пачкою, і це
// свідомо: на весільній мережі запит обривається регулярно, і коли в ньому
// двадцять фото, разом з ним втрачаються всі двадцять. По одному — обірвалося
// одне, решта доїхала, а це одне видно в списку як помилку з кнопкою повтору.

/** Скільки фото з однієї адреси за десять хвилин. */
//
// Гість із пачкою на двадцять знімків мусить пройти вільно, і не один раз за
// вечір. Але ціла зала часто сидить за одним NAT, тобто під однією адресою, і
// межа мусить пропустити кількох таких гостей поспіль. Двісті — приблизно
// десять повних пачок.
const UPLOAD_LIMIT = 200;
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

const SLUG_RE = /^[a-z0-9-]{3,80}$/;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  const limited = rateLimit(`wedding-upload:${clientIp(req)}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Забагато завантажень поспіль. Зачекайте кілька хвилин і спробуйте ще раз.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
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
    console.error('[wedding/upload] не вдалося прочитати подію:', eventError);
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Не вдалося прочитати файл. Спробуйте ще раз.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не надійшов. Спробуйте ще раз.' }, { status: 400 });
  }

  // Тип перевіряємо на сервері, бо заголовок від клієнта — це його слово, а не
  // факт. Бакет має такий самий список дозволених типів, тобто перевірка стоїть
  // двічі, і обійти треба обидві.
  //
  // image/jpg — це той самий JPEG, лише названий так, як його подають деякі
  // телефони. Звести його до канонічної назви треба обов'язково: інакше
  // цілком справне фото отримало б відмову «такий формат ми не приймаємо», і
  // те саме зробив би бакет. Так само чинить safeImageContentType у
  // lib/storage-upload.ts, яким користуються інші завантаження в проєкті.
  const rawType = (file.type || '').toLowerCase();
  const contentType = rawType === 'image/jpg' ? 'image/jpeg' : rawType;
  if (!(ALLOWED_MIME as readonly string[]).includes(contentType)) {
    return NextResponse.json(
      { error: 'Такий формат ми не приймаємо. Підійдуть JPG, PNG або WEBP.' },
      { status: 415 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'Файл порожній. Спробуйте вибрати його ще раз.' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: 'Фото завелике навіть після стиснення. Спробуйте інший знімок.' },
      { status: 413 }
    );
  }

  // Імʼя — підпис під фото, тому його обрізаємо, а не відхиляємо. Порожнє
  // значення лишається порожнім, бо підпис необовʼязковий.
  const rawName = form.get('guestName');
  const guestName =
    typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 60) : null;

  const width = toDimension(form.get('width'));
  const height = toDimension(form.get('height'));

  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  // Імʼя файлу з телефона не використовуємо взагалі: там бувають і кирилиця, і
  // пробіли, і однакові IMG_0001 у десяти гостей. Випадкове імʼя знімає і
  // збіги, і потребу чистити рядок від небезпечних символів.
  const objectPath = `${event.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(WEDDING_BUCKET)
    .upload(objectPath, file, { contentType, cacheControl: '31536000', upsert: false });

  if (uploadError) {
    console.error('[wedding/upload] бакет не прийняв файл:', uploadError);
    return NextResponse.json({ error: 'Не вдалося зберегти фото. Спробуйте ще раз.' }, { status: 502 });
  }

  const { data: photo, error: insertError } = await supabase
    .from('wedding_photos')
    .insert({ event_id: event.id, guest_name: guestName, storage_path: objectPath, width, height })
    .select('id, guest_name, width, height, created_at')
    .single();

  if (insertError || !photo) {
    // Файл уже в бакеті, а рядка немає — галерея читає саме рядки, тож такий
    // файл ніколи не з'явиться на сторінці й лишиться висіти мертвим вантажем.
    // Прибираємо його одразу, щоб бакет не заростав тим, чого ніхто не побачить.
    await supabase.storage.from(WEDDING_BUCKET).remove([objectPath]);
    console.error('[wedding/upload] не вдалося записати фото в базу:', insertError);
    return NextResponse.json({ error: 'Не вдалося зберегти фото. Спробуйте ще раз.' }, { status: 500 });
  }

  return NextResponse.json({ photo });
}

/** Розміри від клієнта — підказка для сітки, тож усе сумнівне стає null. */
function toDimension(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000) return null;
  return parsed;
}
