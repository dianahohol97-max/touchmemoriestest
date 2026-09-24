/**
 * «Завантажити все» у клієнтській галереї: як зібрати архів так, щоб браузер
 * його пережив (Diana, 2026-09-24). Тут лише чиста логіка — визначення
 * пристрою, вибір способу, розбиття на частини, імена файлів в архіві. Усе, що
 * торкається мережі чи диска, живе в `zip-download.ts`; тести —
 * `tests/gallery-zip-plan.test.ts`.
 *
 * Чому взагалі частини. До цього архів збирався JSZip цілком у пам'яті, а
 * потім `generateAsync` робив із нього ще одну повну копію. Галерея Ірини
 * Владової — 280 фото на 3,66 ГБ, тобто близько 7 ГБ у піку: вкладка
 * телефона гине напевно, ноутбука — найімовірніше. І гине мовчки, бо лічильник
 * рахував тільки успіх.
 *
 * Три способи:
 * - `stream` — Chrome/Edge на комп'ютері, де є `showSaveFilePicker`: один архів
 *   пишеться прямо на диск, у пам'яті одночасно лежить один файл.
 * - `single` — уся галерея менша за частину для цього пристрою: один архів
 *   у пам'яті, як і раніше, але вже з відомою стелею.
 * - `parts` — решта: кнопки «Частина k з N», кожна не важча за
 *   `PART_LIMIT_BYTES[device]`.
 */

export type ZipDevice = 'ios' | 'android' | 'desktop' | 'in-app';
export type ZipMethod = 'stream' | 'parts' | 'single';

const MB = 1024 * 1024;

/**
 * Найбільша частина, яку пристрій збирає в пам'яті. Єдине місце, де ці числа
 * живуть, — підкручувати тут, дивлячись у `gallery_zip_attempts`.
 *
 * iPhone/iPad — 300 МБ: Safari закриває важкі вкладки раніше за Android, і
 * старші моделі не пережили б 500 (Diana, 2026-09-24). Вбудований браузер
 * Інстаграма/Фейсбука — та сама стеля, бо це теж WebView із тісною пам'яттю.
 * Комп'ютер без `showSaveFilePicker` (Safari, Firefox) — гігабайт: Safari на
 * macOS тримає Blob у пам'яті, тож більше не варто.
 */
export const PART_LIMIT_BYTES: Record<ZipDevice, number> = {
  ios: 300 * MB,
  android: 500 * MB,
  'in-app': 300 * MB,
  desktop: 1024 * MB,
};

/**
 * Ліміт частини з урахуванням того, чи вже був збій. Коли цілий архів не
 * вдався (запис на диск відмовив, браузер не потягнув), частини беремо не
 * більшими за андроїдні 500 МБ навіть на комп'ютері: причина збою нам
 * невідома, і обережніше розбити дрібніше, ніж упасти вдруге.
 */
export function partLimitFor(device: ZipDevice, afterFailure: boolean): number {
  const base = PART_LIMIT_BYTES[device];
  return afterFailure ? Math.min(base, PART_LIMIT_BYTES.android) : base;
}

/**
 * Скільки байтів додає ZIP на кожен файл понад сам вміст: локальний заголовок
 * (30), запис каталогу (46), дескриптор даних (до 24), розширення ZIP64 (до
 * 32) і ім'я двічі. Оцінка з запасом — частина має вкладатися в ліміт напевно.
 */
export function zipEntryOverhead(name: string): number {
  return 30 + 46 + 24 + 32 + 2 * new TextEncoder().encode(name).length;
}

/**
 * Тип пристрою з User-Agent. UA НЕ зберігається ніде — у журнал іде лише
 * результат цієї функції.
 *
 * iPadOS 13+ видає себе за Mac, тому `maxTouchPoints > 1` на «Macintosh» —
 * це iPad. Вбудовані браузери перевіряються першими: Instagram на iPhone
 * теж містить «iPhone», але поводиться не як Safari.
 */
export function detectZipDevice(ua: string, maxTouchPoints = 0): ZipDevice {
  const s = ua || '';
  if (/Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|Threads/i.test(s)) return 'in-app';
  if (/iPhone|iPad|iPod/i.test(s)) return 'ios';
  if (/Macintosh/i.test(s) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(s)) return 'android';
  return 'desktop';
}

/**
 * Спосіб для цього пристрою й обсягу. `canStreamToDisk` — чи є
 * `showSaveFilePicker` (лише Chrome/Edge на комп'ютері); на телефоні його
 * немає ніде, тож мобільний пристрій ніколи не отримає `stream`, навіть якщо
 * браузер щось таке оголосить.
 */
export function chooseZipMethod(opts: {
  device: ZipDevice;
  canStreamToDisk: boolean;
  totalBytes: number;
}): ZipMethod {
  if (opts.device === 'desktop' && opts.canStreamToDisk) return 'stream';
  return opts.totalBytes <= PART_LIMIT_BYTES[opts.device] ? 'single' : 'parts';
}

