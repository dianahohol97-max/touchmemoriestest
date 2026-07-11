'use client';
import { haptic, startPointerDrag } from '@/lib/hooks/useMobileInteractions';
import { useState, useRef, useEffect } from 'react';
import { useT } from '@/lib/i18n/context';
import { ImageIcon, Move } from 'lucide-react';

export type CoverMaterial = 'velour' | 'leatherette' | 'fabric' | 'printed';
export type DecoType = 'none' | 'acryl' | 'photovstavka' | 'metal' | 'flex' | 'graviruvannya';

// Leatherette colours — synced with the cover_colors DB table
// (Ш-01…Ш-25 + Ш-28). Same set as ProductOptionsSelector
// LEATHERETTE_COLORS_WB and BookConstructorConfig LEATHERETTE_BOOK_COLORS;
// all three must stay in sync when the DB list changes.
export const LEATHERETTE_COLORS: Record<string, string> = {
  'Білий':'#F5F5F0','Бежевий':'#D9C8B0','Пісочний':'#D4A76A','Рудий':'#C8844E',
  'Бордо темний':'#7A2838','Золотистий':'#C4A83A','Теракотовий':'#C25A3C','Жовтий':'#F0B820',
  'Рожевий ніжний':'#E8B4B8','Фуксія':'#D84080','Червоний насичений':'#A01030',
  'Коричневий':'#8E5038','Вишневий':'#7A2020','Марсала':'#6E2840','Графітовий темний':'#3A3038',
  'Фіолетовий яскравий':'#8030A0','Фіолетовий темний':'#502060','Бірюзовий':'#4E9090',
  'Оливковий':'#A0A030','Темно-зелений':'#1E3028','Бірюзовий яскравий':'#00B0B0',
  'Блакитний яскравий':'#0088D0','Темно-синій':'#1A2040','Чорний':'#1A1A1A','Персиковий':'#E8A8A0',
};
export const FABRIC_COLORS: Record<string, string> = {
  'Бежевий/пісочний':'#C4AA88','Теракотовий/цегляний':'#A04838','Фуксія/пурпурний':'#B838A0',
  'Фіолетовий темний':'#582050','Марсала/бордо':'#602838','Коричневий':'#6E4830',
  'Сірий/графітовий':'#586058','Червоний яскравий':'#C02030','Оливковий/зелений':'#A0A020',
};

// Decoration variants per size
// Velour colors — canonical, mirrors cover_colors DB rows (В-01…В-15).
// Names + hex match the DB exactly. ProductOptionsSelector.VELOUR_COLORS
// and BookConstructorConfig.VELOUR_COLORS use the same set; keep all
// three in sync when adding/changing a velour color.
// TODO: extract to lib/cover-colors.ts as single source of truth.
export const VELOUR_COLORS: Record<string, string> = {
  'Молочний':'#F0EAD6',       'Бежевий':'#D9C8B0',        'Таупе':'#7C7167',
  'Рожевий':'#E8B4B8',        'Бордо':'#7A2838',          'Сірий перловий':'#9A9898',
  'Лаванда':'#B8A8C8',        'Синій':'#1A2040',          'Графітовий':'#3A3038',
  'Бірюзовий':'#1A9090',      'Фіолетовий':'#8C2D80',     'Блакитно-сірий':'#607080',
  'Темно-зелений':'#1A6A53',  'Жовтий':'#D4A020',         'Чорний':'#1A1A1A',
};

export const ACRYLIC_VARIANTS: Record<string, string[]> = {
  '20x20':['100×100 мм','Ø145 мм'],
  '25x25':['100×100 мм','Ø145 мм'],
  '20x30':['100×100 мм','Ø145 мм'],
  '30x20':['100×100 мм','Ø145 мм'],
  '30x30':['100×100 мм','Ø145 мм','290×100 мм','215×290 мм'],
};
export const PHOTO_INSERT_VARIANTS: Record<string, string[]> = {
  '20x20':['100×100 мм'],'25x25':['100×100 мм'],
  '20x30':['100×100 мм'],'30x20':['100×100 мм'],
  '30x30':['197×197 мм','100×100 мм'],
};
export const METAL_VARIANTS: Record<string, string[]> = {
  '20x20':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '25x25':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '20x30':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '30x20':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний','250×70 золотий','250×70 срібний'],
  '30x30':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний','250×70 золотий','250×70 срібний'],
};
// Flex colors
export const FLEX_COLORS = [
  { label:'Золотий', value:'gold', color:'#D4AF37' },
  { label:'Срібний', value:'silver', color:'#C0C0C0' },
  { label:'Білий',   value:'white', color:'#FFFFFF' },
  { label:'Чорний',  value:'black', color:'#1A1A1A' },
];
// Metal only gold+silver
export const METAL_COLORS = [
  { label:'Золотий', value:'gold',   color:'#D4AF37' },
  { label:'Срібний', value:'silver', color:'#C0C0C0' },
]; // Note: no black metal

function parseVariantDims(variant: string): { w: number; h: number; round: boolean } {
  if (variant.startsWith('Ø')) {
    const d = parseFloat(variant.replace('Ø','').replace(/\s*мм.*/,''));
    return { w: d, h: d, round: true };
  }
  const m = variant.match(/(\d+)[×x](\d+)/);
  if (m) return { w: parseInt(m[1]), h: parseInt(m[2]), round: false };
  return { w: 100, h: 100, round: false };
}

function darkenHex(hex: string, amount=45): string {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0,(n>>16)-amount), g = Math.max(0,((n>>8)&0xFF)-amount), b = Math.max(0,(n&0xFF)-amount);
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

export interface ExtraTextBlock {
  id: string; text: string; x: number; y: number;
  fontFamily: string; fontSize: number; color: string;
}
export interface CoverConfig {
  coverMaterial: CoverMaterial;
  coverColorName: string;
  decoType: DecoType;
  decoVariant: string;
  decoColor: string;
  photoId: string | null;
  photoCropX?: number; // 0-100, default 50
  photoCropY?: number; // 0-100, default 50
  photoZoom?: number;  // 0.5-4, default 1
  decoText: string;
  textX: number; textY: number;
  textFontFamily: string;
  textFontSize: number;
  extraTexts?: ExtraTextBlock[];
  // Printed cover
  printedPhotoSlot?: { x: number; y: number; w: number; h: number; shape: 'rect'|'circle'|'rounded'|'heart' } | null;
  printedPhotoSlots?: { x: number; y: number; w: number; h: number; shape: 'rect'|'circle'|'rounded'|'heart'; photoId?: string|null; cropX?: number; cropY?: number; zoom?: number }[];
  printedTextBlocks?: { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; bold: boolean }[];
  printedOverlay?: { type: 'none'|'color'|'gradient'; color: string; opacity: number; gradient: string };
  printedBgColor?: string;
  // Ready-made full-cover background image (travel book ready covers).
  printedBgImage?: string | null;
  // Free, draggable + resizable photos placed anywhere on the cover (works on
  // any material — printed or soft). Independent of the template photo slots.
  // x/y/w/h are percentages of the cover (0–100) so they scale identically in
  // the editor, the preview modal and the print export.
  coverPhotos?: { id: string; photoId: string | null; x: number; y: number; w: number; h: number; cropX?: number; cropY?: number; zoom?: number; rotation?: number; shape?: 'rect'|'rounded'|'circle' }[];
}

interface CoverEditorProps {
  canvasW: number; canvasH: number;
  sizeValue: string;
  config: CoverConfig;
  photos: { id: string; preview: string }[];
  onChange: (patch: Partial<CoverConfig>) => void;
  hidePhotoSlot?: boolean;
}

/**
 * Renders cover-template text and auto-shrinks the font so the text fits on a
 * single line within `maxWidthPx`. Cover templates store an absolute fontSize
 * (e.g. WEDDING = 56) tuned for a wide reference cover; on a narrower product
 * (travelbook 20x30) that size overflows and the word breaks ("WED" / "DING").
 * We measure the natural single-line width and scale down to fit, keeping the
 * span contentEditable and draggable exactly as before.
 */
