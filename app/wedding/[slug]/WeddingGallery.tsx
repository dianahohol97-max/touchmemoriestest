'use client';

import Image from 'next/image';
import { Loader2, Play } from 'lucide-react';
import { isVideoMime, photoUrl, type WeddingPhoto } from '@/lib/wedding/config';

// Жива сітка всіх фото події, найновіші зверху.
//
// ЧОМУ КВАДРАТИ, А НЕ MASONRY. Masonry на телефоні означає або колонки CSS, де
// порядок читається згори вниз по колонці, а не зліва направо, — тобто
// «найновіші зверху» перестає бути правдою на око, — або розкладку за відомими
// висотами, де кожне фото без збережених розмірів ламає ряд. Квадрат натомість
// дає передбачуваний порядок, нульове смикання під час дозавантаження і
// однакову сітку незалежно від того, знімав гість вертикально чи горизонтально.
// Обрізання тут не втрата: за дотиком відкривається ціле фото.

interface Props {
  photos: WeddingPhoto[];
  loading: boolean;
  failed: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (photoId: string) => void;
}

export default function WeddingGallery({
  photos,
  loading,
  failed,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpen,
}: Props) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-4">
      <h2 className="mb-4 text-center font-[family-name:var(--font-wedding-display)] text-2xl text-[#6E1F2E]">
        Фото цього дня
      </h2>

      {loading ? (
        <p className="py-10 text-center text-sm text-[#9a8b7c]">Завантажуємо галерею…</p>
      ) : failed && !photos.length ? (
        <p className="py-10 text-center text-sm text-[#9a8b7c]">
          Галерея зараз не відкрилася, але ваші фото все одно можна завантажити.
        </p>
      ) : !photos.length ? (
        <p className="py-10 text-center text-sm text-[#9a8b7c]">
          Тут поки порожньо, і ваше фото може стати першим.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {photos.map((photo, index) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => onOpen(photo.id)}
                  className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-[#ece4da]"
                >
                  <Image
                    src={photoUrl(photo.id)}
                    alt={photo.guest_name ? `Фото від гостя на імʼя ${photo.guest_name}` : 'Фото з весілля'}
                    fill
                    // Сітка має від двох до чотирьох колонок, тож найбільша
                    // плитка — приблизно чверть широкого екрана. Без цього
                    // Next брав би ширину вікна і тягнув би вчетверо більше.
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    // Перший ряд видно одразу, решта чекає прокрутки.
                    loading={index < 4 ? 'eager' : 'lazy'}
                    // Відео без обкладинки віддає 404. Ховаємо биту картинку,
                    // щоб лишилася спокійна плашка з позначкою відтворення.
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                  {isVideoMime(photo.mime_type) && (
                    <>
                      {/* Плитка відео мусить читатися як відео з першого
                          погляду, інакше гість тицяє в неї, очікуючи фото. */}
                      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#6E1F2E] shadow-sm">
                        <Play className="h-4 w-4 translate-x-[1px]" aria-hidden />
                      </span>
                      {photo.duration_seconds ? (
                        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                          {formatDuration(photo.duration_seconds)}
                        </span>
                      ) : null}
                    </>
                  )}
                  {photo.guest_name && (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2 pb-1.5 pt-6 text-left text-[11px] text-white/95">
                      <span className="line-clamp-1">{photo.guest_name}</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-full border border-[#d9cfc4] bg-white px-6 py-3 text-sm text-[#4a4038] transition hover:bg-[#f6f1ea] disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Показати більше фото
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Тривалість ролика у вигляді 1:07. */
function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}
