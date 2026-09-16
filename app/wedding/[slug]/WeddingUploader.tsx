"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Loader2, RotateCcw, Video } from "lucide-react";
import {
  MAX_FILES_PER_BATCH,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  type WeddingPhoto,
} from "@/lib/wedding/config";
import { isVideoFile, messageFor, uploadOne } from "@/lib/wedding/upload-client";

// Блок завантаження. ОДИН компонент на два призначення.
//
// У режимі "media" гість скидає фото й відео у спільну галерею; у режимі "wish"
// записує відеопобажання в книгу. Відрізняються вони написами, тим, які файли
// приймає поле вибору, і прапорцем, який їде на сервер. Робити з цього два
// компоненти не варто: у цьому проєкті панель слота вже жила у двох копіях, і
// вони розійшлися — про це окремо написано в CLAUDE.md.
//
// Файли йдуть ПО ОДНОМУ і послідовно. Паралельно було б швидше на добрій
// мережі, але тут мережа погана за визначенням: кілька одночасних відправок
// ділять той самий вузький канал, і будь-який обрив б'є одразу по всіх.
// Послідовно ж видно, що саме зараз їде, а обрив коштує одного файлу, який
// гість повторює кнопкою.

type ItemStatus = "waiting" | "preparing" | "uploading" | "done" | "error";

interface QueueItem {
  key: string;
  file: File;
  status: ItemStatus;
  progress: number;
  error?: string;
  previewUrl: string;
  isVideo: boolean;
}

interface Props {
  slug: string;
  mode: "media" | "wish";
  onUploaded: (photo: WeddingPhoto) => void;
  // Імʼя спільне на всю сторінку: блоки стоять поруч, і два незалежні поля
  // показували б поруч різні значення. Стан живе в useGuestName.
  guestName: string;
  onGuestNameChange: (value: string) => void;
}

