"use client";

import { useState } from "react";
import Image from "next/image";
import { heroUrl, type WeddingEvent } from "@/lib/wedding/config";
import { formatWeddingDate } from "@/lib/wedding/format";
import { useGuestName } from "./useGuestName";
import { useWeddingPhotos } from "./useWeddingPhotos";
import WeddingUploader from "./WeddingUploader";
import WeddingGallery from "./WeddingGallery";
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
  const { guestName, setGuestName } = useGuestName();

  return (
    <main className="min-h-screen bg-[#faf7f3] pb-16">
      <Hero event={event} />

      {/* Раніше тут стояв від'ємний відступ, щоб блок завантаження трохи
          заходив на фото. Відколи першим у ньому йде заголовок, він лягав
          просто на знімок — тому відступ звичайний. */}
      {/* ДВІ КОЛОНКИ НА ШИРОКОМУ ЕКРАНІ, ОДНА НА ТЕЛЕФОНІ.
          Гість приходить сюди з QR-коду, тобто майже завжди з телефона, де
          колонки стають одна під одною самі. Широкий екран — це вже пара чи
          хтось із гостей удома, і там два блоки поруч видно цілком, без
          прокрутки. items-start потрібен, щоб колонка з довшою чергою
          завантаження не розтягувала сусідню порожнечею. */}
      <div className="relative z-10 mt-10 px-4">
        <div className="mx-auto grid w-full max-w-5xl items-start gap-6 md:grid-cols-2">
          <section className="rounded-3xl bg-white/60 px-4 py-6 sm:px-6">
            <div
              role="heading"
              aria-level={2}
              className="mb-4 text-center font-[family-name:var(--font-wedding-display)] text-2xl font-medium text-[#6E1F2E]"
            >
              Додати фото та відео
            </div>
            <WeddingUploader
              slug={event.slug}
              mode="media"
              onUploaded={addOwn}
              guestName={guestName}
              onGuestNameChange={setGuestName}
            />
          </section>

          {/* Записані побажання тут НЕ показуються, і це рішення, а не пропуск.
              Відеолистівку гість адресує парі, а не залі: знаючи, що її одразу
              побачать усі, половина людей просто не стане її записувати. Пара
              дивиться побажання на своїй сторінці альбому. */}
          <section className="rounded-3xl bg-[#f3ebe1] px-4 py-6 sm:px-6">
            <div
              role="heading"
              aria-level={2}
              className="mb-2 text-center font-[family-name:var(--font-wedding-display)] text-2xl font-medium text-[#6E1F2E]"
            >
              Відеопобажання
            </div>
            <p className="mb-5 text-center text-sm leading-relaxed text-[#8A7A6B]">
              Скажіть кілька теплих слів на камеру. Ваше побажання побачить тільки пара, у
              галереї свята воно не зʼявиться.
            </p>
            <WeddingUploader
              slug={event.slug}
              mode="wish"
              onUploaded={addOwn}
              guestName={guestName}
              onGuestNameChange={setGuestName}
            />
          </section>
        </div>

        <div className="mt-12">
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
 * стоїть не одна накладка, а дві. Перша — рівне затемнення всього кадру, щоб
 * пересвічене небо вгорі не зливалося з білими літерами. Друга — градієнт від
 * низу, який гарантує темну основу саме під написом. Разом вони дають достатній
 * контраст в обидва боки, і жодне фото не доведеться підбирати під дизайн.
 *
 * ЧОМУ ІМЕНА БІЛІ, А НЕ БОРДОВІ, як решта акцентів на сторінці. Бордо було
 * серед кольорів, які назвала Діана, і його тут пробували: щоб кольоровий текст
 * читався поверх строкатого знімка, під ним довелося покласти світлу картку.
 * Картка Діані не сподобалася, і шапку повернули до тексту просто на фото — а
 * там надійно працює лише білий із тінню. Білий теж був у списку її кольорів,
 * тож палітра від цього не порушена.
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
        <div
          role="heading"
          aria-level={1}
          className="font-[family-name:var(--font-wedding-display)] text-4xl font-medium leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] sm:text-6xl"
        >
          {event.couple_names}
        </div>
        <p className="mt-2 text-base text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] sm:text-lg">
          {formatWeddingDate(event.event_date)}
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] sm:text-base">
          Поділіться вашим поглядом на наше свято! Скидайте сюди свої фото та відео з нашого
          святкування. Будемо раді, якщо ви також залишите на згадку міні-відеолистівку з теплими
          словами або побажанням.
        </p>
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
