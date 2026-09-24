/**
 * Браузерна половина «Завантажити все»: тягне файли, складає з них ZIP
 * потоком (client-zip, без стиснення) і віддає або прямо у файл на диску
 * (`stream`), або одним Blob обмеженого розміру (`single`/`parts`). Що
 * обирати і як ділити — у `zip-plan.ts`.
 *
 * Пам'ять. client-zip читає наступний файл тільки тоді, коли попередній уже
 * пішов далі, тож у режимі `stream` у пам'яті лежить один файл за раз, а в
 * режимі Blob — одна частина, не більше `PART_LIMIT_BYTES`. Другої копії, яку
 * робив JSZip `generateAsync`, тут немає.
 */

import type { ZipFile } from './zip-plan';

export interface ZipSource extends ZipFile {
  /** Публічна адреса у сховищі (R2 або Supabase). */
  url: string;
}

export interface ZipRunOptions {
  token: string;
  files: ZipSource[];
  signal: AbortSignal;
  /** Байти вмісту, що вже пройшли; викликається часто, дроселюйте самі. */
  onProgress: (doneBytes: number) => void;
}

export interface ZipRunStats {
  /** Скільки файлів пішло запасним шляхом через наш сервер (Vercel), бо
   *  пряме читання зі сховища відмовило — найчастіше через CORS бакета. */
  viaProxy: number;
}

function isAbort(e: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (e as any)?.name === 'AbortError';
}

/**
 * Відповідь з байтами одного файлу. Спершу напряму зі сховища — це не коштує
 * нам трафіку. `cache: 'no-store'` обов'язковий: мініатюри в сітці завантажені
 * тегом <img> без CORS, і Chrome охоче віддає fetch-у той самий запис із кешу
 * без заголовка Access-Control-Allow-Origin, після чого CORS «відмовляє» навіть
 * тоді, коли бакет усе дозволяє. Відмова (крім скасування) — наш маршрут
 * `?stream=1`, який проксить байти, і лічильник `viaProxy`.
 */
async function openFile(
  f: ZipSource, token: string, signal: AbortSignal, stats: ZipRunStats,
): Promise<Response> {
  try {
    const direct = await fetch(f.url, { cache: 'no-store', signal });
    if (direct.ok && direct.body) return direct;
  } catch (e) {
    if (isAbort(e, signal)) throw e;
  }
  const viaUs = await fetch(
    `/api/gallery/${encodeURIComponent(token)}/file/${encodeURIComponent(f.id)}?stream=1`,
    { signal },
  );
  if (!viaUs.ok || !viaUs.body) throw new Error(`file ${viaUs.status}`);
  stats.viaProxy++;
  return viaUs;
}

/** Та сама відповідь, але кожен шматок, що пройшов, рахується в прогрес. */
function counted(res: Response, add: (n: number) => void): ReadableStream<Uint8Array> {
  return res.body!.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) { add(chunk.byteLength); ctrl.enqueue(chunk); },
  }));
}

async function zipResponse(opts: ZipRunOptions, stats: ZipRunStats): Promise<Response> {
  const { downloadZip } = await import('client-zip');
  let done = 0;
  const add = (n: number) => { done += n; opts.onProgress(done); };
  async function* entries() {
    for (const f of opts.files) {
      if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const res = await openFile(f, opts.token, opts.signal, stats);
      yield { name: f.name, input: counted(res, add), lastModified: new Date() };
    }
  }
  return downloadZip(entries());
}

/** Чи є запис прямо у файл на диску (Chrome/Edge на комп'ютері). */
export function canStreamToDisk(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as any).showSaveFilePicker === 'function'
    && window.isSecureContext
    && window.self === window.top;
}

/**
 * Діалог «Зберегти як». Викликати ПЕРШИМ ділом у обробнику кліку, до будь-
 * якого await: браузер відкриває його лише у відповідь на жест людини.
 * Повертає null, якщо людина закрила діалог.
 */
export async function pickZipTarget(suggestedName: string): Promise<any | null> {
  try {
    return await (window as any).showSaveFilePicker({
      suggestedName,
      types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }],
    });
  } catch (e) {
    if ((e as any)?.name === 'AbortError') return null;
    throw e;
  }
}

/** Спосіб `stream`: архів тече прямо у файл, обраний у діалозі. Скасування
 *  перериває запис, і Chrome прибирає недописаний тимчасовий файл сам. */
export async function zipToDisk(handle: any, opts: ZipRunOptions): Promise<ZipRunStats> {
  const stats: ZipRunStats = { viaProxy: 0 };
  const writable = await handle.createWritable();
  const res = await zipResponse(opts, stats);
  await res.body!.pipeTo(writable, { signal: opts.signal });
  return stats;
}

/** Способи `single`/`parts`: одна частина в пам'яті, потім звичайне
 *  збереження файлу браузером. */
export async function zipToBlobDownload(fileName: string, opts: ZipRunOptions): Promise<ZipRunStats> {
  const stats: ZipRunStats = { viaProxy: 0 };
  const res = await zipResponse(opts, stats);
  const blob = await res.blob();
  if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Не одразу: Safari і Firefox скасовують збереження, якщо адресу відкликати
  // в тому ж такті, що й клік (так було до 2026-09-24).
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
  return stats;
}

export { isAbort };
