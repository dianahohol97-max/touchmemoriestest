'use client';

import { useState } from 'react';
import Image from 'next/image';
import { heroUrl, type WeddingEvent } from '@/lib/wedding/config';
import { formatWeddingDate } from '@/lib/wedding/format';
import { useWeddingPhotos } from './useWeddingPhotos';
import WeddingUploader from './WeddingUploader';
import WeddingGallery from './WeddingGallery';
import WeddingLightbox from './WeddingLightbox';

interface Props {
  event: WeddingEvent;
}

export default function WeddingPageClient({ event }: Props) {
  const { photos, loading, failed, hasMore, loadingMore, loadMore, addOwn } = useWeddingPhotos(
    event.slug
  );
  // Відкрите фото запам'ятовується за ІДЕНТИФІКАТОРОМ, а не за місцем у списку.
  //
  // Місце тут не тримається: опитування додає нові фото на початок сітки, і
  // поки гість дивиться знімок, той самий номер починає вказувати на інший.
  // На весіллі, де фото сиплються пачками, картинка мінялася б просто під
  // час перегляду.
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-[#faf7f3] pb-16">
      <Hero event={event} />

      <div className="relative z-10 -mt-8 space-y-10">
        <WeddingUploader slug={event.slug} onUploaded={addOwn} />
        <WeddingGallery
          photos={photos}
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
          photos={photos}
          photoId={openPhotoId}
          onClose={() => setOpenPhotoId(null)}
          onNavigate={setOpenPhotoId}
        />
      )}
    </main>
  );
}

/**
 * Шапка з фото пари.
 *
 * ЧИТАБЕЛЬНІСТЬ НАПИСУ НА БУДЬ-ЯКОМУ ФОТО. Фото пари ми наперед не бачимо: воно
 * може бути і світлим кадром проти сонця, і темним вечірнім. Тому під текстом
 * стоїть не одна накладка, а дві. Перша — градієнт від низу, який гарантує
 * темну основу саме під написом. Друга — легке затемнення всього кадру, щоб
 * пересвічене небо вгорі не зливалося з білими літерами. Разом вони дають
 * достатній контраст в обидва боки, і жодне фото не доведеться підбирати під
 * дизайн.
 */
function Hero({ event }: { event: WeddingEvent }) {
  return (
    <header className="relative h-[68vh] min-h-[420px] w-full overflow-hidden">
      <Image
        src={heroUrl(event.slug)}
        alt={`${event.couple_names} — фото пари`}
        fill
        sizes="100vw"
        // object-cover не деформує кадр: він обрізає зайве, зберігаючи пропорції.
        className="object-cover"
        priority
      />

      {/* Рівне затемнення всього кадру — страховка для світлих фото. */}
      <div className="absolute inset-0 bg-black/25" aria-hidden />
      {/* Градієнт від низу — основа під самим написом. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10"
        aria-hidden
      />

      <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-center">
        <h1
          className="font-[family-name:var(--font-wedding-display)] text-4xl leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] sm:text-6xl"
        >
          {event.couple_names}
        </h1>
        <p className="mt-2 text-base text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] sm:text-lg">
          {formatWeddingDate(event.event_date)}
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] sm:text-base">
          Поділіться фото та відео з нашого святкування тут
        </p>
      </div>
    </header>
  );
}

function Footer() {
  return (
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
  );
}