export default function WeddingUploader({
  slug,
  mode,
  onUploaded,
  guestName,
  onGuestNameChange,
}: Props) {
  const isWishMode = mode === "wish";

  const [items, setItems] = useState<QueueItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const pickInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

  // Імʼя в ref, бо черга відправки читає його під час роботи, а не на момент
  // натискання: гість цілком може дописати підпис, поки файли ще їдуть.
  const guestNameRef = useRef("");
  useEffect(() => {
    guestNameRef.current = guestName;
  }, [guestName]);

  const itemsRef = useRef<QueueItem[]>([]);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl)), []);

  const patch = useCallback((key: string, next: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...next } : it)));
  }, []);

  const sendOne = useCallback(
    async (item: QueueItem) => {
      try {
        patch(item.key, { status: "preparing", progress: 0, error: undefined });
        const photo = await uploadOne({
          slug,
          file: item.file,
          guestName: guestNameRef.current,
          isWish: isWishMode,
          onStage: (stage) => patch(item.key, { status: stage }),
          onProgress: (pct) => patch(item.key, { progress: pct }),
        });
        patch(item.key, { status: "done", progress: 100 });
        onUploaded(photo);
      } catch (e) {
        patch(item.key, { status: "error", error: messageFor(e) });
      }
    },
    [slug, isWishMode, patch, onUploaded]
  );

  const runningRef = useRef(false);

  // Ключі, які працівник уже взяв у роботу.
  //
  // Без цього списку черга могла б відправити той самий файл двічі: працівник
  // шукає наступне очікуюче в itemsRef, а той оновлюється лише з новим
  // рендером, і чи встиг React застосувати стан до наступного витка циклу —
  // не гарантовано нічим.
  const takenRef = useRef<Set<string>>(new Set());

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find(
          (it) => it.status === "waiting" && !takenRef.current.has(it.key)
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

      const allowed = picked.filter((f) => {
        const video = isVideoFile(f);

        // У книзі побажань чекаємо саме відеолистівку. Знімок сюди потрапляє
        // випадково, і мовчки класти його в книгу було б неправильно.
        if (isWishMode && !video) {
          messages.push(`«${f.name}» це фото, а для побажання потрібне відео.`);
          return false;
        }
        if (video && f.size > MAX_VIDEO_BYTES) {
          messages.push(`«${f.name}» важить більше за 200 МБ, тому це відео пропущено.`);
          return false;
        }
        if (!video && f.size > MAX_IMAGE_BYTES) {
          messages.push(`«${f.name}» важить більше за 15 МБ, тому це фото пропущено.`);
          return false;
        }
        return true;
      });

      const accepted = allowed.slice(0, MAX_FILES_PER_BATCH);
      if (allowed.length > MAX_FILES_PER_BATCH) {
        messages.push(
          `За один раз ми беремо ${MAX_FILES_PER_BATCH} файлів, тому решту додайте наступною порцією.`
        );
      }

      setNotice(messages.length ? messages.join(" ") : null);
      if (!accepted.length) return;

      setItems((prev) => [
        ...prev,
        ...accepted.map((file, i) => ({
          key: `${Date.now()}-${i}-${file.name}`,
          file,
          status: "waiting" as const,
          progress: 0,
          previewUrl: URL.createObjectURL(file),
          isVideo: isVideoFile(file),
        })),
      ]);
    },
    [isWishMode]
  );

  // Черга запускається реакцією на появу очікуючих, а не прямо з addFiles: на
  // момент виклику addFiles новий стан ще не застосований, тож працівник не
  // побачив би щойно доданих файлів.
  useEffect(() => {
    if (items.some((it) => it.status === "waiting")) void drain();
  }, [items, drain]);

  const retry = useCallback((key: string) => {
    // Звільняємо ключ, інакше працівник вважатиме файл уже взятим і кнопка
    // «Ще раз» нічого не зробить.
    takenRef.current.delete(key);
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, status: "waiting", error: undefined } : it))
    );
  }, []);

  const clearFinished = useCallback(() => {
    setItems((prev) => {
      prev
        .filter((it) => it.status === "done")
        .forEach((it) => {
          URL.revokeObjectURL(it.previewUrl);
          takenRef.current.delete(it.key);
        });
      return prev.filter((it) => it.status !== "done");
    });
  }, []);

  const busy = items.some((it) => it.status === "preparing" || it.status === "uploading");
  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;

  return (
    <div>
      <input
        ref={pickInputRef}
        type="file"
        accept={isWishMode ? "video/*" : "image/*,video/*,.heic,.heif"}
        multiple={!isWishMode}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = ""; // Щоб той самий файл можна було вибрати ще раз.
        }}
      />
      <input
        ref={captureInputRef}
        type="file"
        accept={isWishMode ? "video/*" : "image/*"}
        // Для побажання відкриваємо фронтальну камеру: людина говорить у кадр.
        // Для галереї — основну, бо знімають свято, а не себе.
        capture={isWishMode ? "user" : "environment"}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => captureInputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#6E1F2E] px-6 py-4 text-base font-medium text-white shadow-sm transition active:scale-[0.99] hover:bg-[#571825]"
        >
          {isWishMode ? <Video className="h-5 w-5" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
          {isWishMode ? "Записати побажання" : "Зняти зараз"}
        </button>
        <button
          type="button"
          onClick={() => pickInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-2xl border border-[#d9cfc4] bg-white px-6 py-4 text-base font-medium text-[#4A4038] transition active:scale-[0.99] hover:bg-[#f6f1ea] sm:w-auto"
        >
          <ImagePlus className="h-5 w-5" aria-hidden />
          {isWishMode ? "Вибрати відео" : "Додати з галереї"}
        </button>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm text-[#8A7A6B]">
          Ваше імʼя, щоб пара знала, від кого це
        </span>
        <input
          type="text"
          value={guestName}
          maxLength={60}
          onChange={(e) => onGuestNameChange(e.target.value)}
          placeholder="Наприклад, Марічка"
          className="w-full rounded-xl border border-[#ddd3c8] bg-white px-4 py-3 text-base text-[#4A4038] outline-none transition placeholder:text-[#b3a595] focus:border-[#6E1F2E]"
        />
      </label>

      {notice && (
        <p className="mt-3 rounded-xl bg-[#fdf3e6] px-4 py-3 text-sm text-[#8a6a3f]">{notice}</p>
      )}

      {items.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#8A7A6B]">
              {busy
                ? "Файли завантажуються, залишайтеся на сторінці."
                : errorCount
                  ? `Завантажено ${doneCount}, не вдалося ${errorCount}.`
                  : `Завантажено: ${doneCount}.`}
            </p>
            {!busy && doneCount > 0 && (
              <button
                type="button"
                onClick={clearFinished}
                className="shrink-0 text-sm text-[#a2937f] underline underline-offset-2 transition hover:text-[#6d5f52]"
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
                <QueueThumb item={item} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#4A4038]">{item.file.name}</p>
                  <StatusLine item={item} />
                </div>
                <StatusIcon status={item.status} onRetry={() => retry(item.key)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QueueThumb({ item }: { item: QueueItem }) {
  if (item.isVideo) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#efe7dd] text-[#6E1F2E]">
        <Video className="h-5 w-5" aria-hidden />
      </span>
    );
  }
  // Прев'ю з файлу на пристрої — воно вже є, тож показуємо його одразу, не
  // чекаючи ні стиснення, ні відповіді сервера.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.previewUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />;
}

function StatusLine({ item }: { item: QueueItem }) {
  if (item.status === "error") {
    return <p className="mt-0.5 text-xs text-[#b4574f]">{item.error}</p>;
  }
  if (item.status === "done") {
    return <p className="mt-0.5 text-xs text-[#6f8f6a]">Збережено.</p>;
  }
  if (item.status === "waiting") {
    return <p className="mt-0.5 text-xs text-[#a2937f]">Очікує своєї черги.</p>;
  }

  const label = item.status === "preparing" ? "Готуємо файл" : `Надсилаємо ${item.progress}%`;
  return (
    <div className="mt-1">
      <p className="text-xs text-[#a2937f]">{label}</p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#ece4da]">
        <div
          className="h-full rounded-full bg-[#6E1F2E] transition-[width] duration-200"
          style={{ width: `${item.status === "preparing" ? 8 : Math.max(4, item.progress)}%` }}
        />
      </div>
    </div>
  );
}

function StatusIcon({ status, onRetry }: { status: ItemStatus; onRetry: () => void }) {
  if (status === "done") {
    return <Check className="h-5 w-5 shrink-0 text-[#6f8f6a]" aria-label="Готово" />;
  }
  if (status === "error") {
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
  if (status === "waiting") {
    return <span className="h-4 w-4 shrink-0 rounded-full border border-[#cbbfb2]" aria-hidden />;
  }
  return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#b3a595]" aria-label="Триває" />;
}
