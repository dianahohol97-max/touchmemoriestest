/**
 * Shared poster drawing — used for BOTH the on-screen preview and the
 * print-ready 300 DPI export, so the printed poster is pixel-identical to what
 * the customer designed.
 *
 * Previously the export took the small on-screen canvas and upscaled it 3.125×
 * (exportCanvasAt300DPI), which softened photos. Instead we now redraw the whole
 * poster from the FULL-resolution originals straight onto a canvas sized at the
 * physical print pixels (cm × 300 DPI). All the layout maths is expressed in
 * terms of W/H, so calling it at print size scales everything proportionally.
 */

import { FONTS_IN_PACK } from '@/lib/editor/font-scripts';

export type PosterPhoto = {
  id: string;
  photoUrl: string;
  cropX: number;
  cropY: number;
  zoom: number;
  rotation?: number;
};

export type PosterTextBlock = {
  text: string;
  x: number;            // 0–100 % of width
  y: number;            // 0–100 % of height
  fontSize: number;
  fontFamily: string;
  color: string;
  align: CanvasTextAlign;
  bold?: boolean;
  italic?: boolean;
  letterSpacing: number;
};

export type PosterSlot = {
  x: number; y: number; w: number; h: number;
  shape?: 'rect' | 'circle' | 'heart';
};

export type PosterDrawConfig = {
  bgColor: string;
  padding: number;
  frameStyle: string;
  frameColor: string;
  photos: PosterPhoto[];
  textBlocks: PosterTextBlock[];
};

/**
 * Родина, якою набрано напис на постері, і те, чому вона не намалюється.
 *
 * Ті самі два випадки, що розрізняє сторож друкованого аркуша
 * (`lib/print/font-audit.ts`), і розрізняються вони з тієї самої причини.
 *
 *   `not-in-pack`  — родини немає в нашому наборі взагалі. Так стоїть Georgia,
 *                    системний шрифт Windows: на машині, де вона є, напис
 *                    вийде саме нею, а на будь-якій іншій — системною
 *                    зарубкою, і повтор цього не лікує ніколи.
 *   `not-loaded`   — родина наша, але грань, яка покриває ЦІ символи, у
 *                    документі не завантажилась. Або не доїхала таблиця
 *                    стилів, або не доїхав файл підмножини. Саме це лікує
 *                    повтор, і саме це досі ставалося мовчки.
 */
export type PosterFontTrouble = {
  family: string;
  reason: 'not-in-pack' | 'not-loaded';
  /** Символи, набрані цією родиною — по них і питали грань. */
  sample: string;
};

