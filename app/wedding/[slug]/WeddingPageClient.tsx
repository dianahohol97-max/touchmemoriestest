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

      {/* Раніше тут стояв від'ємний відступ, щоб блок завантаження трохи
          заходив на фото. Відколи першим у ньому йде заголовок, він лягав
          просто на знімок — тому відступ звичайний. */}
      <div className="relative z-10 mt-10 space-y-12">
        <section className="mx-auto w-full max-w-2xl px-4">
          {/* РОЛЬ ЗАГОЛОВКА ЗАМІСТЬ ТЕГА h1/h2 — І ЦЕ НЕ ПРИМХА.
          У app/globals.css правила для h1 і h2 стоять ПОЗА шарами CSS і
          задають свій колір (--primary, синій), свій шрифт, вагу 900 і
          нижній відступ. Утиліти Tailwind живуть у @layer utilities, а
          нешарова CSS перемагає шарову незалежно від специфічності — тож
          text-white і text-[#6E1F2E] тут програвали, і напис виходив синім
          важким шрифтом просто поверх фото.
          Тег div із роллю heading для читача з екрана рівноцінний
          заголовку, але глобальні правила його не чіпають. Виправляти
          globals.css заради однієї сторінки не можна: ті правила тримають
          вигляд усього магазину. */}
          <div
            role="heading"
            aria-level={2}
            className="mb-4 text-center font-[family-name:var(--font-wedding-display)] text-2xl font-medium text-[#6E1F2E]"
          >
            Додати фото та відео
          </div>
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
      <div
        role="heading"
        aria-level={2}
        className="mb-2 text-center font-[family-name:var(--font-wedding-display)] text-2xl font-medium text-[#6E1F2E]"
      >
        Відеопобажання
      </div>
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
