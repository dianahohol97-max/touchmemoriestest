'use client';

import { useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { photoUrl, type WeddingPhoto } from '@/lib/wedding/config';

// Перегляд одного фото на весь екран.
//
// Простий навмисно: ані масштабування пальцями, ані свайпів. Гість відкриває
// звідси одне-два фото за вечір, а кожен жест — це ще один спосіб зачепити
// щось випадково однією рукою з келихом у другій.

interface Props {
  photos: WeddingPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function WeddingLightbox({ photos, index, onClose, onNavigate }: Props) {
  const photo = photos[index];

  const goPrev = useCallback(() => {
    if (index > 0) onNavigate(index - 1);
  }, [index, onNavigate]);

  const goNext = useCallback(() => {
    if (index < photos.length - 1) onNavigate(index + 1);
  }, [index, photos.length, onNavigate]);

  // Клавіатура — для пари й гостей, які відкриють галерею з ноутбука вдома.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  // Сторінка під накладкою не має прокручуватися: інакше на телефоні
  // прокручується саме вона, а не фото, і після закриття гість опиняється
  // зовсім в іншому місці галереї.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Перегляд фото"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрити"
        className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      {index > 0 && (
        <button
          type="button"
          aria-label="Попереднє фото"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-2 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          type="button"
          aria-label="Наступне фото"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
        >
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      )}

      {/* Зупиняємо спливання, щоб дотик по самому фото не закривав перегляд —
          закриває тільки темне поле навколо. */}
      <figure
        className="relative flex max-h-full w-full max-w-4xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-[78vh] w-full">
          <Image
            src={photoUrl(photo.id)}
            alt={photo.guest_name ? `Фото від гостя на імʼя ${photo.guest_name}` : 'Фото з весілля'}
            fill
            sizes="(min-width: 1024px) 896px, 100vw"
            // contain, а не cover: тут фото показується цілим, без обрізання.
            className="object-contain"
            priority
          />
        </div>
        {photo.guest_name && (
          <figcaption className="mt-3 text-center text-sm text-white/80">
            Світлину надіслала або надіслав {photo.guest_name}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