function FitText({
  tb, maxWidthPx, onCommit, onPointerDownText, onClickText,
}: {
  tb: { id: string; text: string; fontSize: number; fontFamily: string; color: string; bold: boolean };
  maxWidthPx: number;
  onCommit: (text: string) => void;
  onPointerDownText: (e: React.PointerEvent) => void;
  onClickText: (e: React.MouseEvent) => void;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [fitSize, setFitSize] = useState(tb.fontSize);

  useEffect(() => {
    const el = spanRef.current;
    if (!el || maxWidthPx <= 0) return;
    // Measure at the template's intended size with no wrapping, then scale
    // down proportionally if the single-line width exceeds the safe box.
    const prevWhiteSpace = el.style.whiteSpace;
    const prevFont = el.style.fontSize;
    el.style.whiteSpace = 'nowrap';
    el.style.fontSize = tb.fontSize + 'px';
    const natural = el.scrollWidth;
    let next = tb.fontSize;
    if (natural > maxWidthPx && natural > 0) {
      next = Math.max(8, Math.floor(tb.fontSize * (maxWidthPx / natural)));
    }
    el.style.whiteSpace = prevWhiteSpace;
    el.style.fontSize = prevFont;
    setFitSize(next);
  }, [tb.text, tb.fontSize, tb.fontFamily, tb.bold, maxWidthPx]);

  return (
    <span
      ref={spanRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={e => onCommit(e.currentTarget.textContent || '')}
      onPointerDown={onPointerDownText}
      onClick={onClickText}
      style={{
        color: tb.color || '#fff', fontSize: fitSize + 'px', fontFamily: tb.fontFamily + ',serif',
        fontWeight: tb.bold ? 700 : 400, outline: 'none', cursor: 'move', display: 'block',
        whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.1,
        textShadow: '0 1px 3px rgba(0,0,0,0.5)', minWidth: '40px', touchAction: 'none',
      }}
    >
      {tb.text}
    </span>
  );
}

/**
 * Wraps a printed-cover text block and clamps its on-screen position so the
 * block can't overflow the canvas. The template author specifies the CENTRE
 * of the block via `tb.x` / `tb.y` (percent), and we render with
 * `transform: translate(-50%, -50%)` to honour that — but the resulting
 * left/right edges of the block depend on its actual rendered width, which
 * we only know after layout.
 *
 * After the first render, measure the block's bounding box, compare it to
 * the canvas, and apply a corrective translateX/Y so the block stays
 * inside `[safeInsetPx, canvasW - safeInsetPx]`. This rescues templates
 * like "Birthday Special" where `x: 25` was supposed to mean "left-leaning"
 * but the text was so wide that the left half of the block ended up
 * negative-positioned (off-canvas).
 *
 * The clamp is a soft correction — if `tb.x` is already safe, the offset
 * is 0 and nothing moves. Drag still works because clamp only nudges
 * the FINAL screen position; the saved `tb.x` (the template intent) is
 * untouched.
 */
function ClampedTextWrapper({
  tb, safeX, safeY, canvasW, canvasH, maxWidthPx, children, onFontSizeChange,
}: {
  tb: { id: string; x: number; y: number };
  safeX: number; safeY: number;
  canvasW: number; canvasH: number;
  maxWidthPx: number;
  children: React.ReactNode;
  onFontSizeChange?: (delta: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [toolbarAbove, setToolbarAbove] = useState(false);
  const safeInsetPx = Math.max(8, canvasW * 0.06);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || canvasW <= 0) return;
    const measure = () => {
      if (!el.parentElement) return;
      const parentRect = el.parentElement.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const left = rect.left - parentRect.left;
      const right = rect.right - parentRect.left;
      const top = rect.top - parentRect.top;
      const bottom = rect.bottom - parentRect.top;
      let dx = 0, dy = 0;
      if (left < safeInsetPx) dx = safeInsetPx - left;
      else if (right > canvasW - safeInsetPx) dx = (canvasW - safeInsetPx) - right;
      if (top < safeInsetPx) dy = safeInsetPx - top;
      else if (bottom > canvasH - safeInsetPx) dy = (canvasH - safeInsetPx) - bottom;
      setOffset(prev => (prev.x === dx && prev.y === dy) ? prev : { x: dx, y: dy });
      // Flip toolbar above when element bottom is in the lower 30% of canvas
      setToolbarAbove(bottom > canvasH * 0.72);
    };
    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [tb.x, tb.y, canvasW, canvasH, maxWidthPx, safeInsetPx]);

  // Resize handle: drag vertically to change font size
  const startResizeDrag = (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    const startY = e.clientY;
    let accumulated = 0;
    const move = (pe: PointerEvent) => {
      const dy = startY - pe.clientY; // drag up = bigger
      const newAcc = Math.round(dy / 4); // 4px per 1px font size
      const delta = newAcc - accumulated;
      if (delta !== 0 && onFontSizeChange) {
        onFontSizeChange(delta);
        accumulated = newAcc;
      }
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch {}
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const handleStyle: React.CSSProperties = {
    position: 'absolute', bottom: -8, width: 16, height: 16,
    borderRadius: '50%', background: '#fff', border: '2px solid #1e2d7d',
    cursor: 'ns-resize', zIndex: 20, touchAction: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
  };

  return (
    <div ref={wrapRef}
      // The dashed frame is editor-only chrome. Without this attribute it bakes
      // into the printed cover — html2canvas can't drop a `border` via
      // ignoreElements (that would drop the text too), so the export's onclone
      // strips the border from every [data-inscription-frame] node in the clone.
      // The soft-cover inscription frame already carried this; the printed-cover
      // text wrapper did not, which is why the frame printed on the cover.
      data-inscription-frame="true"
      style={{
        position: 'absolute',
        left: `${safeX}%`,
        top: `${safeY}%`,
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
        zIndex: 12,
        padding: '2px 6px',
        border: '1px dashed rgba(255,255,255,0.5)',
        borderRadius: 3,
        touchAction: 'manipulation',
        maxWidth: `${canvasW * 0.84}px`,
      }}
    >
      {children}
      {/* Font-size buttons — flip above when text is in lower 30% of canvas */}
      {onFontSizeChange && (
        <div
          data-html2canvas-ignore="true"
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            ...(toolbarAbove ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 3,
            background: 'rgba(30,45,125,0.88)', borderRadius: 20,
            padding: '3px 8px', zIndex: 30, whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          }}
        >
          <button
            onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onFontSizeChange(-2); }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, padding: '0 4px', lineHeight: 1 }}
            title="Зменшити шрифт"
          >A−</button>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8, minWidth: 20, textAlign: 'center' }}>
            {tb && 'fontSize' in tb ? (tb as any).fontSize : ''}
          </span>
          <button
            onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onFontSizeChange(2); }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, padding: '0 4px', lineHeight: 1 }}
            title="Збільшити шрифт"
          >A+</button>
        </div>
      )}
    </div>
  );
}

