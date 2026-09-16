"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { heroUrl, type WeddingEvent } from "@/lib/wedding/config";
import { formatWeddingDate } from "@/lib/wedding/format";
import { useWeddingPhotos } from "./useWeddingPhotos";
import WeddingUploader from "./WeddingUploader";
import WeddingGallery from "./WeddingGallery";
import WeddingGuestbook from "./WeddingGuestbook";
import WeddingLightbox from "./WeddingLightbox";

interface Props {
  event: WeddingEvent;
}

export default function WeddingPageClient({ event }: Props) {
  const { photos, loading, failed, hasMore, loadingMore, loadMore, addOwn } = useWeddingPhotos(
    event.slug
  );

  // Відкрите фото запам'ятовується за ІДЕНТИФІКАТОРОМ, а не за місцем у списку.
  //
  // Місце тут не тримається: опитування додає нові файли на початок, і поки
  // гість дивиться знімок, той самий номер починає вказувати на інший. На
  // весіллі, де фото сиплються пачками, картинка мінялася б під час перегляду.
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

  // Книга побажань і галерея — це один список, поділений навпіл.
  //
  // Другого запиту на сервер вони не вимагають: побажань завжди на порядок
  // менше за знімки, тож дешевше розділити те, що вже прийшло, ніж тримати дві
  // черги опитування і два курсори.
  const wishes = useMemo(() => photos.filter((p) => p.is_wish), [photos]);
  const gallery = useMemo(() => photos.filter((p) => !p.is_wish), [photos]);

  // Перегляд відкривається і з галереї, і з книги, тож список для нього —
  // спільний. Інакше стрілки «далі» впиралися б у межу свого блоку.
  const openable = photos;

  return (
    <main className="min-h-screen bg-[#faf7f3] pb-16">
      <Hero event={event} />

      <div className="relative z-10 -mt-8 space-y-12">
        <section className="mx-auto w-full max-w-2xl px-4">
          <h2 className="mb-4 text-center font-[family-name:var(--font-wedding-display)] text-2xl text-[#6E1F2E]">
            Додати фото та відео
          </h2>
          <WeddingUploader slug={event.slug} mode="media" onUploaded={addOwn} />
        </section>

        <div className="mx-auto w-full max-w-2xl px-4">
          <div className="rounded-3xl bg-[#f3ebe1] px-4 py-6 sm:px-6">
            <WeddingUploaderWish slug={event.slug} onUploaded={addOwn} />
            <div className="mt-8">
              <WeddingGuestbook wishes={wishes} loading={loading} onOpen={setOpenPhotoId} />
            </div>
          </div>
        </div>

        <WeddingGallery
          photos={gallery}
          loading={loading}
          failed={failed}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          onOpen={setOpenPhotoId}
        />
      </div>

      <Footer />

      {openPhotoId && (
        <WeddingLightbox
          photos={openable}
          photoId={openPhotoId}
          onClose={() => setOpenPhotoId(null)}
          onNavigate={setOpenPhotoId}
        />
      )}
    </main>
  );
}

function WeddingUploaderWish({
  slug,
  onUploaded,
}: {
  slug: string;
  onUploaded: Parameters<typeof WeddingUploader>[0]["onUploaded"];
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="mb-2 text-center font-[family-name:var(--font-wedding-display)] text-2xl text-[#6E1F2E]">
        Відеопобажання
      </h2>
      <p className="mb-5 text-center text-sm leading-relaxed text-[#8A7A6B]">
        Скажіть кілька теплих слів на камеру, і вони лишаться в парі на згадку про цей день.
      </p>
      <WeddingUploader slug={slug} mode="wish" onUploaded={onUploaded} />
    </div>
  );
}

/**
 * Шапка з фото пари.
 *
 * ЧИТАБЕЛЬНІСТЬ НАПИСУ НА БУДЬ-ЯКОМУ ФОТО. Фото пари ми наперед не бачимо: воно
 * може бути і світлим кадром проти сонця, і темним вечірнім. Імена тепер
 * бордові, а кольоровий текст поверх строкатого знімка не читається — тож під
 * написом лежить світла картка. Вона й дає контраст, і не залежить від того,
 * яке саме фото пара пришле: на будь-якому тлі картка лишається світлою, а
 * бордо на ній — темним.
 *
 * Сам кадр під карткою трохи притемнений градієнтом, щоб її край не губився на
 * пересвіченому небі.
 */
function Hero({ event }: { event: WeddingEvent }) {
  return (
    <header className="relative min-h-[72vh] w-full overflow-hidden pb-16">
      <Image
        src={heroUrl(event.slug)}
        alt={`${event.couple_names} — фото пари`}
        fill
        sizes="100vw"
        // object-cover не деформує кадр: він обрізає зайве, зберігаючи пропорції.
        className="object-cover"
        priority
      />

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-black/15"
        aria-hidden
      />

      <div className="relative flex min-h-[72vh] items-end justify-center px-4 pb-6 pt-24">
        <div className="w-full max-w-lg rounded-3xl bg-[#faf7f3]/92 px-6 py-7 text-center shadow-[0_10px_40px_rgba(0,0,0,0.18)] backdrop-blur-sm sm:px-10">
          <h1 className="font-[family-name:var(--font-wedding-display)] text-4xl leading-tight text-[#6E1F2E] sm:text-6xl">
            {event.couple_names}
          </h1>
          <p className="mt-1.5 text-base text-[#8A7A6B] sm:text-lg">
            {formatWeddingDate(event.event_date)}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#4A4038] sm:text-base">
            Поділіться вашим поглядом на наше свято! Скидайте сюди свої фото та відео з нашого
            святкування. Будемо раді, якщо ви також залишите на згадку міні-відеолистівку з теплими
            словами або побажанням.
          </p>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-12 text-center text-sm text-[#a2937f]">
      <a
        href="https://touchmemories.com.ua"
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-[#8A7A6B]"
      >
        Зроблено з ♡ touch.memories
      </a>
    </footer>
  );
}
