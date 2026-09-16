import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit } from '@/lib/wedding/rate-limit';
import { ALBUM_BATCH_SIZE, WEDDING_BUCKET } from '@/lib/wedding/config';
import { zipStream, type ZipEntry } from '@/lib/wedding/zip';

export const dynamic = 'force-dynamic';

// Архів із фото одного весілля, порціями.
//
// ЧОМУ ПОРЦІЯМИ, А НЕ ОДНИМ ФАЙЛОМ. Весілля на пів тисячі знімків — це близько
// 500 МБ. Функція на Vercel має і межу часу, і межу памʼяті, тож один архів на
// все або не встиг би зібратися, або впав би — причому саме на найбільшому
// весіллі, тобто там, де він найпотрібніший. Порція на сто п'ятдесят фото
// збирається спокійно, а віддавати байти потік починає одразу, тож зʼєднання не
// простоює і шлюз його не обриває.
//
// Порядок хронологічний, від найпершого знімка до останнього — так вечір
// читається як вечір. Це навмисно протилежно до галереї, де зверху найновіші.

export const maxDuration = 300;

/** Скільки архівів за десять хвилин з однієї адреси. */
//
// Кожен архів — це півтори сотні завантажень із бакета, тож ліміт тут захищає
// не так від зловмисника, як від подвійного кліку і від вкладки, яку хтось
// залишив перезавантажуватися.
const ZIP_LIMIT = 40;
const ZIP_WINDOW_MS = 10 * 60 * 1000;

const TOKEN_RE = /^[0-9a-f]{32}$/;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  const limited = rateLimit(`wedding-zip:${clientIp(req)}`, ZIP_LIMIT, ZIP_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Забагато завантажень поспіль. Зачекайте кілька хвилин.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    );
  }

  const supabase = getAdminClient();

  const { data: event, error: eventError } = await supabase
    .from('wedding_events')
    .select('id, couple_names, event_date')
    .eq('download_token', token)
    .maybeSingle();

  if (eventError) {
    console.error('[wedding/zip] не вдалося прочитати подію:', eventError);
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: 'Сторінку не знайдено.' }, { status: 404 });
  }

  const offset = toOffset(new URL(req.url).searchParams.get('offset'));

  // .range() — саме та пагінація, якої вимагає гоча 14: подія цілком може мати
  // більше за тисячу знімків, і без явного вікна PostgREST мовчки віддав би
  // рівно тисячу, а решта фото не потрапила б у жоден архів.
  const { data: photos, error } = await supabase
    .from('wedding_photos')
    .select('id, guest_name, storage_path, created_at')
    .eq('event_id', event.id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + ALBUM_BATCH_SIZE - 1);

  if (error) {
    console.error('[wedding/zip] не вдалося прочитати фото:', error);
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 500 });
  }
  if (!photos?.length) {
    return NextResponse.json({ error: 'У цій частині фото немає.' }, { status: 404 });
  }

  const rows = photos;
  const eventDate = event.event_date;

  async function* entries(): AsyncGenerator<ZipEntry> {
    for (let i = 0; i < rows.length; i++) {
      const photo = rows[i];
      const { data, error: downloadError } = await supabase.storage
        .from(WEDDING_BUCKET)
        .download(photo.storage_path);

      if (downloadError || !data) {
        // Один недоступний файл не має занапастити весь архів: пара радше
        // отримає сто сорок девʼять фото, ніж нічого. Пропуск видно за діркою
        // в нумерації, і він лишається в журналі.
        console.error('[wedding/zip] бакет не віддав файл:', photo.storage_path, downloadError);
        continue;
      }

      yield {
        name: entryName(eventDate, offset + i + 1, photo.guest_name, photo.storage_path),
        data: new Uint8Array(await data.arrayBuffer()),
        modified: new Date(photo.created_at),
      };
    }
  }

  const part = Math.floor(offset / ALBUM_BATCH_SIZE) + 1;
  const fileName = `${eventDate}-vesillia-chastyna-${part}.zip`;

  return new NextResponse(zipStream(entries()) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

/**
 * Назва файлу всередині архіву: 2026-10-10_0007_Марічка.jpg
 *
 * Дата й номер стоять спереду, щоб сортування за іменем збігалося з порядком
 * вечора. Імʼя гостя тут — єдина причина, з якої архів взагалі варто збирати
 * нашим кодом: у бакеті файли названі випадковими UUID, а хто що надіслав,
 * знає лише база.
 */
function entryName(
  eventDate: string,
  index: number,
  guestName: string | null,
  storagePath: string
): string {
  const extension = storagePath.split('.').pop()?.toLowerCase() || 'jpg';
  const number = String(index).padStart(4, '0');
  const guest = safeNamePart(guestName);
  return `${eventDate}_${number}${guest ? `_${guest}` : ''}.${extension}`;
}

/**
 * Готує імʼя гостя до ролі частини назви файлу.
 *
 * Гість пише що завгодно, а Windows не дозволяє \ / : * ? " < > | у назвах і
 * відмовляється розпаковувати такий запис. Крапки й пробіли в кінці Windows теж
 * обрізає сам, тому прибираємо їх ми, поки бачимо, що робимо.
 */
function safeNamePart(raw: string | null): string {
  if (!raw) return '';
  return raw
    .replace(/[\\/:*?"<>|]/g, '')
    .split('')
    .filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 40);
}

/** Зсув мусить бути невідʼємним цілим; усе інше починає з початку. */
function toOffset(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '0', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}
