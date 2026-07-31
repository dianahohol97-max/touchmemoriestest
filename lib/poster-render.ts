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

  // Make sure fonts are ready so text isn't drawn in a fallback face.
  try { await (document as any).fonts?.ready; } catch {}

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
