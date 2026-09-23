'use client';

/**
 * Підказка кольору тла готової обкладинки.
 *
 * ЧОМУ СЕРЕДНЄ НЕ ПРАЦЮЄ. Попередній варіант (`sampleCoverEdgeColor` у
 * BookLayoutEditor) малював картинку в канву 48×48 і усереднював зовнішнє
 * кільце завширшки пʼять пікселів. Кільце виходило 860 пікселів із 2304, тобто
 * більш ніж третина площі і приблизно десята частина ширини з кожного боку —
 * рівно там, де в наших дизайнів лежить декоративна рамка. Середнє між рожевим
 * тлом «Аргентини» і темним орнаментом дало бурий #b27467, якого на обкладинці
 * немає ніде, і однаковий він у всіх трьох макетах з цією обкладинкою.
 *
 * ЩО РОБИТЬ ЦЕЙ ВАРІАНТ. Дивиться тільки на тонкий край — півтора відсотка
 * меншої сторони, — і бере НАЙЧАСТІШИЙ колір, а не середній. Середнє по
 * візерунку завжди дає бруд, мода повертає ту рівну заливку, яка справді
 * займає більшість краю. Кольори спершу згортаються в кошики по шістнадцять
 * рівнів на канал, щоб шум стиснення не розбивав одну заливку на сотню
 * сусідніх відтінків, а вже потім усередині найбільшого кошика береться
 * точне середнє.
 *
 * Функція живе окремо від конструктора навмисно: цей самий розрахунок показує
 * адмінка, коли пропонує колір для щойно завантаженої обкладинки. Дві копії
 * розійшлися б, і тоді підказка в каталозі перестала б відповідати тому, що
 * підставляє редактор старим обкладинкам без заданого кольору.
 *
 * Повертає null на будь-якій невдачі — не завантажилося, зіпсована канва,
 * прозорий край. Виклики просто пропускають підстановку: краще лишити колір
 * незаданим, ніж підставити вигаданий.
 */

/** Частка МЕНШОЇ сторони, яку вважаємо краєм. */
const EDGE_FRACTION = 0.015;
/** Край ніколи не тонший за це, інакше на малих картинках нема що рахувати. */
const MIN_EDGE_PX = 2;
/** Робоча ширина канви. Досить, щоб край лишався краєм, і дешево за памʼяттю. */
const WORK_W = 400;
/** Ширина кошика квантування на канал. */
const BUCKET = 16;

const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

/** Найчастіший колір тонкого краю картинки у форматі #rrggbb, або null. */
export function sampleCoverBackgroundColor(url: string): Promise<string | null> {
  return new Promise(resolve => {
    if (typeof document === 'undefined' || !url) return resolve(null);
    try {
      const img = new window.Image();
      // Без цього канва «псується» і getImageData кидає. Сховище віддає
      // access-control-allow-origin: *, тож заголовок спрацьовує.
      img.crossOrigin = 'anonymous';
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          const nw = img.naturalWidth || img.width;
          const nh = img.naturalHeight || img.height;
          if (!(nw > 0 && nh > 0)) return resolve(null);

          const w = Math.min(WORK_W, nw);
          const h = Math.max(1, Math.round(w * nh / nw));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;

          const edge = Math.max(MIN_EDGE_PX, Math.round(Math.min(w, h) * EDGE_FRACTION));
          const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
          for (let y = 0; y < h; y++) {
            const vertical = y < edge || y >= h - edge;
            for (let x = 0; x < w; x++) {
              if (!vertical && x >= edge && x < w - edge) continue;
              const i = (y * w + x) * 4;
              // Прозорий край — це не колір тла, а відсутність картинки.
              if (data[i + 3] < 128) continue;
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const key = ((r / BUCKET) | 0) * 4096 + ((g / BUCKET) | 0) * 64 + ((b / BUCKET) | 0);
              const acc = counts.get(key);
              if (acc) { acc.n++; acc.r += r; acc.g += g; acc.b += b; }
              else counts.set(key, { n: 1, r, g, b });
            }
          }

          let best: { n: number; r: number; g: number; b: number } | null = null;
          counts.forEach(acc => { if (!best || acc.n > best.n) best = acc; });
          if (!best) return resolve(null);
          const top = best as { n: number; r: number; g: number; b: number };
          resolve('#' + hex2(top.r / top.n) + hex2(top.g / top.n) + hex2(top.b / top.n));
        } catch { resolve(null); }
      };
      img.src = url;
    } catch { resolve(null); }
  });
}
