import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Cormorant_Garamond } from 'next/font/google';
import { getAdminClient } from '@/lib/supabase/admin';
import { ALBUM_BATCH_SIZE, albumZipUrl } from '@/lib/wedding/config';
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

const display = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-wedding-display',
  display: 'swap',
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

  return (
    <main className={`${display.variable} min-h-screen bg-[#faf7f3] px-4 py-12`}>
      <div className="mx-auto w-full max-w-xl">
        <header className="text-center">
          <h1 className="font-[family-name:var(--font-wedding-display)] text-4xl text-[#6E1F2E] sm:text-5xl">
            {event.couple_names}
          </h1>
          <p className="mt-2 text-[#7a6d61]">{formatWeddingDate(event.event_date)}</p>
        </header>

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
