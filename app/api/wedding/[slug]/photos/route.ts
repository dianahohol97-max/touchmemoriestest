import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit } from '@/lib/wedding/rate-limit';
import { GALLERY_PAGE_SIZE } from '@/lib/wedding/config';

export const dynamic = 'force-dynamic';

// Список фото однієї події, найновіші зверху.
//
// ПРО ПАГІНАЦІЮ (гоча 14). Фільтр по event_id тут є, але сам собою він нічого
// не гарантує: сто гостей по двадцять фото — це дві тисячі рядків на одному
// весіллі, тобто вдвічі більше за тисячу, яку PostgREST віддає мовчки. Тому
// ліміт стоїть завжди, а догортування йде курсором.
//
// ПРО ВІДСІВ (гоча 13). Жодної умови після .limit() тут немає і бути не може:
// усе, що звужує вибірку, стоїть усередині запиту. Фото пари з шапки не
// потребує окремої умови взагалі — воно живе в hero_photo_path події, а не
// рядком у wedding_photos, тож у галерею не потрапляє за побудовою.

/** Опитування раз на 15 секунд — це чотири запити за хвилину з вкладки. */
//
// Межа з великим запасом: під одним NAT сидить уся зала, і кожна відкрита
// вкладка додає свої чотири. Вона ловить цикл у коді, а не живих гостей.
const READ_LIMIT = 600;
const READ_WINDOW_MS = 60 * 1000;

const SLUG_RE = /^[a-z0-9-]{3,80}$/;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  const limited = rateLimit(`wedding-read:${clientIp(req)}`, READ_LIMIT, READ_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Забагато запитів. Зачекайте трохи.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    );
  }

  const url = new URL(req.url);
  // before — догортування вниз, after — перевірка, чи з'явилося щось нове.
  // Обидва курсори за created_at, тим самим порядком, що й індекс.
  const before = isoOrNull(url.searchParams.get('before'));
  const after = isoOrNull(url.searchParams.get('after'));

  const supabase = getAdminClient();

  const { data: event, error: eventError } = await supabase
    .from('wedding_events')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (eventError) {
    console.error('[wedding/photos] не вдалося прочитати подію:', eventError);
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  // НАПРЯМОК СОРТУВАННЯ ЗАЛЕЖИТЬ ВІД КУРСОРА, і це не дрібниця.
  //
  // Догортування (before) йде вниз від курсора, тож там спадання — віддаємо
  // наступні за давністю.
  //
  // А от опитування про нові (after) мусить іти ЗРОСТАННЯМ. Якби воно теж
  // спадало, то при сплеску більшому за сторінку — а на танці таке буває —
  // запит віддав би найновіші 48 і пропустив би все, що між ними й курсором.
  // Клієнт зсунув би курсор до найновішого, і пропущені фото не повернулися б
  // уже ніколи: наступне опитування починало б відлік за ними. Зростання
  // натомість віддає найстарші з нових, тобто суцільний відрізок від самого
  // курсора, і залишок доїде наступним опитуванням.
  //
  // storage_path назовні не віддається: гість бачить фото через
  // /api/wedding/photo/[id], і знати розташування файлу в бакеті йому не треба.
  const ascending = Boolean(after);

  let query = supabase
    .from('wedding_photos')
    .select('id, guest_name, width, height, created_at')
    .eq('event_id', event.id)
    .order('created_at', { ascending })
    // Друге поле сортування розводить фото, що лягли б у базу однією міткою
    // часу: без нього порядок між такими рядками лишається на розсуд бази і
    // може відрізнятися від запиту до запиту, тобто сітка перемішувалася б на
    // очах. Сам курсор іде тільки за created_at, і точності timestamptz —
    // мікросекунди — вистачає, щоб два окремі вставлення не збіглися.
    .order('id', { ascending })
    .limit(GALLERY_PAGE_SIZE);

  if (before) query = query.lt('created_at', before);
  if (after) query = query.gt('created_at', after);

  const { data, error } = await query;

  if (error) {
    console.error('[wedding/photos] не вдалося прочитати фото:', error);
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 500 });
  }

  // Сторінка показує найновіші зверху завжди, тож віддаємо вже в цьому порядку
  // незалежно від того, яким його зібрав запит.
  const photos = (data ?? []).slice();
  if (ascending) photos.reverse();

  return NextResponse.json({
    photos,
    // Рівно повна сторінка означає, що далі майже напевно є ще. Помилка тут
    // коштує одного зайвого запиту, тоді як протилежна сховала б від пари
    // частину фото назавжди.
    hasMore: photos.length === GALLERY_PAGE_SIZE,
  });
}

/** Курсор мусить бути датою. Усе інше ігнорується, а не ламає запит. */
function isoOrNull(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