export function CoverEditor({ canvasW, canvasH, sizeValue, config, photos, onChange, hidePhotoSlot = false }: CoverEditorProps) {
  const t = useT();
  const [dragOver, setDragOver] = useState(false);
  // Snap guide lines — {x?: number, y?: number} in % (0-100), shown while dragging
  const [snapLines, setSnapLines] = useState<{ x?: number[]; y?: number[] }>({});

  // Snap threshold in % units
  const SNAP_THRESHOLD = 2.5;
  // Canvas snap points: edges, center, thirds
  const SNAP_X = [0, 25, 50, 75, 100];
  const SNAP_Y = [0, 25, 50, 75, 100];

  // Given a value and snap points, return snapped value + which lines to show
  const snapVal = (val: number, points: number[]): { snapped: number; lines: number[] } => {
    let best = val, lines: number[] = [];
    for (const p of points) {
      if (Math.abs(val - p) < SNAP_THRESHOLD) {
        if (Math.abs(val - p) <= Math.abs(best - p)) best = p;
        lines.push(p);
      }
    }
    return { snapped: best, lines };
  };
  // Load Cyrillic calligraphic fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Marck+Script&family=Caveat&family=Philosopher&family=Comfortaa&family=Lobster&family=Dancing+Script&family=Great+Vibes&family=Pinyon+Script&family=Sacramento&family=Alex+Brush&family=Italianno&family=Pacifico&family=Playfair+Display&family=Cormorant+Garamond&family=Cinzel&family=EB+Garamond&family=Raleway&family=Josefin+Sans&family=Bebas+Neue&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);
  const dragRef = useRef<{startX:number;startY:number;startTX:number;startTY:number}|null>(null);

  const isSoft = config.coverMaterial !== 'printed';

  // Printed cover: photo slot drag/resize
  const startSlotDrag = (e: React.PointerEvent, type: string) => {
    e.stopPropagation(); e.preventDefault();
    haptic.light();
    const slot = config.printedPhotoSlot ?? { x:0, y:0, w:100, h:100, shape:'rect' as const };
    const orig = { ...slot };
    startPointerDrag(e, (dx, dy) => {
      const ddx = dx/canvasW*100, ddy = dy/canvasH*100;
      if (type==='move') {
        const rawX = orig.x + ddx, rawY = orig.y + ddy;
        // Snap: check center of slot
        const cxRaw = rawX + orig.w/2, cyRaw = rawY + orig.h/2;
        const { snapped: cxSnap, lines: lx } = snapVal(cxRaw, SNAP_X);
        const { snapped: cySnap, lines: ly } = snapVal(cyRaw, SNAP_Y);
        // Also snap left/right edges
        const { lines: lxL } = snapVal(rawX, SNAP_X);
        const { lines: lxR } = snapVal(rawX + orig.w, SNAP_X);
        const { lines: lyT } = snapVal(rawY, SNAP_Y);
        const { lines: lyB } = snapVal(rawY + orig.h, SNAP_Y);
        const allLx = [...new Set([...lx, ...lxL, ...lxR])];
        const allLy = [...new Set([...ly, ...lyT, ...lyB])];
        setSnapLines({ x: allLx.length ? allLx : undefined, y: allLy.length ? allLy : undefined });
        const newX = cxSnap !== cxRaw ? cxSnap - orig.w/2 : rawX;
        const newY = cySnap !== cyRaw ? cySnap - orig.h/2 : rawY;
        onChange({ printedPhotoSlot: {...orig, x:Math.max(0,Math.min(100-orig.w,newX)), y:Math.max(0,Math.min(100-orig.h,newY)) }});
      } else {
        // Resize: keep the OPPOSITE corner anchored and clamp the slot fully
        // inside the canvas. Previously x/y/w/h were unclamped, so dragging a
        // corner could push the slot past the page edge and the photo would
        // vanish from view mid-drag.
        const MIN = 10;
        const right = orig.x + orig.w;   // fixed edge for nw / sw
        const bottom = orig.y + orig.h;  // fixed edge for nw / ne
        if (type==='se') {
          const w = Math.max(MIN, Math.min(100 - orig.x, orig.w + ddx));
          const h = Math.max(MIN, Math.min(100 - orig.y, orig.h + ddy));
          onChange({ printedPhotoSlot: {...orig, w, h }});
        } else if (type==='sw') {
          const x = Math.max(0, Math.min(right - MIN, orig.x + ddx));
          const h = Math.max(MIN, Math.min(100 - orig.y, orig.h + ddy));
          onChange({ printedPhotoSlot: {...orig, x, w: right - x, h }});
        } else if (type==='ne') {
          const y = Math.max(0, Math.min(bottom - MIN, orig.y + ddy));
          const w = Math.max(MIN, Math.min(100 - orig.x, orig.w + ddx));
          onChange({ printedPhotoSlot: {...orig, y, w, h: bottom - y }});
        } else if (type==='nw') {
          const x = Math.max(0, Math.min(right - MIN, orig.x + ddx));
          const y = Math.max(0, Math.min(bottom - MIN, orig.y + ddy));
          onChange({ printedPhotoSlot: {...orig, x, y, w: right - x, h: bottom - y }});
        }
      }
    }, () => setSnapLines({})); // clear on release
  };

  // Printed cover: text block drag via Pointer Events
  const startTextDrag = (e: React.PointerEvent, id: string, tx: number, ty: number) => {
    // Don't preventDefault — needed for contentEditable focus on click
    e.stopPropagation();
    haptic.light();
    const texts = config.printedTextBlocks ?? [];
    let moved = false;
    startPointerDrag(e, (dx, dy) => {
      if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
      if (!moved) return;
      const rawX = tx + dx/canvasW*100;
      const rawY = ty + dy/canvasH*100;
      // Snap text center to guide lines
      const { snapped: snX, lines: lx } = snapVal(rawX, SNAP_X);
      const { snapped: snY, lines: ly } = snapVal(rawY, SNAP_Y);
      setSnapLines({ x: lx.length ? lx : undefined, y: ly.length ? ly : undefined });
      onChange({
        printedTextBlocks: texts.map(t => t.id === id
          ? { ...t, x: Math.max(8,Math.min(92, snX)), y: Math.max(8,Math.min(92, snY)) }
          : t)
      });
    }, () => setSnapLines({})); // clear on release
  };

  const bgColor = (() => {
    if (!isSoft) return config.printedBgColor || '#fff';
    const name = config.coverColorName;
    if (config.coverMaterial === 'leatherette') return LEATHERETTE_COLORS[name] ?? '#D9C8B0';
    if (config.coverMaterial === 'fabric') return FABRIC_COLORS[name] ?? '#C4AA88';
    // velour
    return VELOUR_COLORS[name] ?? LEATHERETTE_COLORS[name] ?? '#D9C8B0';
  })();

  const texture = config.coverMaterial === 'leatherette'
    ? 'repeating-linear-gradient(45deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 7px),repeating-linear-gradient(-45deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 7px)'
    : config.coverMaterial === 'fabric'
    ? 'repeating-linear-gradient(90deg,rgba(255,255,255,0.06) 0px,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 4px),repeating-linear-gradient(0deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 4px)'
    : 'none';

  // Cover width in mm. Sizes are stored in cm (e.g. "25x25" → 250 mm). Guard
  // against a malformed or mm-form size (e.g. "250x250") that would otherwise
  // make `scale` ~10× too small and shrink the decoration plate to a dot.
  let pageWidthCm = parseInt(sizeValue.split('x')[0]);
  if (!Number.isFinite(pageWidthCm) || pageWidthCm < 15 || pageWidthCm > 40) pageWidthCm = 20;
  const pageWidthMM = pageWidthCm * 10;
  const scale = canvasW / pageWidthMM;

  const dims = parseVariantDims(config.decoVariant || '100×100 мм');
  let boxW = dims.w * scale;
  let boxH = dims.h * scale;
  // Defensive clamp: a decoration plate is always a meaningful fraction of the
  // cover — never a dot, never overflowing the cover — even if size/variant data
  // is off. Scale both sides by the same factor to keep the aspect ratio.
  {
    const minW = canvasW * 0.12, maxW = canvasW * 0.96, maxH = canvasH * 0.96;
    let k = 1;
    if (boxW > maxW || boxH > maxH) k = Math.min(maxW / boxW, maxH / boxH);
    else if (boxW > 0 && boxW < minW) k = minW / boxW;
    boxW *= k; boxH *= k;
  }
  const boxL = (canvasW - boxW) / 2;
  const boxT = (canvasH - boxH) / 2;

  const photo = photos.find(p => p.id === config.photoId) ?? null;

  // Whether to render the front-cover photo slot. hidePhotoSlot (hard-cover
  // journals) was meant to hide the empty "drag a photo" placeholder over the
  // chosen background colour — but it also hid an ACTUAL photo placed via a
  // cover template or Магічна збірка, so the cover looked blank in the canvas
  // while the thumbnail showed it. Render the slot whenever it's not hidden OR
  // a photo is present: the placeholder stays hidden on empty hard-journal
  // covers, but a real cover photo always shows.
  const renderPrintedPhotoSlot = !isSoft && (!hidePhotoSlot || !!photo) && config.printedPhotoSlot !== null;

  // Flex/metal color resolving
  const flexColorVal = config.decoColor || 'gold';
  const flexHex = FLEX_COLORS.find(c=>c.value===flexColorVal)?.color || '#D4AF37';
  const metalGrad = flexColorVal === 'silver'
    ? 'linear-gradient(135deg,#5A5A5A 0%,#E8E8E8 40%,#C8C8C8 55%,#4A4A4A 100%)'
    : 'linear-gradient(135deg,#9A7000 0%,#FFD700 40%,#D4AF37 55%,#8B6000 100%)';
  const metalHex = metalGrad;

  // Text drag
  const handleTextMouseDown = (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    haptic.light();
    const startTX = config.textX ?? 50;
    const startTY = config.textY ?? 50;
    startPointerDrag(e, (dx, dy) => onChange({
      textX: Math.max(5, Math.min(95, startTX + dx/canvasW*100)),
      textY: Math.max(5, Math.min(95, startTY + dy/canvasH*100)),
    }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) onChange({ photoId: id });
  };

  const textX = config.textX ?? 50;
  const textY = config.textY ?? 50;
  const fontFamily = config.textFontFamily || 'Playfair Display';
  const fontSize = config.textFontSize || Math.max(16, canvasW / 9);

  return (
    <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}
      style={{ position:'relative', width:canvasW, height:canvasH, borderRadius:4, overflow:'hidden',
        boxShadow:'0 8px 32px rgba(0,0,0,0.18)', flexShrink:0, background:bgColor }}>
      {/* Ready-made cover background image (travel book) — full bleed, under
          everything. Only for printed covers: a soft material cover (velour /
          leatherette / fabric) must never show a printed background image, even
          if one lingers in stale state. */}
      {!isSoft && config.printedBgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={config.printedBgImage} alt=""
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0, pointerEvents:'none' }}
          draggable={false}/>
      )}
      {isSoft && <div style={{ position:'absolute', inset:0, backgroundImage:texture, pointerEvents:'none', zIndex:1 }}/>}

      {/* Snap guide lines overlay — shown while dragging */}
      {(snapLines.x?.length || snapLines.y?.length) && (
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:100 }}
          viewBox={`0 0 ${canvasW} ${canvasH}`}>
          {(snapLines.x || []).map(xp => (
            <line key={'x'+xp} x1={xp/100*canvasW} y1={0} x2={xp/100*canvasW} y2={canvasH}
              stroke={xp===50 ? '#f97316' : '#ef4444'} strokeWidth={xp===50?1.5:0.8} strokeDasharray={xp===50?'':'3 3'} opacity={0.85}/>
          ))}
          {(snapLines.y || []).map(yp => (
            <line key={'y'+yp} x1={0} y1={yp/100*canvasH} x2={canvasW} y2={yp/100*canvasH}
              stroke={yp===50 ? '#f97316' : '#ef4444'} strokeWidth={yp===50?1.5:0.8} strokeDasharray={yp===50?'':'3 3'} opacity={0.85}/>
          ))}
          {/* Center dot when both center lines active */}
          {snapLines.x?.includes(50) && snapLines.y?.includes(50) && (
            <circle cx={canvasW/2} cy={canvasH/2} r={4} fill="#f97316" opacity={0.9}/>
          )}
        </svg>
      )}

      {/* Printed cover — draggable photo slot + text blocks + overlay */}
      {renderPrintedPhotoSlot && (() => {
        const slot = config.printedPhotoSlot ?? { x: 0, y: 0, w: 100, h: 100, shape: 'rect' as const };
        const texts = config.printedTextBlocks ?? [];
        const overlay = config.printedOverlay ?? { type: 'none' as const, color: '#000000', opacity: 40, gradient: 'linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.6) 100%)' };
        const slotPx = { x: slot.x/100*canvasW, y: slot.y/100*canvasH, w: slot.w/100*canvasW, h: slot.h/100*canvasH };
        const isHeart = slot.shape === 'heart';
        const heartClipId = 'heart-clip-' + Math.round(slotPx.x) + '-' + Math.round(slotPx.y);
        const br = isHeart ? '0px' : slot.shape === 'circle' ? '50%' : slot.shape === 'rounded' ? '12px' : '0px';
        return (
          <>
            {/* Photo slot */}
            {isHeart && (
              <svg width={0} height={0} style={{ position:'absolute' }}>
                <defs>
                  <clipPath id={heartClipId} clipPathUnits="userSpaceOnUse">
                    <path d={`M ${slotPx.x + slotPx.w/2} ${slotPx.y + slotPx.h * 0.28}
                      C ${slotPx.x + slotPx.w/2} ${slotPx.y + slotPx.h * 0.13}, ${slotPx.x + slotPx.w * 0.15} ${slotPx.y}, ${slotPx.x + slotPx.w * 0.05} ${slotPx.y + slotPx.h * 0.22}
                      C ${slotPx.x - slotPx.w * 0.05} ${slotPx.y + slotPx.h * 0.45}, ${slotPx.x + slotPx.w * 0.15} ${slotPx.y + slotPx.h * 0.65}, ${slotPx.x + slotPx.w/2} ${slotPx.y + slotPx.h * 0.95}
                      C ${slotPx.x + slotPx.w * 0.85} ${slotPx.y + slotPx.h * 0.65}, ${slotPx.x + slotPx.w * 1.05} ${slotPx.y + slotPx.h * 0.45}, ${slotPx.x + slotPx.w * 0.95} ${slotPx.y + slotPx.h * 0.22}
                      C ${slotPx.x + slotPx.w * 0.85} ${slotPx.y} ${slotPx.x + slotPx.w/2} ${slotPx.y + slotPx.h * 0.13}, ${slotPx.x + slotPx.w/2} ${slotPx.y + slotPx.h * 0.28} Z`}/>
                  </clipPath>
                </defs>
              </svg>
            )}
            <div
              onDragOver={e=>{e.preventDefault();e.stopPropagation();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);const id=e.dataTransfer.getData('text/plain');if(id)onChange({photoId:id});}}
              onPointerDown={e => startSlotDrag(e, 'move')}
              onClick={() => { if (!photo && photos.length > 0) { haptic.success(); onChange({ photoId: photos[0].id }); } }}
                            style={{ position:'absolute', left:slotPx.x, top:slotPx.y, width:slotPx.w, height:slotPx.h,
                borderRadius:br, overflow: isHeart ? 'visible' : 'hidden', cursor:'move', zIndex:2, touchAction:'manipulation',
                clipPath: isHeart ? `url(#${heartClipId})` : undefined,
                border: isHeart ? 'none' : (dragOver ? '2px dashed #3b82f6' : (photo ? 'none' : '2px dashed rgba(148,163,184,0.8)')),
                background: isHeart ? 'transparent' : (photo ? 'transparent' : (dragOver ? 'rgba(59,130,246,0.08)' : '#f1f5f9')) }}>
              {photo
                ? <>
                    <div style={{ width:'100%', height:'100%', overflow:'hidden', position:'relative', cursor:'grab' }}
                    onPointerDown={e => {
                      e.stopPropagation(); e.preventDefault();
                      haptic.light();
                      const cx = config.photoCropX ?? 50;
                      const cy = config.photoCropY ?? 50;
                      const zm = config.photoZoom ?? 1;
                      // Dragging the photo ALWAYS pans the crop (moves the image
                      // inside its slot up/down/left/right). Slot repositioning is
                      // done with the dedicated move handle (top-left grip) and the
                      // resize corners — keeping the two gestures separate avoids the
                      // confusing "sometimes it moves the frame, sometimes the photo"
                      // behaviour. (Previously a default-position photo delegated the
                      // drag to slot-move, so panning a freshly placed cover photo did
                      // nothing — the bug Diana hit.)
                      const sensitivity = 1.5 / Math.max(1, zm);
                      startPointerDrag(e, (dx, dy) => {
                        onChange({
                          photoCropX: Math.max(0, Math.min(100, cx - dx / sensitivity)),
                          photoCropY: Math.max(0, Math.min(100, cy - dy / sensitivity)),
                        } as any);
                      });
                    }}
                    onWheel={e => {
                      if (!photo) return;
                      e.preventDefault();
                      const delta = e.deltaY > 0 ? -0.05 : 0.05;
                      const nz = Math.max(0.3, Math.min(4, (config.photoZoom ?? 1) + delta));
                      onChange({ photoZoom: nz } as any);
                    }}>
                    <img src={photo.preview}
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        objectPosition: `${config.photoCropX ?? 50}% ${config.photoCropY ?? 50}%`,
                        position: 'absolute', top: 0, left: 0,
                        transform: `scale(${config.photoZoom ?? 1}) rotate(${(config as any).photoRotation??0}deg)`,
                        transformOrigin: 'center',
                        userSelect: 'none', pointerEvents: 'none', touchAction: 'none',
                      }}
                      draggable={false}/>
                    {/* Zoom controls — always visible when photo present */}
                    <div onMouseDown={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
                      style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:3,
                        background:'rgba(0,0,0,0.75)', borderRadius:16, padding:'2px 8px', zIndex:30 }}>
                      <button onClick={e=>{e.stopPropagation(); onChange({ photoZoom: Math.max(0.3, (config.photoZoom??1)-0.1) } as any);}}
                        style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:13,padding:'0 2px'}}>−</button>
                      <span style={{color:'#fff',fontSize:8,fontWeight:700,minWidth:24,textAlign:'center'}}>{Math.round((config.photoZoom??1)*100)}%</span>
                      <button onClick={e=>{e.stopPropagation(); onChange({ photoZoom: Math.min(4, (config.photoZoom??1)+0.1) } as any);}}
                        style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:13,padding:'0 2px'}}>+</button>
                      <div style={{width:1,height:10,background:'rgba(255,255,255,0.3)',margin:'0 1px'}}/>
                      <button onClick={e=>{e.stopPropagation(); onChange({ photoRotation: (((config as any).photoRotation??0)-90+360)%360 } as any);}}
                        style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,padding:'0 2px'}}>↶</button>
                      <span style={{color:'#fff',fontSize:7,fontWeight:600,minWidth:18,textAlign:'center'}}>{(config as any).photoRotation??0}°</span>
                      <button onClick={e=>{e.stopPropagation(); onChange({ photoRotation: (((config as any).photoRotation??0)+90)%360 } as any);}}
                        style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,padding:'0 2px'}}>↷</button>
                      <div style={{width:1,height:10,background:'rgba(255,255,255,0.3)',margin:'0 1px'}}/>
                      <button onClick={e=>{e.stopPropagation(); onChange({ photoZoom:1, photoCropX:50, photoCropY:50, photoRotation:0 } as any);}}
                        style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:8,fontWeight:700,padding:'0 2px'}}>↺</button>
                    </div>
                  </div>
                    {/* Move handle — drag grip in top-left corner, made bigger for touch */}
                    <div onPointerDown={e => { e.stopPropagation(); startSlotDrag(e, 'move'); }}
                      style={{ position:'absolute', top:4, left:4, width:30, height:30, cursor:'move', zIndex:30,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'rgba(30,45,125,0.75)', borderRadius:8, touchAction:'manipulation',
                        boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}
                      title="Перетягнути слот">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1v10M1 6h10M6 1L4 3M6 1l2 2M6 11l-2-2M6 11l2-2M1 6l2-2M1 6l2 2M11 6l-2-2M11 6l-2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </>
                : <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, color:'#94a3b8' }}>
                    <ImageIcon size={28}/><span style={{ fontSize:11, fontWeight:600, textAlign:'center' }}>{t('constructor.drag_photo')}</span>
                  </div>}
              {photo && <button onClick={()=>{ if ((window as any).__tmJustDragged) return; onChange({photoId:null}); }} style={{ position:'absolute',top:6,right:6,width:28,height:28,borderRadius:'50%',background:'rgba(220,38,38,0.85)',color:'#fff',border:'2px solid rgba(255,255,255,0.8)',cursor:'pointer',fontSize:14,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',zIndex:20,boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }} onMouseDown={e=>e.stopPropagation()} title={t('constructor.remove_photo')}>×</button>}
              {/* Delete slot entirely */}
              <button onClick={()=>{ if ((window as any).__tmJustDragged) return; onChange({printedPhotoSlot:null, photoId:null} as any); }} style={{ position:'absolute',top: photo ? 28 : 4,right:4,width:20,height:20,borderRadius:'50%',background:'rgba(239,68,68,0.75)',color:'#fff',border:'none',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',zIndex:20 }} onMouseDown={e=>e.stopPropagation()} title={t('constructor.delete_slot')}></button>
            </div>
            {/* Resize handles */}
            {(['nw','ne','se','sw'] as const).map(dir => {
              const lp = (dir==='ne'||dir==='se') ? slotPx.x+slotPx.w : slotPx.x;
              const tp = (dir==='se'||dir==='sw') ? slotPx.y+slotPx.h : slotPx.y;
              return (
                <div key={dir} onPointerDown={e=>startSlotDrag(e,dir)}
                  style={{ position:'absolute', left:lp-8, top:tp-8, width:20, height:20,
                    borderRadius:'50%', background:'#3b82f6', border:'2.5px solid #fff',
                    cursor:`${dir}-resize`, zIndex:10, boxShadow:'0 1px 4px rgba(0,0,0,0.4)',
                    touchAction:'manipulation' }}/>
              );
            })}
            {/* Overlay */}
            {overlay.type === 'color' && <div style={{ position:'absolute', inset:0, zIndex:3, pointerEvents:'none', background:overlay.color, opacity:overlay.opacity/100 }}/>}
            {overlay.type === 'gradient' && <div style={{ position:'absolute', inset:0, zIndex:3, pointerEvents:'none', backgroundImage:overlay.gradient }}/>}
            {/* Multi photo slots — when template has photoSlots[] */}
            {config.printedPhotoSlots && config.printedPhotoSlots.length > 1 && config.printedPhotoSlots.slice(1).map((psl, si) => {
              const photo = photos.find(p => p.id === psl.photoId);
              const px = { x: psl.x/100*canvasW, y: psl.y/100*canvasH, w: psl.w/100*canvasW, h: psl.h/100*canvasH };
              const br2 = psl.shape === 'circle' ? '50%' : psl.shape === 'rounded' ? '8px' : '0px';
              return (
                <div key={'psl-'+si} style={{ position:'absolute', left:px.x, top:px.y, width:px.w, height:px.h,
                  borderRadius:br2, overflow:'hidden', zIndex:2,
                  border: photo ? 'none' : '1.5px dashed rgba(148,163,184,0.6)',
                  background: photo ? 'transparent' : '#f1f5f9', cursor:'pointer' }}
                  onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
                  onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(id){const slots=(config.printedPhotoSlots||[]).map((s,i)=>i===si+1?{...s,photoId:id}:s);onChange({printedPhotoSlots:slots} as any);}}}
                  onClick={() => { if(!photo && photos.length > 0){const id=photos.find(p=>!(config.printedPhotoSlots||[]).some(s=>s.photoId===p.id))?.id||photos[0].id;const slots=(config.printedPhotoSlots||[]).map((s,i)=>i===si+1?{...s,photoId:id}:s);onChange({printedPhotoSlots:slots} as any);} }}>
                  {photo
                    ? <img src={photo.preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} draggable={false}/>
                    : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:2 }}>
                        <span style={{ fontSize:12, color:'rgba(148,163,184,0.8)' }}></span>
                      </div>
                  }
                  {photo && <button onClick={e=>{e.stopPropagation();const slots=(config.printedPhotoSlots||[]).map((s,i)=>i===si+1?{...s,photoId:null}:s);onChange({printedPhotoSlots:slots} as any);}} style={{ position:'absolute',top:2,right:2,width:16,height:16,borderRadius:'50%',background:'rgba(0,0,0,0.55)',color:'#fff',border:'none',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>}
                </div>
              );
            })}
            {/* Text blocks */}
            {texts.map(tb => {
              // Safe zone for cover text. The print bleed is ~3mm out of
              // 200mm (≈1.5%), and a print-safe inner margin is another
              // 5mm (2.5%) — so anything outside ~6%..94% risks getting
              // trimmed off. We clamp tighter to 8..92 to give visual
              // breathing room and match what designers expect.
              const safeX = Math.max(8, Math.min(92, tb.x));
              const safeY = Math.max(8, Math.min(92, tb.y));
              // Single-line safe width for this text box (matches the wrapper
              // maxWidth). FitText shrinks the font down to fit this width so
              // long titles like "WEDDING" stay on one line on every product.
              const safeBoxW = canvasW * 0.84 - 12; // minus wrapper padding
              return (
              <ClampedTextWrapper key={tb.id}
                tb={tb} safeX={safeX} safeY={safeY}
                canvasW={canvasW} canvasH={canvasH} maxWidthPx={safeBoxW}
                onFontSizeChange={(delta) => onChange({ printedTextBlocks: texts.map(t => t.id===tb.id ? {...t, fontSize: Math.max(8, Math.min(120, (t.fontSize||24) + delta))} : t) })}>
                <FitText
                  tb={tb}
                  maxWidthPx={safeBoxW}
                  onCommit={(text) => onChange({ printedTextBlocks: texts.map(t => t.id===tb.id ? {...t, text} : t) })}
                  onPointerDownText={(e) => { startTextDrag(e, tb.id, tb.x, tb.y); }}
                  onClickText={(e) => { e.stopPropagation(); (e.target as HTMLElement).focus(); }}
                />
                <button data-html2canvas-ignore="true" onClick={e=>{e.stopPropagation();onChange({printedTextBlocks:texts.filter(t=>t.id!==tb.id)});}}
                  onMouseDown={e=>e.stopPropagation()}
                  style={{ position:'absolute',top:-8,right:-8,width:16,height:16,borderRadius:'50%',background:'#ef4444',color:'#fff',border:'none',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
              </ClampedTextWrapper>
            );})}
          </>
        );
      })()}

      {/* Printed cover text — independent of the photo slot.
          The photo-slot IIFE above also renders text, but it only runs when
          a photo slot exists and isn't hidden. Covers like the wedding
          guestbook are printed with NO photo slot (or hidePhotoSlot), so
          their text was added to state but never rendered. This block
          renders printedTextBlocks for the printed cover whenever the
          photo-slot block above did NOT (so text never double-renders). */}
      {!renderPrintedPhotoSlot && (() => {
        const texts = config.printedTextBlocks ?? [];
        if (texts.length === 0) return null;
        return (
          <>
            {texts.map(tb => {
              const safeX = Math.max(8, Math.min(92, tb.x));
              const safeY = Math.max(8, Math.min(92, tb.y));
              const safeBoxW = canvasW * 0.84 - 12;
              return (
              <ClampedTextWrapper key={tb.id}
                tb={tb} safeX={safeX} safeY={safeY}
                canvasW={canvasW} canvasH={canvasH} maxWidthPx={safeBoxW}
                onFontSizeChange={(delta) => onChange({ printedTextBlocks: texts.map(t => t.id===tb.id ? {...t, fontSize: Math.max(8, Math.min(120, (t.fontSize||24) + delta))} : t) })}>
                <FitText
                  tb={tb}
                  maxWidthPx={safeBoxW}
                  onCommit={(text) => onChange({ printedTextBlocks: texts.map(t => t.id===tb.id ? {...t, text} : t) })}
                  onPointerDownText={(e) => { startTextDrag(e, tb.id, tb.x, tb.y); }}
                  onClickText={(e) => { e.stopPropagation(); (e.target as HTMLElement).focus(); }}
                />
                <button data-html2canvas-ignore="true" onClick={e=>{e.stopPropagation();onChange({printedTextBlocks:texts.filter(t=>t.id!==tb.id)});}}
                  onMouseDown={e=>e.stopPropagation()}
                  style={{ position:'absolute',top:-8,right:-8,width:16,height:16,borderRadius:'50%',background:'#ef4444',color:'#fff',border:'none',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
              </ClampedTextWrapper>
            );})}
          </>
        );
      })()}

      {/* Soft cover decorations */}
      {isSoft && (
        <div style={{ position:'absolute', inset:0, zIndex:2 }}>

          {/* NONE */}
          {config.decoType === 'none' && (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'rgba(255,255,255,0.15)', fontSize:11, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase' }}>{config.coverColorName}</span>
            </div>
          )}

          {/* ACRYL */}
          {config.decoType === 'acryl' && (
            <div
              onDragOver={e=>{e.preventDefault();e.stopPropagation();setDragOver(true);}}
              onDragLeave={e=>{e.stopPropagation();setDragOver(false);}}
              onDrop={e=>{e.preventDefault();e.stopPropagation();setDragOver(false);const id=e.dataTransfer.getData('photoId')||e.dataTransfer.getData('text/plain');if(id)onChange({photoId:id});}}
              style={{ position:'absolute', left:boxL, top:boxT, width:boxW, height:boxH, borderRadius:dims.round?'50%':5,
              overflow:'hidden', border:dragOver?'3px dashed #60a5fa':'2px solid rgba(255,255,255,0.5)', boxShadow:'0 2px 16px rgba(0,0,0,0.25)',
              background:photo?'transparent':dragOver?'rgba(96,165,250,0.25)':'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'copy', zIndex:5 }}>
              {photo ? <>
                {/* Photo fills the slot via absolute positioning — do NOT use width/height:100%
                    inside a flex container as browsers may compute height as 0. */}
                <div style={{ position:'absolute', inset:0, overflow:'hidden', cursor:'grab' }}
                    onPointerDown={e => {
                      e.stopPropagation(); e.preventDefault();
                      haptic.light();
                      const cx = config.photoCropX ?? 50, cy = config.photoCropY ?? 50;
                      const sensitivity = 1.5 / Math.max(1, config.photoZoom ?? 1);
                      startPointerDrag(e, (dx, dy) => {
                        onChange({ photoCropX: Math.max(0, Math.min(100, cx - dx/sensitivity)), photoCropY: Math.max(0, Math.min(100, cy - dy/sensitivity)) } as any);
                      });
                    }}
                    onWheel={e => { if (!photo) return; e.preventDefault(); onChange({ photoZoom: Math.max(0.3, Math.min(4, (config.photoZoom??1) + (e.deltaY>0?-0.05:0.05))) } as any); }}>
                    <img src={photo.preview} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:`${config.photoCropX??50}% ${config.photoCropY??50}%`, transform:`scale(${config.photoZoom??1}) rotate(${(config as any).photoRotation??0}deg)`, transformOrigin:'center', userSelect:'none', pointerEvents:'none', touchAction:'manipulation' }} draggable={false}/>
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 50%)', pointerEvents:'none' }}/>
                </div>
                {/* Zoom + rotation toolbar */}
                <div onMouseDown={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
                  style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:3,
                    background:'rgba(0,0,0,0.75)', borderRadius:16, padding:'2px 8px', zIndex:30 }}>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoZoom: Math.max(0.3, (config.photoZoom??1)-0.1) } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:13,padding:'0 2px'}}>−</button>
                  <span style={{color:'#fff',fontSize:8,fontWeight:700,minWidth:24,textAlign:'center'}}>{Math.round((config.photoZoom??1)*100)}%</span>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoZoom: Math.min(4, (config.photoZoom??1)+0.1) } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:13,padding:'0 2px'}}>+</button>
                  <div style={{width:1,height:10,background:'rgba(255,255,255,0.3)',margin:'0 1px'}}/>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoRotation: (((config as any).photoRotation??0)-90+360)%360 } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,padding:'0 2px'}}>↶</button>
                  <span style={{color:'#fff',fontSize:7,fontWeight:600,minWidth:18,textAlign:'center'}}>{(config as any).photoRotation??0}°</span>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoRotation: (((config as any).photoRotation??0)+90)%360 } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,padding:'0 2px'}}>↷</button>
                  <div style={{width:1,height:10,background:'rgba(255,255,255,0.3)',margin:'0 1px'}}/>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoZoom:1, photoCropX:50, photoCropY:50, photoRotation:0 } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:8,fontWeight:700,padding:'0 2px'}}>↺</button>
                </div>
                <button onClick={()=>onChange({photoId:null})} style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:31 }}>×</button></>
              : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, color:'rgba(255,255,255,0.7)', textAlign:'center', padding:'0 8px' }}><ImageIcon size={22}/><span style={{ fontSize:10, fontWeight:700, textAlign:'center' }}>{t('constructor.drag_photo_acrylic').replace('\n','')}<br/>{t('constructor.drag_photo_acrylic').split('\n')[1] || 'to acrylic'}</span></div>}
            </div>
          )}

          {/* PHOTO INSERT */}
          {config.decoType === 'photovstavka' && (
            <div
              onDragOver={e=>{e.preventDefault();e.stopPropagation();setDragOver(true);}}
              onDragLeave={e=>{e.stopPropagation();setDragOver(false);}}
              onDrop={e=>{e.preventDefault();e.stopPropagation();setDragOver(false);const id=e.dataTransfer.getData('photoId')||e.dataTransfer.getData('text/plain');if(id)onChange({photoId:id});}}
              style={{ position:'absolute', left:boxL, top:boxT, width:boxW, height:boxH, borderRadius:3,
              overflow:'hidden', border:dragOver?'3px dashed #60a5fa':'2px dashed rgba(255,255,255,0.5)', background:photo?'transparent':dragOver?'rgba(96,165,250,0.2)':'rgba(255,255,255,0.1)',
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'copy', zIndex:5 }}>
              {photo ? <>
                <div style={{ position:'absolute', inset:0, overflow:'hidden', cursor:'grab' }}
                    onPointerDown={e => {
                      e.stopPropagation(); e.preventDefault();
                      haptic.light();
                      const cx = config.photoCropX ?? 50, cy = config.photoCropY ?? 50;
                      const sensitivity = 1.5 / Math.max(1, config.photoZoom ?? 1);
                      startPointerDrag(e, (dx, dy) => {
                        onChange({ photoCropX: Math.max(0, Math.min(100, cx - dx/sensitivity)), photoCropY: Math.max(0, Math.min(100, cy - dy/sensitivity)) } as any);
                      });
                    }}
                    onWheel={e => { if (!photo) return; e.preventDefault(); onChange({ photoZoom: Math.max(0.3, Math.min(4, (config.photoZoom??1) + (e.deltaY>0?-0.05:0.05))) } as any); }}>
                    <img src={photo.preview} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:`${config.photoCropX??50}% ${config.photoCropY??50}%`, transform:`scale(${config.photoZoom??1}) rotate(${(config as any).photoRotation??0}deg)`, transformOrigin:'center', userSelect:'none', pointerEvents:'none', touchAction:'manipulation' }} draggable={false}/>
                </div>
                {/* Zoom + rotation toolbar */}
                <div onMouseDown={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
                  style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:3,
                    background:'rgba(0,0,0,0.75)', borderRadius:16, padding:'2px 8px', zIndex:30 }}>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoZoom: Math.max(0.3, (config.photoZoom??1)-0.1) } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:13,padding:'0 2px'}}>−</button>
                  <span style={{color:'#fff',fontSize:8,fontWeight:700,minWidth:24,textAlign:'center'}}>{Math.round((config.photoZoom??1)*100)}%</span>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoZoom: Math.min(4, (config.photoZoom??1)+0.1) } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:13,padding:'0 2px'}}>+</button>
                  <div style={{width:1,height:10,background:'rgba(255,255,255,0.3)',margin:'0 1px'}}/>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoRotation: (((config as any).photoRotation??0)-90+360)%360 } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,padding:'0 2px'}}>↶</button>
                  <span style={{color:'#fff',fontSize:7,fontWeight:600,minWidth:18,textAlign:'center'}}>{(config as any).photoRotation??0}°</span>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoRotation: (((config as any).photoRotation??0)+90)%360 } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,padding:'0 2px'}}>↷</button>
                  <div style={{width:1,height:10,background:'rgba(255,255,255,0.3)',margin:'0 1px'}}/>
                  <button onClick={e=>{e.stopPropagation(); onChange({ photoZoom:1, photoCropX:50, photoCropY:50, photoRotation:0 } as any);}}
                    style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:8,fontWeight:700,padding:'0 2px'}}>↺</button>
                </div>
                <button onClick={()=>onChange({photoId:null})} style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', zIndex:31 }}>×</button></>
              : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, color:'rgba(255,255,255,0.7)', textAlign:'center', padding:'0 8px' }}><ImageIcon size={22}/><span style={{ fontSize:10, fontWeight:700, textAlign:'center' }}>{t('constructor.drag_photo_insert').replace('\n','')}<br/>{t('constructor.drag_photo_insert').split('\n')[1] || 'to insert'}</span></div>}
            </div>
          )}

          {/* METAL */}
          {config.decoType === 'metal' && (
            <div style={{ position:'absolute', left:boxL, top:boxT, width:boxW, height:boxH,
              borderRadius:dims.round?'50%':3, background:metalHex,
              boxShadow:'0 3px 14px rgba(0,0,0,0.4),inset 0 1px 1px rgba(255,255,255,0.4)',
              display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
              <span contentEditable suppressContentEditableWarning
                onBlur={e=>onChange({decoText:e.currentTarget.textContent||''})}
                style={{ color:flexColorVal==='gold'?'#3D2800':'#1A1A1A', fontSize:(config.textFontSize || Math.max(10,Math.min(boxW/8,22)))+'px',
                  fontFamily:(config.textFontFamily || 'Montserrat')+',sans-serif', fontWeight:700, letterSpacing:'0.05em',
                  outline:'none', cursor:'text', textAlign:'center', padding:'0 6px', maxWidth:'90%', wordBreak:'break-word' }}>
                {config.decoText||t('constructor.your_text')}
              </span>
            </div>
          )}

          {/* FLEX — draggable text */}
          {config.decoType === 'flex' && (
            <div onPointerDown={handleTextMouseDown}
              style={{ position:'absolute', left:`${textX}%`, top:`${textY}%`, transform:'translate(-50%,-50%)',
                cursor:'move', userSelect:'none', zIndex:10, padding:'10px 16px',
                border:'1px dashed rgba(255,255,255,0.3)', borderRadius:4, touchAction:'manipulation' }}>
              <span contentEditable suppressContentEditableWarning
                onBlur={e=>onChange({decoText:e.currentTarget.textContent||''})}
                onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
                onPointerDown={e=>e.stopPropagation()}
                style={{ color:flexHex, textShadow:'0 0 8px rgba(0,0,0,0.3)', fontSize:fontSize+'px',
                  fontFamily:fontFamily+',Playfair Display,Georgia,serif', fontWeight:700,
                  letterSpacing:'0.04em', outline:'none', cursor:'text', display:'block', textAlign:'center',
                  whiteSpace:'nowrap' }}>
                {config.decoText||t('constructor.your_text')}
              </span>
              <div style={{ position:'absolute', top:-10, right:-10, background:'rgba(0,0,0,0.55)', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', cursor:'move', touchAction:'none' }} title="Перетягнути">
                <Move size={11} color="#fff"/>
              </div>
            </div>
          )}

          {/* ENGRAVING — draggable text */}
          {config.decoType === 'graviruvannya' && (
            <div onPointerDown={handleTextMouseDown}
              style={{ position:'absolute', left:`${textX}%`, top:`${textY}%`, transform:'translate(-50%,-50%)',
                cursor:'move', userSelect:'none', zIndex:10, padding:'10px 16px',
                border:'1px dashed rgba(255,255,255,0.2)', borderRadius:4, touchAction:'manipulation' }}>
              <span contentEditable suppressContentEditableWarning
                onBlur={e=>onChange({decoText:e.currentTarget.textContent||''})}
                onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
                onPointerDown={e=>e.stopPropagation()}
                style={{ color:darkenHex(bgColor, 50), textShadow:`0 1px 0 ${darkenHex(bgColor,80)},0 -1px 0 rgba(255,255,255,0.1)`,
                  fontSize:fontSize+'px', fontFamily:fontFamily+',Playfair Display,Georgia,serif',
                  fontWeight:600, letterSpacing:'0.06em', outline:'none', cursor:'text', display:'block',
                  textAlign:'center', whiteSpace:'nowrap' }}>
                {config.decoText||t('constructor.your_text')}
              </span>
              <div style={{ position:'absolute', top:-10, right:-10, background:'rgba(0,0,0,0.45)', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', cursor:'move', touchAction:'none' }} title="Перетягнути">
                <Move size={11} color="#fff"/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* variant label removed — was showing internal codes like 'foto_100x100' */}

      {/* Extra text blocks — draggable on any cover type */}
      {config.decoType !== 'metal' && (config.extraTexts||[]).map(et => {
        const etDragRef = { current: null as {sx:number;sy:number;stx:number;sty:number}|null };
        return (
          <div key={et.id}
            onPointerDown={e => {
              e.stopPropagation(); e.preventDefault();
              haptic.light();
              const stx = et.x, sty = et.y;
              startPointerDrag(e, (dx, dy) => {
                const updated = (config.extraTexts||[]).map(t => t.id===et.id
                  ? {...t, x:Math.max(2,Math.min(95,stx+dx/canvasW*100)), y:Math.max(2,Math.min(95,sty+dy/canvasH*100))}
                  : t);
                onChange({extraTexts: updated});
              });
            }}
            data-inscription-frame="true"
            style={{ position:'absolute', left:`${et.x}%`, top:`${et.y}%`, transform:'translate(-50%,-50%)', cursor:'move', zIndex:20, padding:'8px 12px', border:'1px dashed rgba(255,255,255,0.25)', borderRadius:3 }}>
            <span
              contentEditable suppressContentEditableWarning
              onBlur={e => {
                const updated=(config.extraTexts||[]).map(t=>t.id===et.id?{...t,text:e.currentTarget.textContent||''}:t);
                onChange({extraTexts:updated});
              }}
              onClick={e=>e.stopPropagation()}
              onMouseDown={e=>e.stopPropagation()}
              onPointerDown={e=>e.stopPropagation()}
              style={{ display:'block', fontSize:(et.fontSize||20)+'px', fontFamily:(et.fontFamily||'Playfair Display')+',serif', color:et.color||'#fff', fontWeight:600, outline:'none', cursor:'text', whiteSpace:'nowrap', textShadow:isSoft?'none':'0 1px 3px rgba(0,0,0,0.4)' }}>
              {et.text}
            </span>
            {/* Delete button — hover on desktop, always shown on touch.
                Sits at top-right corner of the text frame. */}
            <button
              data-del-extra-text
              data-export-ignore="true"
              title="Видалити напис"
              onPointerDown={(e) => { e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                const updated = (config.extraTexts||[]).filter(t => t.id !== et.id);
                // When the last inscription is gone the +180 ₴ method is
                // no longer relevant — clear it so reopening the editor
                // starts clean.
                onChange({ extraTexts: updated, ...(updated.length === 0 ? { inscriptionMethod: null } : {}) } as any);
              }}
              style={{
                position:'absolute', top:-10, right:-10, width:22, height:22, borderRadius:'50%',
                background:'#ef4444', color:'#fff', border:'2px solid #fff', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, lineHeight:1, fontWeight:800, padding:0, zIndex:25,
                opacity:1, transition:'opacity 0.15s', boxShadow:'0 1px 3px rgba(0,0,0,0.35)',
              }}
            >×</button>
          </div>
        );
      })}

      {/* Free draggable + resizable photos — work on ANY cover material.
          Container drag = move, corner handle = resize, wheel/toolbar = zoom.
          x/y/w/h are % of the cover so they scale to preview + print. */}
      {config.decoType !== 'metal' && (config.coverPhotos||[]).map(cp => {
        const ph = photos.find(p => p.id === cp.photoId);
        const radius = cp.shape==='circle' ? '50%' : cp.shape==='rounded' ? '10px' : '2px';
        const updateCP = (patch: Partial<NonNullable<CoverConfig['coverPhotos']>[number]>) =>
          onChange({ coverPhotos: (config.coverPhotos||[]).map(c => c.id===cp.id ? {...c, ...patch} : c) });
        return (
          <div key={cp.id}
            onPointerDown={e => {
              e.stopPropagation(); e.preventDefault(); haptic.light();
              const sx=cp.x, sy=cp.y;
              startPointerDrag(e, (dx,dy) => {
                updateCP({
                  x: Math.max(0, Math.min(100-cp.w, sx + dx/canvasW*100)),
                  y: Math.max(0, Math.min(100-cp.h, sy + dy/canvasH*100)),
                });
              });
            }}
            onWheel={e => { if(!ph) return; e.preventDefault(); updateCP({ zoom: Math.max(1, Math.min(4, (cp.zoom??1)+(e.deltaY>0?-0.05:0.05))) }); }}
            onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
            onDrop={e=>{e.preventDefault();e.stopPropagation();const id=e.dataTransfer.getData('photoId')||e.dataTransfer.getData('text/plain');if(id)updateCP({photoId:id});}}
            onClick={()=>{ if(!ph && photos.length>0) updateCP({ photoId: photos[0].id }); }}
            style={{ position:'absolute', left:`${cp.x}%`, top:`${cp.y}%`, width:`${cp.w}%`, height:`${cp.h}%`,
              borderRadius:radius, overflow:'hidden', cursor:'move', zIndex:22, background:'transparent' }}>
            {ph
              ? <img src={ph.preview} draggable={false} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:`${cp.cropX??50}% ${cp.cropY??50}%`, transform:`scale(${cp.zoom??1}) rotate(${cp.rotation??0}deg)`, pointerEvents:'none', userSelect:'none' }}/>
              : <div data-html2canvas-ignore="true" style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:4,color:'rgba(255,255,255,0.85)',border:'1.5px dashed rgba(255,255,255,0.7)',background:'rgba(255,255,255,0.12)',borderRadius:radius }}><ImageIcon size={20}/><span style={{fontSize:9,fontWeight:700}}>Фото</span></div>}
            {/* Edit affordance outline — ignored by the print snapshot */}
            {ph && <div data-html2canvas-ignore="true" style={{ position:'absolute', inset:0, border:'1px solid rgba(96,165,250,0.9)', borderRadius:radius, pointerEvents:'none' }}/>}
            <button data-html2canvas-ignore="true" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onChange({coverPhotos:(config.coverPhotos||[]).filter(c=>c.id!==cp.id)});}}
              style={{ position:'absolute',top:-9,right:-9,width:20,height:20,borderRadius:'50%',background:'#ef4444',color:'#fff',border:'2px solid #fff',cursor:'pointer',fontSize:12,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',zIndex:24,padding:0 }}>×</button>
            <div data-html2canvas-ignore="true" onPointerDown={e=>{
                e.stopPropagation(); e.preventDefault(); haptic.light();
                const sw=cp.w, sh=cp.h;
                startPointerDrag(e,(dx,dy)=>{
                  updateCP({
                    w: Math.max(10, Math.min(100-cp.x, sw+dx/canvasW*100)),
                    h: Math.max(10, Math.min(100-cp.y, sh+dy/canvasH*100)),
                  });
                });
              }}
              style={{ position:'absolute',bottom:-8,right:-8,width:18,height:18,borderRadius:'50%',background:'#fff',border:'2px solid #3b82f6',cursor:'nwse-resize',zIndex:24,boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }}/>
            {ph && (
              <div data-html2canvas-ignore="true" onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
                style={{ position:'absolute',bottom:3,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:2,background:'rgba(0,0,0,0.7)',borderRadius:14,padding:'1px 6px',zIndex:23 }}>
                <button onClick={e=>{e.stopPropagation();updateCP({zoom:Math.max(1,(cp.zoom??1)-0.1)});}} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:13,padding:'0 2px'}}>−</button>
                <span style={{color:'#fff',fontSize:8,fontWeight:700,minWidth:22,textAlign:'center'}}>{Math.round((cp.zoom??1)*100)}%</span>
                <button onClick={e=>{e.stopPropagation();updateCP({zoom:Math.min(4,(cp.zoom??1)+0.1)});}} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:13,padding:'0 2px'}}>+</button>
                <div style={{width:1,height:10,background:'rgba(255,255,255,0.3)',margin:'0 1px'}}/>
                <button onClick={e=>{e.stopPropagation();updateCP({rotation:(((cp.rotation??0)+90)%360)});}} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,padding:'0 2px'}}>↷</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
