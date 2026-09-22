import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import localFont from 'next/font/local';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  ALBUM_BATCH_SIZE,
  VIDEO_URL_TTL_SECONDS,
  WEDDING_BUCKET,
  WISHES_PAGE_SIZE,
  albumZipUrl,
  photoUrl,
} from '@/lib/wedding/config';
import { formatWeddingDate } from '@/lib/wedding/format';

export const dynamic = 'force-dynamic';

// Сторінка, якою пара забирає свої фото.
//
// ЧОМУ ОКРЕМА АДРЕСА, А НЕ КНОПКА НА СТОРІНЦІ ГОСТЯ. Слаг гостя надрукований на
// QR-коді посеред столу, тобто його знає кожен запрошений. Кнопка «завантажити
// все» там означала б, що будь-хто з гостей забирає весілля цілком, включно з
// чужими знімками. Ця адреса не стоїть на жодному столі: Діана передає її парі
// особисто.
//
// Маршрут навмисно /wedding/album/…, а не окремий корінь: виняток для /wedding/
// у proxy.ts уже є, і нової дірки в локальному редиректі це не потребує. Слаг
// «album» заборонений перевіркою в базі, щоб подія колись не заступила цю
// сторінку — статичний сегмент у Next.js завжди виграє в динамічного.

// Шрифт той самий, що й на гостьовій сторінці, і з тієї ж причини береться з
// файлу в app/fonts/, а не з next/font/google: той ходить по мережу під час
// збірки. Подробиці — app/fonts/README.md.
const display = localFont({
  src: '../../../fonts/CormorantGaramond-Variable.woff2',
  weight: '300 700',
  style: 'normal',
  variable: '--font-wedding-display',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

interface Props {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: 'Ваші фото з весілля',
  // Сторінка приватна так само, як і гостьова, і з тієї ж причини: захист тут
  // лише в тому, що адресу не вгадати.
  robots: { index: false, follow: false, nocache: true },
};

export default async function WeddingAlbumPage({ params }: Props) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();

  const admin = getAdminClient();

  const { data: event, error } = await admin
    .from('wedding_events')
    .select('id, couple_names, event_date')
    .eq('download_token', token)
    .maybeSingle();

  if (error) {
    console.error('[wedding/album] не вдалося прочитати подію:', error);
  }
  if (!event) notFound();

  // head: true рахує рядки на боці бази і не тягне жодного з них — межа
  // PostgREST на тисячу рядків такому запиту не страшна (гоча 14).
  const { count } = await admin
    .from('wedding_photos')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id);

  const total = count ?? 0;
  const parts = Math.ceil(total / ALBUM_BATCH_SIZE);

  // ВІДЕОПОБАЖАННЯ ЖИВУТЬ ТІЛЬКИ ТУТ.
  //
  // Сторінка гостя їх не показує і роут /api/wedding/[slug]/photos не віддає
  // взагалі: листівку людина адресує парі, а не залі. Тому єдине місце, де їх
  // видно, — ця адреса, яку пара отримує особисто.
  //
  // Ліміт стоїть свідомо (гоча 14): вибірка з wedding_photos без нього
  // лишилася б необмеженою, а мовчазну тисячу рядків PostgREST віддає без
  // жодної помилки.
  const { data: wishRows, error: wishError } = await admin
    .from('wedding_photos')
    .select('id, guest_name, storage_path, created_at')
    .eq('event_id', event.id)
    .eq('is_wish', true)
    .order('created_at', { ascending: true })
    .limit(WISHES_PAGE_SIZE);

  if (wishError) {
    console.error('[wedding/album] не вдалося прочитати побажання:', wishError);
  }

  // Ролики програються ПРЯМО ЗІ СХОВИЩА за підписаним посиланням, а не через
  // наш роут: програвачеві потрібні часткові запити, щоб перемотувати й не
  // тягнути сто мегабайтів заради перших секунд.
  const wishes: { id: string; guestName: string | null; videoUrl: string | null }[] = [];
  if (wishRows?.length) {
    const { data: signed, error: signError } = await admin.storage
      .from(WEDDING_BUCKET)
      .createSignedUrls(wishRows.map((row) => row.storage_path), VIDEO_URL_TTL_SECONDS);
    if (signError) {
      console.error('[wedding/album] не вдалося підписати посилання:', signError);
    }
    wishRows.forEach((row, i) => {
      wishes.push({
        id: row.id,
        guestName: row.guest_name,
        videoUrl: signed?.[i]?.signedUrl ?? null,
      });
    });
  }

  return (
    <main className={`${display.variable} min-h-screen bg-[#faf7f3] px-4 py-12`}>
      <div className="mx-auto w-full max-w-xl">
        <header className="text-center">
          {/* div із роллю заголовка, а не h1: нешарові правила globals.css
              перефарбували б імена в синій і поставили б свій шрифт. */}
          <div
            role="heading"
            aria-level={1}
            className="font-[family-name:var(--font-wedding-display)] text-4xl font-medium text-[#6E1F2E] sm:text-5xl"
          >
            {event.couple_names}
          </div>
          <p className="mt-2 text-[#7a6d61]">{formatWeddingDate(event.event_date)}</p>
        </header>

        {wishes.length > 0 && (
          <section className="mt-10">
            <div
              role="heading"
              aria-level={2}
              className="mb-2 text-center font-[family-name:var(--font-wedding-display)] text-2xl font-medium text-[#6E1F2E]"
            >
              Відеопобажання від гостей
            </div>
            <p className="mb-5 text-center text-sm leading-relaxed text-[#8A7A6B]">
              Ці листівки бачите тільки ви. На сторінці, куди заходили гості, їх немає.
            </p>

            <ul className="grid gap-4 sm:grid-cols-2">
              {wishes.map((wish) => (
                <li key={wish.id} className="overflow-hidden rounded-2xl bg-white/70 shadow-sm">
                  {wish.videoUrl ? (
                    <video
                      // Обкладинку віддає наш роут: для відео він показує кадр,
                      // знятий браузером гостя під час завантаження.
                      poster={photoUrl(wish.id)}
                      src={wish.videoUrl}
                      controls
                      // preload="metadata" навмисно: інакше десяток листівок
                      // почав би тягнутися одночасно ще до того, як пара
                      // натисне бодай одну.
                      preload="metadata"
                      playsInline
                      className="aspect-[3/4] w-full bg-[#efe7dd] object-cover"
                    />
                  ) : (
                    <p className="flex aspect-[3/4] items-center justify-center bg-[#efe7dd] px-4 text-center text-sm text-[#8A7A6B]">
                      Це відео зараз не відкривається. Оновіть сторінку за хвилину.
                    </p>
                  )}
                  <p className="px-4 py-3 text-center text-sm text-[#4A4038]">
                    {wish.guestName || 'Від гостя'}
                  </p>
                </li>
              ))}
            </ul>

            {wishes.length === WISHES_PAGE_SIZE && (
              <p className="mt-4 text-center text-sm text-[#8A7A6B]">
                Тут показані перші {WISHES_PAGE_SIZE} побажань. Решта чекає в архіві нижче.
              </p>
            )}
          </section>
        )}

        {total === 0 ? (
          <p className="mt-10 rounded-2xl bg-white/70 px-6 py-8 text-center text-[#7a6d61]">
            Гості ще не надіслали жодного фото. Заходьте сюди після весілля, і все, що вони
            завантажать, буде чекати на цій сторінці.
          </p>
        ) : (
          <>
            <p className="mt-8 text-center text-[#4A4038]">
              Ваші гості надіслали фотографій: {total}. Завантажте їх на компʼютер, поки вони
              вам потрібні.
            </p>

            <div className="mt-6 space-y-3">
              {Array.from({ length: parts }, (_, i) => {
                const from = i * ALBUM_BATCH_SIZE + 1;
                const to = Math.min(total, (i + 1) * ALBUM_BATCH_SIZE);
                return (
                  <a
                    key={i}
                    href={albumZipUrl(token, i * ALBUM_BATCH_SIZE)}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-[#6E1F2E] px-6 py-4 text-white transition hover:bg-[#571825]"
                  >
                    <span className="font-medium">
                      {parts === 1 ? 'Завантажити всі фото' : `Частина ${i + 1}`}
                    </span>
                    <span className="text-sm text-white/70">
                      {from}–{to}
                    </span>
                  </a>
                );
              })}
            </div>

            <div className="mt-8 space-y-3 rounded-2xl bg-white/70 px-6 py-5 text-sm leading-relaxed text-[#7a6d61]">
              {parts > 1 && (
                <p>
                  Фото поділені на {parts} архіви, бо одним файлом такий обсяг завантажується
                  ненадійно. Натисніть кожну кнопку по черзі, і після розпакування всі знімки
                  складуться в один список за порядком вечора.
                </p>
              )}
              <p>
                Усередині архіву файли названі датою, номером за часом зйомки і підписом гостя,
                якщо він його залишив. Тому сортування за назвою показує вечір так, як він
                відбувався.
              </p>
              <p>
                Зберігайте посилання при собі і не викладайте його в спільні чати: ним
                завантажити фото може будь-хто, хто його відкриє.
              </p>
            </div>
          </>
        )}

        <footer className="mt-10 text-center text-sm text-[#a2937f]">
          <a
            href="https://touchmemories.com.ua"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-[#7a6d61]"
          >
            Зроблено з ♡ touch.memories
          </a>
        </footer>
      </div>
    </main>
  );
}
