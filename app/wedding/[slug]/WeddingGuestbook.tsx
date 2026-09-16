"use client";

import { Video } from "lucide-react";
import { photoUrl, type WeddingPhoto } from "@/lib/wedding/config";

// Книга побажань: відеолистівки гостей.
//
// Показуємо їх окремим блоком, а не впереміш із галереєю, бо це різні речі за
// призначенням. Знімок із танцполу дивляться мимохідь, а побажання пара
// переглядає навмисно, і воно має бути більшим за плитку в сітці.

interface Props {
  wishes: WeddingPhoto[];
  loading: boolean;
  onOpen: (photoId: string) => void;
}

export default function WeddingGuestbook({ wishes, loading, onOpen }: Props) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4">
      <h2 className="mb-2 text-center font-[family-name:var(--font-wedding-display)] text-2xl text-[#6E1F2E]">
        Книга побажань
      </h2>
      <p className="mb-5 text-center text-sm leading-relaxed text-[#8A7A6B]">
        Запишіть коротку відеолистівку з теплими словами, і вона лишиться в парі назавжди.
      </p>

      {loading ? (
        <p className="py-6 text-center text-sm text-[#a2937f]">Завантажуємо побажання…</p>
      ) : wishes.length === 0 ? (
        <p className="rounded-2xl bg-white/70 px-6 py-6 text-center text-sm leading-relaxed text-[#8A7A6B]">
          Побажань поки немає, і ваше може стати найпершим.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {wishes.map((wish) => (
            <li key={wish.id}>
              <button
                type="button"
                onClick={() => onOpen(wish.id)}
                className="group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#efe7dd]"
              >
                {/* Обкладинку знімає браузер гостя під час завантаження; коли
                    вона не вийшла, лишається спокійна плашка, а не бита картинка. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(wish.id)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#6E1F2E] shadow-sm">
                  <Video className="h-5 w-5" aria-hidden />
                </span>
                <span className="absolute inset-x-0 bottom-0 px-3 pb-2 text-left text-xs text-white">
                  <span className="line-clamp-1">{wish.guest_name || "Від гостя"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
