"use client";

import { prepareMedia, isVideoFile, HeicConversionError } from "./compress";
import type { WeddingPhoto } from "./config";

// Транспорт завантаження: підписане посилання → файл прямо в сховище → рядок у базі.
//
// Живе окремо від компонента, бо той самий шлях проходять і знімки з галереї, і
// відеопобажання. Дві копії цього коду розійшлися б через тиждень — у цьому
// проєкті таке вже ставалося з панеллю слота, і про це окремо написано в
// CLAUDE.md.

export class UploadError extends Error {}

export interface UploadResult {
  photo: WeddingPhoto;
}

export interface UploadOptions {
  slug: string;
  file: File;
  guestName: string;
  isWish: boolean;
  onStage: (stage: "preparing" | "uploading") => void;
  onProgress: (percent: number) => void;
}

export async function uploadOne(opts: UploadOptions): Promise<WeddingPhoto> {
  const { slug, file, guestName, isWish, onStage, onProgress } = opts;

  onStage("preparing");
  const prepared = await prepareMedia(file);

  // 1. Питаємо дозвіл. Сервер перевіряє тип і розмір ДО того, як щось поїде, і
  //    лише тоді підписує посилання на один конкретний шлях.
  const ticket = await requestTicket(slug, prepared.file);

  onStage("uploading");

  // 2. Файл летить прямо в сховище, повз наші функції. Інакше він і не долетів
  //    би: Vercel приймає тіло запиту до 4,5 МБ, а ролик важить сотні.
  await putToSignedUrl(ticket.uploadUrl, prepared.file, ticket.contentType, onProgress);

  // 3. Обкладинка відео — туди ж, тим самим способом. Її відсутність не має
  //    коштувати гостю ролика, тож помилку тут ковтаємо.
  let posterPath = ticket.posterPath;
  if (posterPath && ticket.posterUrl && prepared.poster) {
    try {
      await putToSignedUrl(ticket.posterUrl, prepared.poster, "image/jpeg", () => {});
    } catch {
      posterPath = null;
    }
  } else {
    posterPath = null;
  }

  // 4. Сервер дивиться, що НАСПРАВДІ лягло в бакет, і лише тоді створює рядок.
  const res = await fetch(`/api/wedding/${slug}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: ticket.path,
      posterPath,
      guestName: guestName.trim() || undefined,
      isWish,
      width: prepared.width || undefined,
      height: prepared.height || undefined,
      durationSeconds: prepared.durationSeconds ?? undefined,
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.photo) {
    throw new UploadError(body?.error || "Не вдалося зберегти. Спробуйте ще раз.");
  }
  return body.photo as WeddingPhoto;
}

interface Ticket {
  path: string;
  uploadUrl: string;
  contentType: string;
  posterPath: string | null;
  posterUrl: string | null;
}

async function requestTicket(slug: string, file: File): Promise<Ticket> {
  const res = await fetch(`/api/wedding/${slug}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.uploadUrl) {
    throw new UploadError(body?.error || "Не вдалося почати завантаження. Спробуйте ще раз.");
  }
  return body as Ticket;
}

/**
 * Кладе файл за підписаним посиланням через XMLHttpRequest.
 *
 * Не fetch, і причина одна: fetch не повідомляє про поступ ВІДПРАВКИ. Він уміє
 * читати потік відповіді, але не тіла запиту, а тут важливий саме запит — гість
 * дивиться, як його ролик на сто мегабайтів їде в поганій мережі. Без поступу
 * сторінка виглядає завислою, і файл надсилають удруге.
 */
function putToSignedUrl(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new UploadError("Не вдалося надіслати файл. Спробуйте ще раз."));
    };
    xhr.onerror = () =>
      reject(new UploadError("Звʼязок обірвався. Перевірте інтернет і спробуйте ще раз."));
    xhr.ontimeout = () => reject(new UploadError("Завантаження триває задовго. Спробуйте ще раз."));
    xhr.onabort = () => reject(new UploadError("Завантаження перервано."));
    xhr.send(body);
  });
}

export function messageFor(e: unknown): string {
  if (e instanceof HeicConversionError) {
    return "Не вдалося прочитати це фото з iPhone. Надішліть його ще раз або оберіть інше.";
  }
  if (e instanceof UploadError) return e.message;
  return "Щось пішло не так. Спробуйте ще раз.";
}

export { isVideoFile };
