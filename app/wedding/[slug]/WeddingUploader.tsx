'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Loader2, RotateCcw, X } from 'lucide-react';
import { HeicConversionError, preparePhoto } from '@/lib/wedding/compress';
import { MAX_FILES_PER_BATCH, MAX_FILE_BYTES, type WeddingPhoto } from '@/lib/wedding/config';

// Блок завантаження.
//
// Файли йдуть ПО ОДНОМУ і послідовно. Паралельно було б швидше на добрій
// мережі, але тут мережа погана за визначенням: кілька одночасних відправок
// ділять той самий вузький канал, кожна триває довше, і будь-який обрив б'є
// одразу по всіх. Послідовно ж видно, що саме зараз їде, а обрив коштує одного
// фото, яке гість повторює кнопкою.
//
// Стиснення теж послідовне і з тієї ж причини, тільки замість каналу — пам'ять:
// два полотна по 12 мегапікселів одночасно кладуть вкладку на старому телефоні.

const NAME_STORAGE_KEY = 'wedding-guest-name';

type ItemStatus = 'waiting' | 'preparing' | 'uploading' | 'done' | 'error';

interface QueueItem {
  key: string;
  file: File;
  status: ItemStatus;
  progress: number;
  error?: string;
  previewUrl: string;
}

interface Props {
  slug: string;
  onUploaded: (photo: WeddingPhoto) => void;
}