/** Назва родини так, як її порівнювати: перша в стеку, без лапок. */
function familyName(family: string | null | undefined): string {
  return String(family ?? '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Дочекатися шрифтів, якими справді набрано цей постер, і сказати, чого бракує.
 *
 * НАВІЩО ОКРЕМА ФУНКЦІЯ, А НЕ `document.fonts.ready`. Саме `ready` тут і стояла,
 * і вона означає не «шрифти на місці», а «завантаження, яке йшло, скінчилося»:
 * на сторінці, де жодна з цих родин не набрана в DOM, завантаження не йде
 * ніяке, і `ready` резолвиться миттєво з порожнім набором. Так і виходив
 * єдиний друкарський файл TM-001090 — його зібрала кнопка «Зібрати постер з
 * дизайну» на сторінці адмінки, яка таблиці шрифтів конструктора не підключала
 * взагалі, тож Playfair Display із макета намалювалася системною зарубкою.
 * `document.fonts.check()` цього теж не ловить: для будь-якої родини вона
 * відповідає `true`, бо фолбек «завантажений».
 *
 * Що ловить ця функція. `document.fonts.load(spec, text)` віддає САМЕ ті грані,
 * чий `unicode-range` покриває передані символи: порожній масив означає, що
 * родини в документі немає жодної, а грань зі статусом не `loaded` означає, що
 * файл підмножини не приїхав. Питаємо по символах, а не по родині, з тієї самої
 * причини, з якої так робить сторож на Railway — там уже було, що кирилична
 * підмножина впала при живій латинській, і аркуш вийшов наполовину авторським.
 */
export async function loadPosterFonts(textBlocks: PosterTextBlock[]): Promise<PosterFontTrouble[]> {
  const fonts: any = (typeof document !== 'undefined') ? (document as any).fonts : null;
  if (!fonts?.load) return [];

  // Родина → усі символи, набрані нею, і всі накреслення, які реально малюються.
  const byFamily = new Map<string, { sample: Set<string>; specs: Set<string> }>();
  for (const tb of textBlocks || []) {
    const family = familyName(tb?.fontFamily);
    const text = String(tb?.text ?? '');
    if (!family || !text.trim()) continue;
    if (!byFamily.has(family)) byFamily.set(family, { sample: new Set(), specs: new Set() });
    const entry = byFamily.get(family)!;
    for (const ch of text) entry.sample.add(ch);
    // Розмір у специфікації не має значення — грань добирається за родиною,
    // вагою і стилем, — але шорткат без нього не парситься.
    entry.specs.add(`${tb.italic ? 'italic ' : ''}${tb.bold ? 'bold ' : ''}16px "${family}"`);
  }

  const troubles: PosterFontTrouble[] = [];
  for (const [family, { sample, specs }] of byFamily) {
    const text = [...sample].join('');
    let declared = 0;
    let loaded = 0;
    for (const spec of specs) {
      let faces: any[] = [];
      try {
        faces = await fonts.load(spec, text);
      } catch {
        // Невалідна специфікація або відмова браузера — рахуємо як «немає
        // грані»: мовчки намалювати фолбеком гірше, ніж сказати про це.
        faces = [];
      }
      declared += faces.length;
      loaded += faces.filter((f: any) => f?.status === 'loaded').length;
    }
    if (declared === 0) {
      // Родини в документі немає. Чи то вона поза нашим набором, чи то не
      // доїхала наша таблиця стилів — відповідь у переліку файлів пакета.
      troubles.push({ family, reason: FONTS_IN_PACK.has(family) ? 'not-loaded' : 'not-in-pack', sample: text });
    } else if (loaded === 0) {
      troubles.push({ family, reason: 'not-loaded', sample: text });
    }
  }
  return troubles;
}

/** Рядок для людини — однаковий в адмінці і в конструкторі, щоб питання ставилося раз. */
export function posterFontTroubleLine(troubles: PosterFontTrouble[]): string {
  return troubles
    .map(t => t.reason === 'not-in-pack'
      ? `шрифт ${t.family} не входить у наш набір — напис намалюється системним`
      : `шрифт ${t.family} не завантажився — напис намалюється системним`)
    .join('; ');
}

function applyShapeClip(ctx: CanvasRenderingContext2D, slot: PosterSlot) {
  ctx.beginPath();
  if (slot.shape === 'circle') {
    const cx = slot.x + slot.w / 2, cy = slot.y + slot.h / 2;
    const r = Math.min(slot.w, slot.h) / 2;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (slot.shape === 'heart') {
    const cx = slot.x + slot.w / 2;
    const cy = slot.y + slot.h / 2 + slot.h * 0.05;
    const scaleX = slot.w * 0.5;
    const scaleY = slot.h * 0.5 * 0.88;
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = cx + scaleX * (16 * Math.pow(Math.sin(t), 3)) / 16;
      const y = cy - scaleY * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
  }
}

// Load an image from a URL (objectURL of the full original, or a remote URL).
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Draw the full poster onto ctx at logical size W×H. `placeholders` controls
 * whether empty slots get the dashed on-screen placeholder (preview = true,
 * export = false so empty slots stay clean/transparent on the print file).
 */
export async function drawPosterCanvas(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  config: PosterDrawConfig,
  slots: PosterSlot[],
  opts: { placeholders?: boolean; frameInsetX?: number; frameInsetY?: number } = {},
) {
  const placeholders = opts.placeholders ?? false;
  // Frame inset in px. The print shop trims 5–7 mm from the edge, so a frame
  // drawn AT the edge came back cut/asymmetric. Diana's rule: the frame sits
  // at least 1 cm from the paper edge — callers convert 1 cm to px for their
  // canvas size and pass it here (0 keeps the legacy edge-tight look).
  const fix = Math.max(0, Math.round(opts.frameInsetX ?? 0));
  const fiy = Math.max(0, Math.round(opts.frameInsetY ?? 0));

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = config.bgColor;
  ctx.fillRect(0, 0, W, H);

  // Photos — load all originals, then draw in slot order.
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const photo = config.photos[i];
    if (!photo?.photoUrl) {
      if (placeholders) {
        ctx.save();
        applyShapeClip(ctx, slot);
        ctx.fillStyle = 'rgba(200,210,255,0.25)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,130,220,0.4)';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      continue;
    }
    const img = await loadImage(photo.photoUrl);
    if (!img) continue;
    ctx.save();
    applyShapeClip(ctx, slot);
    ctx.clip();
    const zoom = photo.zoom || 1;
    const imgAspect = img.width / img.height;
    const slotAspect = slot.w / slot.h;
    let dw: number, dh: number;
    if (imgAspect > slotAspect) {
      dh = slot.h * zoom;
      dw = dh * imgAspect;
    } else {
      dw = slot.w * zoom;
      dh = dw / imgAspect;
    }
    const dx = slot.x + (slot.w - dw) * (photo.cropX / 100);
    const dy = slot.y + (slot.h - dh) * (photo.cropY / 100);
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  // Frame — widths scale to canvas width via the same `unit` reference as the
  // preview, so Товста/Подвійна/Округла look identical at any resolution.
  // The whole frame is shifted inward by (fix, fiy) so it survives trimming.
  if (config.frameStyle !== 'none') {
    ctx.save();
    const unit = W / 400;
    const fw = config.frameStyle === 'thick' ? Math.round(10 * unit)
             : config.frameStyle === 'double' ? Math.round(3 * unit)
             : Math.round(4 * unit);
    ctx.strokeStyle = config.frameColor;
    ctx.lineWidth = fw;
    if (config.frameStyle === 'rounded') {
      const r = Math.round(16 * unit);
      ctx.beginPath(); ctx.roundRect(fix + fw / 2, fiy + fw / 2, W - 2 * fix - fw, H - 2 * fiy - fw, r); ctx.stroke();
    } else {
      ctx.strokeRect(fix + fw / 2, fiy + fw / 2, W - 2 * fix - fw, H - 2 * fiy - fw);
    }
    if (config.frameStyle === 'double') {
      const gap = Math.round(7 * unit);
      ctx.lineWidth = Math.max(1, Math.round(1.5 * unit));
      ctx.strokeRect(fix + fw + gap, fiy + fw + gap, W - 2 * (fix + fw + gap), H - 2 * (fiy + fw + gap));
    }
    ctx.restore();
  }

  // Text blocks — font size scales by W/600 exactly like the preview.
  for (const tb of config.textBlocks) {
    ctx.save();
    const fs = Math.round(tb.fontSize * (W / 600));
    ctx.font = `${tb.italic ? 'italic ' : ''}${tb.bold ? 'bold ' : ''}${fs}px '${tb.fontFamily}', sans-serif`;
    ctx.fillStyle = tb.color;
    ctx.textAlign = tb.align;
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = `${tb.letterSpacing}px`;
    const tx = (tb.x / 100) * W;
    const ty = (tb.y / 100) * H;
    ctx.fillText(tb.text, tx, ty);
    ctx.restore();
  }
}

/**
 * Render the poster to a print-ready JPEG blob at the given physical size.
 * widthCm/heightCm are the poster's real dimensions; we draw at cm × 300 DPI
 * straight from the full-resolution originals (no upscaling).
 */
export async function renderPosterPrintBlob(
  config: PosterDrawConfig,
  widthCm: number,
  heightCm: number,
  getSlots: (W: number, H: number, pad: number) => PosterSlot[],
  previewW: number = 480,
  opts: {
    /** Що саме не намалюється — викликається завжди, навіть коли файл усе одно збирається. */
    onFontTrouble?: (troubles: PosterFontTrouble[]) => void;
    /**
     * Відмовитись збирати файл, коли НАША родина не завантажилась.
     *
     * Вмикається там, де людина поруч і може повторити, — у кнопці «Зібрати
     * постер з дизайну» в адмінці. У клієнтському конструкторі лишається
     * вимкненим свідомо: там растр знімається на тій самій машині, що
     * показувала прев'ю, тож клієнт і друкарня бачать одне й те саме, а
     * відмова коштувала б замовлення. Родина поза набором (Georgia) не
     * зупиняє нічого ніде — повтор її не лікує.
     */
    refuseOnUnloadedFont?: boolean;
  } = {},
): Promise<Blob | null> {
  const DPI = 300;
  const cmToPx = (cm: number) => Math.round((cm / 2.54) * DPI);
  const W = cmToPx(widthCm);
  const H = cmToPx(heightCm);
  // The preview padding is in screen px against previewW. Scale it to the print
  // width so the margins on paper match exactly what the customer designed.
  const scaledPad = Math.round(config.padding * (W / previewW));
  const slots = getSlots(W, H, scaledPad);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Дочекатися САМЕ тих граней, якими набрано цей постер. Тут стояла
  // `document.fonts.ready`, і вона мовчала: див. коментар до loadPosterFonts.
  const troubles = await loadPosterFonts(config.textBlocks);
  if (troubles.length) {
    console.warn('[poster] шрифти макета:', posterFontTroubleLine(troubles));
    opts.onFontTrouble?.(troubles);
    if (opts.refuseOnUnloadedFont && troubles.some(t => t.reason === 'not-loaded')) {
      // Повтор це лікує, тож краще зупинитись, ніж покласти в друк файл із
      // підставленим накресленням: такий файл виглядає справним до самої
      // друкарні. Родина поза набором сюди не потрапляє навмисно.
      throw new Error(posterFontTroubleLine(troubles.filter(t => t.reason === 'not-loaded')) + ' — спробуйте ще раз');
    }
  }

  // Frame inset from the paper edge: 0.7 cm trim zone + 1 cm clearance от неї
  // (Diana: «хоча б 1 см від безпечної зони») = 1.7 cm of the physical
  // width/height, converted to px.
  const FRAME_INSET_CM = 1.7;
  const frameInsetX = W * (FRAME_INSET_CM / widthCm);
  const frameInsetY = H * (FRAME_INSET_CM / heightCm);
  await drawPosterCanvas(ctx, W, H, config, slots, { placeholders: false, frameInsetX, frameInsetY });

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
  });
}