export interface ZipFile {
  id: string;
  /** Ім'я В АРХІВІ — уже унікальне, див. `uniqueZipNames`. */
  name: string;
  size: number;
}

export interface ZipPlan<T extends ZipFile = ZipFile> {
  parts: T[][];
  /** Файли, які самі важчі за частину (зазвичай відео до 2 ГБ): вони йдуть
   *  окремими посиланнями, які браузер качає сам, без нашої пам'яті. */
  separate: T[];
}

/**
 * Розбиття на частини по порядку галереї: файл іде в поточну частину, поки
 * вона вкладається в ліміт разом із накладними витратами ZIP, інакше
 * починається нова. Порядок зберігається, щоб «Частина 1» була початком
 * зйомки, а не випадковою вибіркою. Розмір невідомий (null у старих рядках)
 * рахується як нуль — краще трохи переповнена частина, ніж загублений файл.
 */
export function planZipParts<T extends ZipFile>(files: T[], limitBytes: number): ZipPlan<T> {
  const parts: T[][] = [];
  const separate: T[] = [];
  let current: T[] = [];
  let used = 0;
  for (const f of files) {
    const cost = Math.max(0, f.size || 0) + zipEntryOverhead(f.name);
    if (cost > limitBytes) { separate.push(f); continue; }
    if (current.length && used + cost > limitBytes) {
      parts.push(current);
      current = [];
      used = 0;
    }
    current.push(f);
    used += cost;
  }
  if (current.length) parts.push(current);
  return { parts, separate };
}

/** Сумарна вага частини з накладними витратами — для підпису на кнопці. */
export function partBytes(part: ZipFile[]): number {
  return part.reduce((s, f) => s + Math.max(0, f.size || 0) + zipEntryOverhead(f.name), 0);
}

// Символи, які Windows не дозволяє в іменах, плюс керівні. Скісна риска
// створила б у архіві папку, а `..` — шлях назовні при розпакуванні.
const UNSAFE = /[\u0000-\u001f\u007f<>:"/\\|?*]+/g;

function sanitize(name: string): string {
  let s = (name || '').replace(UNSAFE, '_').trim();
  // Крапки й пробіли в кінці Windows мовчки відрізає — тоді два різні імена
  // стали б однаковими вже на диску.
  s = s.replace(/[. ]+$/, '');
  s = s.replace(/^\.+/, '');
  return s;
}

function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return [name, ''];
  return [name.slice(0, dot), name.slice(dot)];
}

/**
 * Імена файлів в архіві, унікальні на ВЕСЬ набір (а не на частину), щоб
 * частини розпаковувалися в одну папку без заміни. JSZip мовчки заміняв
 * файл із тим самим іменем — два IMG_0001.jpg із різних камер давали один.
 *
 * Порівняння без регістру: Windows і macOS вважають `IMG_1.JPG` і `img_1.jpg`
 * одним файлом. Збіг отримує суфікс перед розширенням: `IMG_0001 (2).jpg`.
 * Порожнє ім'я стає `photo_N.jpg` або `video_N.mp4` за номером у галереї.
 */
export function uniqueZipNames(
  files: { file_name: string | null | undefined; media_type?: string | null }[],
): string[] {
  const taken = new Set<string>();
  return files.map((f, i) => {
    const base = sanitize(f.file_name || '')
      || (f.media_type === 'video' ? `video_${i + 1}.mp4` : `photo_${i + 1}.jpg`);
    let name = base;
    if (taken.has(name.toLowerCase())) {
      const [stem, ext] = splitExt(base);
      let n = 2;
      do { name = `${stem} (${n})${ext}`; n++; } while (taken.has(name.toLowerCase()));
    }
    taken.add(name.toLowerCase());
    return name;
  });
}

/** Ім'я самого архіву: назва галереї без символів, які ламають файлову
 *  систему, і підпис частини («частина 2 з 8»), коли частин більше за одну. */
export function archiveName(title: string, partLabel?: string): string {
  const clean = (v: string) => (v || '').replace(/[^\p{L}\p{N} _-]+/gu, '').replace(/\s+/g, ' ').trim();
  const base = clean(title) || 'gallery';
  const suffix = partLabel ? clean(partLabel) : '';
  return suffix ? `${base} - ${suffix}.zip` : `${base}.zip`;
}

/** «290 МБ» / «3,7 ГБ» у мові галереї. Одиниці приходять із перекладу. */
export function formatBytes(n: number, units: [string, string], locale: string): string {
  const mb = Math.max(0, n) / MB;
  if (mb < 1024) return `${Math.max(1, Math.round(mb)).toLocaleString(locale)} ${units[0]}`;
  return `${(mb / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} ${units[1]}`;
}