export default function WeddingUploader({ slug, onUploaded }: Props) {
  const [guestName, setGuestName] = useState('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Ім'я гостя читається з пам'яті браузера, щоб не набирати його вдруге —
  // гість повертається за вечір кілька разів, і щоразу підписуватися нудно.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_STORAGE_KEY);
      if (saved) setGuestName(saved);
    } catch {
      // Приватний режим або заблоковані дані сайту. Поле просто лишиться порожнім.
    }
  }, []);

  // Ім'я в ref, бо черга відправки читає його під час роботи, а не на момент
  // натискання: гість цілком може дописати підпис, поки фото ще їдуть.
  const guestNameRef = useRef('');
  useEffect(() => {
    guestNameRef.current = guestName;
    try {
      if (guestName.trim()) localStorage.setItem(NAME_STORAGE_KEY, guestName.trim());
      else localStorage.removeItem(NAME_STORAGE_KEY);
    } catch {
      // Те саме: без пам'яті браузера все працює, просто ім'я не переживе перезавантаження.
    }
  }, [guestName]);

  // Адреси прев'ю звільняються при демонтажі, інакше кожні двадцять фото
  // залишають по blob-адресі, які браузер тримає до перезавантаження сторінки.
  const itemsRef = useRef<QueueItem[]>([]);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl)), []);

  const patch = useCallback((key: string, next: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...next } : it)));
  }, []);

  /** Готує і відправляє одне фото. Помилка зупиняє тільки його. */
  const sendOne = useCallback(
    async (item: QueueItem) => {
      try {
        patch(item.key, { status: 'preparing', progress: 0, error: undefined });
        const prepared = await preparePhoto(item.file);

        patch(item.key, { status: 'uploading', progress: 0 });
        const photo = await uploadWithProgress(slug, prepared, guestNameRef.current, (pct) =>
          patch(item.key, { progress: pct })
        );

        patch(item.key, { status: 'done', progress: 100 });
        onUploaded(photo);
      } catch (e) {
        patch(item.key, { status: 'error', error: messageFor(e) });
      }
    },
    [slug, patch, onUploaded]
  );

  // Черга: один працівник, який добирає наступне очікуюче фото. Прапорець у
  // ref, бо два запуски поспіль (гість додав ще файлів, поки перші їхали)
  // інакше пішли б паралельно, і сенс послідовної черги зник би.
  const runningRef = useRef(false);

  // Ключі, які працівник уже взяв у роботу.
  //
  // Без цього списку черга могла б відправити те саме фото двічі. Працівник
  // шукає наступне очікуюче в itemsRef, а той оновлюється тільки з новим
  // рендером; чи встиг React застосувати стан до наступного витка циклу —
  // не гарантовано нічим. Якби не встиг, щойно надіслане фото все ще значилося
  // б як очікуюче, і цикл узяв би його знову. Взяте один раз сюди й більше не
  // добирається, тож послідовність не залежить від моменту рендера.
  const takenRef = useRef<Set<string>>(new Set());

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find(
          (it) => it.status === 'waiting' && !takenRef.current.has(it.key)
        );
        if (!next) break;
        takenRef.current.add(next.key);
        await sendOne(next);
      }
    } finally {
      runningRef.current = false;
    }
  }, [sendOne]);

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const picked = Array.from(fileList);
      const messages: string[] = [];

      const withinSize = picked.filter((f) => {
        if (f.size > MAX_FILE_BYTES) {
          messages.push(`«${f.name}» важить більше за 15 МБ, тому це фото пропущено.`);
          return false;
        }
        return true;
      });

      const accepted = withinSize.slice(0, MAX_FILES_PER_BATCH);
      if (withinSize.length > MAX_FILES_PER_BATCH) {
        messages.push(
          `За один раз ми беремо ${MAX_FILES_PER_BATCH} фото, тому решту додайте наступною порцією.`
        );
      }

      setNotice(messages.length ? messages.join(' ') : null);
      if (!accepted.length) return;

      setItems((prev) => [
        ...prev,
        ...accepted.map((file, i) => ({
          key: `${Date.now()}-${i}-${file.name}`,
          file,
          status: 'waiting' as const,
          progress: 0,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
    },
    []
  );

  // Черга запускається реакцією на появу очікуючих, а не прямо з addFiles:
  // на момент виклику addFiles новий стан ще не застосований, тож працівник
  // не побачив би щойно доданих файлів.
  useEffect(() => {
    if (items.some((it) => it.status === 'waiting')) void drain();
  }, [items, drain]);

  const retry = useCallback((key: string) => {
    // Звільняємо ключ, інакше працівник вважатиме фото вже взятим і кнопка
    // «Ще раз» нічого не зробить.
    takenRef.current.delete(key);
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, status: 'waiting', error: undefined } : it))
    );
  }, []);

  const clearFinished = useCallback(() => {
    setItems((prev) => {
      prev
        .filter((it) => it.status === 'done')
        .forEach((it) => {
          URL.revokeObjectURL(it.previewUrl);
          takenRef.current.delete(it.key);
        });
      return prev.filter((it) => it.status !== 'done');
    });
  }, []);

  const busy = items.some((it) => it.status === 'preparing' || it.status === 'uploading');
  const doneCount = items.filter((it) => it.status === 'done').length;
  const errorCount = items.filter((it) => it.status === 'error').length;

  return (
    <section className="mx-auto w-full max-w-2xl px-4">
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = ''; // Щоб те саме фото можна було вибрати ще раз.
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2f2a26] px-6 py-4 text-base font-medium text-white shadow-sm transition active:scale-[0.99] hover:bg-[#443c35]"
        >
          <ImagePlus className="h-5 w-5" aria-hidden />
          Додати фото
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-2xl border border-[#d9cfc4] bg-white px-6 py-4 text-base font-medium text-[#4a4038] transition active:scale-[0.99] hover:bg-[#f6f1ea] sm:w-auto"
        >
          <Camera className="h-5 w-5" aria-hidden />
          Зняти зараз
        </button>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm text-[#7a6d61]">Ваше імʼя, якщо хочете підписати фото</span>
        <input
          type="text"
          value={guestName}
          maxLength={60}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Наприклад, Марічка"
          className="w-full rounded-xl border border-[#ddd3c8] bg-white px-4 py-3 text-base text-[#2f2a26] outline-none transition placeholder:text-[#b3a595] focus:border-[#9c8873]"
        />
      </label>

      {notice && (
        <p className="mt-3 rounded-xl bg-[#fdf3e6] px-4 py-3 text-sm text-[#8a6a3f]">{notice}</p>
      )}

      {items.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#7a6d61]">
              {busy
                ? 'Фото завантажуються, залишайтеся на сторінці.'
                : errorCount
                  ? `Завантажено ${doneCount}, не вдалося ${errorCount}.`
                  : `Завантажено фото: ${doneCount}.`}
            </p>
            {!busy && doneCount > 0 && (
              <button
                type="button"
                onClick={clearFinished}
                className="shrink-0 text-sm text-[#9a8b7c] underline underline-offset-2 transition hover:text-[#6d5f52]"
              >
                Сховати готові
              </button>
            )}
          </div>

          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-3 rounded-xl border border-[#e7ded3] bg-white/80 p-2"
              >
                {/* Прев'ю з файлу на пристрої — воно вже є, тож показуємо його
                    одразу, не чекаючи ні стиснення, ні відповіді сервера. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#4a4038]">{item.file.name}</p>
                  <StatusLine item={item} />
                </div>
                <StatusIcon status={item.status} onRetry={() => retry(item.key)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StatusLine({ item }: { item: QueueItem }) {
  if (item.status === 'error') {
    return <p className="mt-0.5 text-xs text-[#b4574f]">{item.error}</p>;
  }
  if (item.status === 'done') {
    return <p className="mt-0.5 text-xs text-[#6f8f6a]">Фото збережено.</p>;
  }
  if (item.status === 'waiting') {
    return <p className="mt-0.5 text-xs text-[#9a8b7c]">Очікує своєї черги.</p>;
  }

  const label = item.status === 'preparing' ? 'Готуємо фото' : `Надсилаємо ${item.progress}%`;
  return (
    <div className="mt-1">
      <p className="text-xs text-[#9a8b7c]">{label}</p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#ece4da]">
        <div
          className="h-full rounded-full bg-[#9c8873] transition-[width] duration-200"
          style={{ width: `${item.status === 'preparing' ? 8 : Math.max(4, item.progress)}%` }}
        />
      </div>
    </div>
  );
}

function StatusIcon({ status, onRetry }: { status: ItemStatus; onRetry: () => void }) {
  if (status === 'done') {
    return <Check className="h-5 w-5 shrink-0 text-[#6f8f6a]" aria-label="Готово" />;
  }
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#b4574f] transition hover:bg-[#fbeceb]"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        Ще раз
      </button>
    );
  }
  if (status === 'waiting') {
    return <X className="h-4 w-4 shrink-0 text-[#cbbfb2]" aria-hidden />;
  }
  return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#b3a595]" aria-label="Триває" />;
}

/**
 * Відправка через XMLHttpRequest, а не fetch.
 *
 * Причина одна: fetch не повідомляє про поступ ВІДПРАВКИ. Він уміє читати
 * потік відповіді, але не тіла запиту, а тут важливий саме запит — гість
 * дивиться, як його фото їде в поганій мережі. Без поступу на весільному
 * інтернеті сторінка виглядає завислою, і фото додають удруге.
 */
function uploadWithProgress(
  slug: string,
  prepared: { file: File; width: number; height: number },
  guestName: string,
  onProgress: (pct: number) => void
): Promise<WeddingPhoto> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', prepared.file);
    form.append('width', String(prepared.width));
    form.append('height', String(prepared.height));
    if (guestName.trim()) form.append('guestName', guestName.trim());

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/wedding/${slug}/upload`);
    xhr.responseType = 'json';

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      const body = xhr.response as { photo?: WeddingPhoto; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.photo) {
        resolve(body.photo);
      } else {
        reject(new UploadError(body?.error || 'Не вдалося зберегти фото. Спробуйте ще раз.'));
      }
    };
    xhr.onerror = () => reject(new UploadError('Звʼязок обірвався. Перевірте інтернет і спробуйте ще раз.'));
    xhr.ontimeout = () => reject(new UploadError('Завантаження триває задовго. Спробуйте ще раз.'));
    xhr.onabort = () => reject(new UploadError('Завантаження перервано.'));

    xhr.send(form);
  });
}

/** Помилка з готовим текстом для гостя. */
class UploadError extends Error {}

function messageFor(e: unknown): string {
  if (e instanceof HeicConversionError) {
    return 'Не вдалося прочитати це фото з iPhone. Надішліть його ще раз або оберіть інше.';
  }
  if (e instanceof UploadError) return e.message;
  return 'Щось пішло не так. Спробуйте ще раз.';
}
