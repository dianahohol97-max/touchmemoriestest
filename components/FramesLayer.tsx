'use client';
import React from 'react';

export interface FrameConfig {
  frameId: string | null;
  color: string;
  opacity: number;
  scale: number;
  x: number;
  y: number;
  zIndex?: number;
  // Photo inside the frame (frame-as-slot)
  photoId?: string | null;
  cropX?: number;   // 0-100%
  cropY?: number;   // 0-100%
  zoom?: number;    // 1 = default
}

export const DEFAULT_FRAME: FrameConfig = { frameId: null, color: '#1e2d7d', opacity: 100, scale: 0.6, x: 0, y: 0, zIndex: 35, photoId: null, cropX: 50, cropY: 50, zoom: 1 };

// PNG frames — rendered as <img> overlay, black bg = transparent (mix-blend-mode: multiply not needed, these have real alpha)
export const PNG_FRAMES = [
  // ── Акварельні квіткові ──
  { id: 'png-pink-roses-watercolor',  label: 'Рожеві троянди',    group: 'Акварельні', src: '/frames/pink-roses-watercolor.png' },
  { id: 'png-pink-flower-corner',     label: 'Рожеві маки',        group: 'Акварельні', src: '/frames/pink-flower-corner.png' },
  { id: 'png-eucalyptus-gold-square', label: 'Евкаліпт квадрат',  group: 'Акварельні', src: '/frames/eucalyptus-gold-square.png' },
  { id: 'png-jasmine-corners',        label: 'Жасмин кутики',     group: 'Акварельні', src: '/frames/jasmine-corners.png' },
  { id: 'png-botanical-vines',        label: 'Ботанічні ліани',   group: 'Акварельні', src: '/frames/botanical-vines-square.png' },
  { id: 'png-lily-corner',            label: 'Лілії кутик',       group: 'Акварельні', src: '/frames/lily-corner.png' },
  // ── Золоті класичні ──
  { id: 'png-gold-baroque-simple',    label: 'Золото бароко',      group: 'Золоті',    src: '/frames/gold-baroque-simple.png' },
  { id: 'png-gold-baroque-ornate',    label: 'Золото розкішне',    group: 'Золоті',    src: '/frames/gold-baroque-ornate.png' },
  { id: 'png-gold-rococo-ornate',     label: 'Золото рококо',      group: 'Золоті',    src: '/frames/gold-rococo-ornate.png' },
  { id: 'png-gold-ornate-portrait',   label: 'Золото портрет',     group: 'Золоті',    src: '/frames/gold-ornate-portrait.png' },
  // ── Весільні (gold + florals) ──
  { id: 'png-boho-gold-floral',       label: 'Бохо золото',        group: 'Весільні PNG', src: '/frames/boho-gold-floral.png' },
  { id: 'png-roses-gold-circle',      label: 'Троянди коло',       group: 'Весільні PNG', src: '/frames/roses-gold-circle.png' },
  { id: 'png-eucalyptus-gold-circle', label: 'Евкаліпт коло',      group: 'Весільні PNG', src: '/frames/eucalyptus-gold-circle.png' },
  // ── Векторні декоративні ──
  { id: 'png-gdj-floral-wreath',      label: 'Квітковий вінок',    group: 'Векторні', src: '/frames/gdj-floral-wreath.png' },
  { id: 'png-gdj-leaves-circle',      label: 'Листя коло',         group: 'Векторні', src: '/frames/gdj-leaves-circle.png' },
  { id: 'png-gdj-botanical-square',   label: 'Ботаніка квадрат',   group: 'Векторні', src: '/frames/gdj-botanical-square.png' },
  { id: 'png-gdj-vintage',            label: 'Вінтаж',             group: 'Векторні', src: '/frames/gdj-vintage.png' },
  { id: 'png-black-floral-border',    label: 'Чорна флора',        group: 'Векторні', src: '/frames/black-floral-border.png' },
  { id: 'png-black-floral-2',         label: 'Чорна флора 2',      group: 'Векторні', src: '/frames/black-floral-2.png' },
  { id: 'png-silver-ornament-bands',  label: 'Срібний орнамент',   group: 'Векторні', src: '/frames/silver-ornament-bands.png' },
  { id: 'png-teal-monstera-square',   label: 'Монстера',           group: 'Векторні', src: '/frames/teal-monstera-square.png' },
  { id: 'png-jungle-vines-square',    label: 'Джунглі ліани',      group: 'Векторні', src: '/frames/jungle-vines-square.png' },
  // ── Акварельні 2 ──
  { id: 'png-blue-leaves-corners',    label: 'Сині листя',         group: 'Акварельні', src: '/frames/blue-leaves-corners.png' },
  { id: 'png-peach-roses-gold',       label: 'Персик троянди',     group: 'Акварельні', src: '/frames/peach-roses-gold.png' },
  { id: 'png-green-berries-wreath',   label: 'Зелений вінок',      group: 'Акварельні', src: '/frames/green-berries-wreath.png' },
  { id: 'png-eucalyptus-white-flowers', label: 'Евкаліпт+квіти',  group: 'Акварельні', src: '/frames/eucalyptus-white-flowers.png' },
  { id: 'png-sage-botanical-corner',  label: 'Сейдж кутик',        group: 'Акварельні', src: '/frames/sage-botanical-corner.png' },
  { id: 'png-white-roses-cascade',    label: 'Білі троянди',       group: 'Акварельні', src: '/frames/white-roses-cascade.png' },
  // ── Весільні PNG 2 ──
  { id: 'png-pink-hexagon-gold',      label: 'Рожевий шестикут',   group: 'Весільні PNG', src: '/frames/pink-hexagon-gold.png' },
  { id: 'png-pink-roses-gold-circle', label: 'Рожеве коло',        group: 'Весільні PNG', src: '/frames/pink-roses-gold-circle.png' },
  { id: 'png-gold-acanthus-corner',   label: 'Золотий аканф',      group: 'Весільні PNG', src: '/frames/gold-acanthus-corner.png' },
  { id: 'png-pink-cherry-gold-poly',  label: 'Сакура золото',      group: 'Весільні PNG', src: '/frames/pink-cherry-gold-poly.png' },
  // ── Спеціальні ──
  { id: 'png-polaroid-paperclip',     label: 'Поляроїд',           group: 'Спеціальні', src: '/frames/polaroid-paperclip.png' },
  { id: 'png-vyshyvanka-blue-top',     label: 'Вишиванка синя',     group: 'Спеціальні', src: '/frames/vyshyvanka-blue-top.png' },
];

// All frames combined (SVG + PNG) — used in picker
export const ALL_FRAMES_FLAT = [...PNG_FRAMES]; // SVG appended below

// SVG frame definitions
export const FRAMES = [
  // ── Simple frames ──
  {
    id: 'simple-thin',
    label: 'Тонка (1мм)',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(1, Math.round(w * 0.003)); // 1mm
      const g = sw * 3;
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'simple-medium',
    label: 'Середня (3мм)',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(2, Math.round(w * 0.007)); // 3mm
      const g = sw * 2;
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'simple-thick',
    label: 'Товста (6мм)',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(3, Math.round(w * 0.015)); // 6mm
      const g = sw * 1.5;
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'double',
    label: 'Подвійна',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw1 = Math.max(1, Math.round(w * 0.005));
      const sw2 = Math.max(1, Math.round(w * 0.008));
      const g1 = sw1 * 2, g2 = g1 + sw1 * 4;
      return `<rect x="${g1}" y="${g1}" width="${w-g1*2}" height="${h-g1*2}" fill="none" stroke="${color}" stroke-width="${sw1}" opacity="${op/100}"/>
       <rect x="${g2}" y="${g2}" width="${w-g2*2}" height="${h-g2*2}" fill="none" stroke="${color}" stroke-width="${sw2}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'rounded',
    label: 'Округла',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(2, Math.round(w * 0.012));
      const g = sw * 1.5;
      const rx = Math.round(w * 0.04);
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" rx="${rx}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'dashed',
    label: 'Пунктирна',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(1, Math.round(w * 0.008));
      const g = sw * 2;
      const dash = Math.round(w * 0.03);
      const gap = Math.round(w * 0.015);
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dash},${gap}" opacity="${op/100}"/>`;
    },
  },

  // REMOVED: Decorative and Floral frames — use SVG only simple
  // ── Decorative frames ──
  {
    id: 'corners',
    label: 'Кутики',
    group: 'Декоративні',
    render: (w:number, h:number, color:string, op:number) => {
      const s = 30, sw = 4;
      return `<g stroke="${color}" stroke-width="${sw}" fill="none" opacity="${op/100}">
        <path d="M${s},12 L12,12 L12,${s}"/>
        <path d="M${w-s},12 L${w-12},12 L${w-12},${s}"/>
        <path d="M12,${h-s} L12,${h-12} L${s},${h-12}"/>
        <path d="M${w-12},${h-s} L${w-12},${h-12} L${w-s},${h-12}"/>
      </g>`;
    },
  },
  {
    id: 'ornate-corners',
    label: 'Орнамент',
    group: 'Декоративні',
    render: (w:number, h:number, color:string, op:number) => {
      const s = 45, sw = 3;
      return `<g stroke="${color}" fill="${color}" opacity="${op/100}">
        <rect x="10" y="10" width="${w-20}" height="${h-20}" fill="none" stroke="${color}" stroke-width="1.5"/>
        <path d="M${s},10 L10,10 L10,${s}" fill="none" stroke-width="${sw}"/>
        <path d="M${w-s},10 L${w-10},10 L${w-10},${s}" fill="none" stroke-width="${sw}"/>
        <path d="M10,${h-s} L10,${h-10} L${s},${h-10}" fill="none" stroke-width="${sw}"/>
        <path d="M${w-10},${h-s} L${w-10},${h-10} L${w-s},${h-10}" fill="none" stroke-width="${sw}"/>
        <circle cx="10" cy="10" r="4"/>
        <circle cx="${w-10}" cy="10" r="4"/>
        <circle cx="10" cy="${h-10}" r="4"/>
        <circle cx="${w-10}" cy="${h-10}" r="4"/>
        <circle cx="${w/2}" cy="10" r="3"/>
        <circle cx="${w/2}" cy="${h-10}" r="3"/>
        <circle cx="10" cy="${h/2}" r="3"/>
        <circle cx="${w-10}" cy="${h/2}" r="3"/>
      </g>`;
    },
  },
];

interface FrameLayerProps {
  frame: FrameConfig;
  canvasW: number;
  canvasH: number;
  /** Photo lookup — pass getPhoto from editor */
  getPhoto?: (id: string | null | undefined) => { id: string; preview: string; width: number; height: number } | null;
  /** Called when frame config changes (photo added/removed, crop, zoom) */
  onChange?: (frame: FrameConfig) => void;
  /** Currently dragged photo id from sidebar (for drop highlight) */
  dragPhotoId?: string | null;
  /** Mobile tap-to-place photo id */
  tapPhotoId?: string | null;
  /** Called after tap-to-place to clear selection */
  onTapPlace?: () => void;
}

export function FrameLayer({ frame, canvasW, canvasH, getPhoto, onChange, dragPhotoId, tapPhotoId, onTapPlace }: FrameLayerProps) {
  const [isOver, setIsOver] = React.useState(false);
  const [isCropping, setIsCropping] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const cropStartRef = React.useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  if (!frame.frameId) return null;

  // Auto-migrate: old default was scale:1 (fullscreen), new default is 0.6
  const scale = (frame.scale === 1 && frame.x === 0 && frame.y === 0) ? 0.6 : (frame.scale ?? 0.6);
  const xOff = frame.x ?? 0;
  const yOff = frame.y ?? 0;
  // Use the smaller dimension as base so frame doesn't stretch on spreads
  const baseDim = Math.min(canvasW, canvasH);
  const fw = baseDim * scale;
  const fh = baseDim * scale;
  const cx = (canvasW - fw) / 2 + xOff;
  const cy = (canvasH - fh) / 2 + yOff;

  const photo = getPhoto ? getPhoto(frame.photoId) : null;
  const hasPhoto = !!photo;
  const pngDef = PNG_FRAMES.find(f => f.id === frame.frameId);
  const svgDef = FRAMES.find(f => f.id === frame.frameId);
  const isPng = !!pngDef;
  const interactive = !!onChange;

  // Photo zone: inset from frame edges (the transparent center area)
  const insetPct = isPng ? 0.18 : 0.08;
  const photoZone = {
    x: fw * insetPct,
    y: fh * insetPct,
    w: fw * (1 - 2 * insetPct),
    h: fh * (1 - 2 * insetPct),
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsOver(false);
    if (!onChange) return;
    const photoId = e.dataTransfer?.getData('photoId') || e.dataTransfer?.getData('text/plain');
    if (!photoId) return;
    onChange({ ...frame, photoId, cropX: 50, cropY: 50, zoom: 1 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!hasPhoto || !onChange) return;
    e.preventDefault(); e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const nz = Math.max(1, Math.min(4, (frame.zoom ?? 1) + delta));
    onChange({ ...frame, zoom: nz });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!hasPhoto || !onChange) return;
    e.stopPropagation(); e.preventDefault();
    setIsCropping(true);
    cropStartRef.current = { x: e.clientX, y: e.clientY, cx: frame.cropX ?? 50, cy: frame.cropY ?? 50 };
    const onMove = (ev: PointerEvent) => {
      if (!cropStartRef.current) return;
      const dx = ev.clientX - cropStartRef.current.x;
      const dy = ev.clientY - cropStartRef.current.y;
      const ncx = Math.max(0, Math.min(100, cropStartRef.current.cx - dx * 0.15));
      const ncy = Math.max(0, Math.min(100, cropStartRef.current.cy - dy * 0.15));
      onChange({ ...frame, cropX: ncx, cropY: ncy });
    };
    const onUp = () => {
      setIsCropping(false);
      cropStartRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const clearPhoto = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (onChange) onChange({ ...frame, photoId: null, cropX: 50, cropY: 50, zoom: 1 });
  };

  // ─── NO PHOTO: render same as before (decorative overlay, pointerEvents: none) ───
  // BUT with a small interactive drop zone in the center for receiving photos
  if (!hasPhoto) {
    return (
      <>
        {/* Decorative frame — pointerEvents: none, overflow: visible — same as original */}
        <div style={{
          position: 'absolute', left: cx, top: cy, width: fw, height: fh,
          zIndex: frame.zIndex ?? 35, pointerEvents: 'none', overflow: 'visible',
          opacity: frame.opacity / 100,
        }}>
          {pngDef ? (
            <img src={pngDef.src} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
          ) : svgDef ? (
            <svg width={fw} height={fh} style={{ display:'block' }}
              dangerouslySetInnerHTML={{ __html: svgDef.render(fw, fh, frame.color, 100) }} />
          ) : null}
        </div>
        {/* Interactive drop zone in the center — only visible on drag/hover */}
        {interactive && (
          <div
            style={{
              position: 'absolute',
              left: cx + photoZone.x, top: cy + photoZone.y,
              width: photoZone.w, height: photoZone.h,
              zIndex: (frame.zIndex ?? 35) + 1,
              pointerEvents: 'auto',
              borderRadius: 4,
              cursor: tapPhotoId ? 'copy' : 'default',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setIsOver(false); }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsOver(true); }}
            onDragLeave={() => setIsOver(false)}
            onDrop={handleDrop}
            onClick={tapPhotoId && onChange ? (e => {
              e.stopPropagation();
              onChange({ ...frame, photoId: tapPhotoId, cropX: 50, cropY: 50, zoom: 1 });
              onTapPlace?.();
            }) : undefined}
          >
            {/* Drop highlight */}
            {(isOver || isHovered && tapPhotoId) && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(59,130,246,0.12)',
                border: '2px dashed #3b82f6',
                borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: Math.max(9, fw * 0.04), color: '#3b82f6', fontWeight: 600, textAlign: 'center' }}>
                  📸 {tapPhotoId ? 'Натисніть' : 'Відпустіть'}
                </span>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  // ─── HAS PHOTO: photo underneath, frame on top ───
  return (
    <div
      style={{
        position: 'absolute', left: cx, top: cy, width: fw, height: fh,
        zIndex: frame.zIndex ?? 35,
        pointerEvents: 'none', // wrapper is non-interactive; only photo zone is
        overflow: 'visible',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Photo inside the frame zone — interactive */}
      <div
        style={{
          position: 'absolute',
          left: photoZone.x, top: photoZone.y,
          width: photoZone.w, height: photoZone.h,
          overflow: 'hidden',
          cursor: isCropping ? 'grabbing' : 'grab',
          touchAction: 'none',
          zIndex: 1,
          pointerEvents: 'auto',
          borderRadius: 2,
        }}
        onPointerDown={interactive ? handlePointerDown : undefined}
        onWheel={interactive ? handleWheel : undefined}
        onDragOver={interactive ? (e => { e.preventDefault(); e.stopPropagation(); setIsOver(true); }) : undefined}
        onDragLeave={interactive ? (() => setIsOver(false)) : undefined}
        onDrop={interactive ? handleDrop : undefined}
      >
        <img
          src={photo!.preview}
          alt=""
          draggable={false}
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover',
            objectPosition: `${frame.cropX ?? 50}% ${frame.cropY ?? 50}%`,
            transform: `scale(${frame.zoom ?? 1})`,
            transformOrigin: `${frame.cropX ?? 50}% ${frame.cropY ?? 50}%`,
            userSelect: 'none', display: 'block',
          }}
        />
        {/* Drop overlay for replacing */}
        {isOver && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(59,130,246,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>Замінити фото</span>
          </div>
        )}
        {/* Zoom badge */}
        {(frame.zoom ?? 1) !== 1 && !isCropping && (
          <div style={{ position:'absolute', bottom:4, left:4, background:'rgba(0,0,0,0.6)', borderRadius:10, padding:'2px 6px', zIndex:10, pointerEvents:'none' }}>
            <span style={{ color:'#fff', fontSize:8, fontWeight:700 }}>{Math.round((frame.zoom ?? 1)*100)}%</span>
          </div>
        )}
      </div>

      {/* Frame image on top — pointerEvents: none */}
      {pngDef ? (
        <img src={pngDef.src} alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain', display: 'block',
            pointerEvents: 'none', zIndex: 2,
            opacity: frame.opacity / 100,
          }} />
      ) : svgDef ? (
        <svg width={fw} height={fh}
          style={{
            position: 'absolute', left: 0, top: 0,
            display: 'block', pointerEvents: 'none', zIndex: 2,
            opacity: frame.opacity / 100,
          }}
          dangerouslySetInnerHTML={{ __html: svgDef.render(fw, fh, frame.color, 100) }} />
      ) : null}

      {/* Delete button — on hover, interactive */}
      {isHovered && interactive && !isCropping && (
        <button
          onClick={clearPhoto}
          style={{
            position: 'absolute', top: photoZone.y - 8, right: fw - photoZone.x - photoZone.w - 8,
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10, fontSize: 12, fontWeight: 700, pointerEvents: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >×</button>
      )}

      {/* Crop hint — on hover */}
      {isHovered && interactive && !isCropping && (
        <div style={{
          position: 'absolute',
          bottom: fh - photoZone.y - photoZone.h - 20,
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: '3px 10px', zIndex: 10,
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: '#fff', fontSize: 9, fontWeight: 600 }}>тягніть — кадрувати · скрол — зум</span>
        </div>
      )}
    </div>
  );
}

interface FrameControlsProps {
  frame: FrameConfig;
  onChange: (frame: FrameConfig) => void;
  /** Photo lookup for frame photo preview */
  getPhoto?: (id: string | null | undefined) => { id: string; preview: string } | null;
}

export function FrameControls({ frame, onChange, getPhoto }: FrameControlsProps) {
  const allGroups = [...new Set(FRAMES.map(f => f.group))];
  const allPngGroups = [...new Set(PNG_FRAMES.map(f => f.group))];
  const thumbW = 72, thumbH = 52;

  // Find label from either SVG or PNG frames
  const activeLabel =
    PNG_FRAMES.find(f => f.id === frame.frameId)?.label ||
    FRAMES.find(f => f.id === frame.frameId)?.label ||
    'Рамка';

  // Is active frame a PNG?
  const isPng = !!PNG_FRAMES.find(f => f.id === frame.frameId);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {/* Active frame controls — STICKY at top */}
      {frame.frameId && (
        <div style={{ background:'#f0f3ff', borderRadius:10, padding:10, border:'1px solid #c7d2fe', position:'sticky', top:0, zIndex:5 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#1e2d7d' }}>{activeLabel}</span>
            <button onClick={()=>onChange({...frame,frameId:null})}
              style={{ padding:'3px 10px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff7f7', cursor:'pointer', fontWeight:600, fontSize:10, color:'#ef4444' }}>
              ✕ Прибрати
            </button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {!isPng && (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Колір</div>
                <input type="color" value={frame.color} onChange={e=>onChange({...frame,color:e.target.value})}
                  style={{ width:'100%', height:26, borderRadius:4, border:'1px solid #e2e8f0', cursor:'pointer', padding:1 }}/>
              </div>
            )}
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:10, color:'#64748b' }}>Прозорість</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{frame.opacity}%</span>
              </div>
              <input type="range" min={10} max={100} value={frame.opacity}
                onChange={e=>onChange({...frame,opacity:+e.target.value})}
                style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
            </div>
          </div>
          {/* Scale */}
          <div style={{ marginTop:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, color:'#64748b' }}>Розмір</span>
              <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{Math.round((frame.scale??0.6)*100)}%</span>
            </div>
            <input type="range" min={10} max={200} value={Math.round((frame.scale??0.6)*100)}
              onChange={e=>onChange({...frame, scale: +e.target.value/100})}
              style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
          </div>
          {/* Position */}
          <div style={{ display:'flex', gap:8, marginTop:6 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:10, color:'#64748b' }}>← →</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{frame.x??0}px</span>
              </div>
              <input type="range" min={-500} max={500} value={frame.x??0}
                onChange={e=>onChange({...frame, x: +e.target.value})}
                style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:10, color:'#64748b' }}>↑ ↓</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{frame.y??0}px</span>
              </div>
              <input type="range" min={-500} max={500} value={frame.y??0}
                onChange={e=>onChange({...frame, y: +e.target.value})}
                style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
            </div>
          </div>
          <button onClick={()=>onChange({...frame, scale:0.6, x:0, y:0, zIndex:35})}
            style={{ marginTop:6, width:'100%', padding:'4px 0', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', cursor:'pointer', fontSize:10, color:'#64748b' }}>
            ↺ Скинути позицію
          </button>
          {/* Z-index layer control */}
          <div style={{ display:'flex', gap:4, marginTop:6 }}>
            <button onClick={()=>onChange({...frame, zIndex: Math.max(1, (frame.zIndex??35)-5)})}
              style={{ flex:1, padding:'4px 0', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', cursor:'pointer', fontSize:10, color:'#64748b', fontWeight:600 }}>
              ↓ Назад
            </button>
            <span style={{ display:'flex', alignItems:'center', fontSize:10, fontWeight:700, color:'#1e2d7d', minWidth:30, justifyContent:'center' }}>{frame.zIndex??35}</span>
            <button onClick={()=>onChange({...frame, zIndex: Math.min(99, (frame.zIndex??35)+5)})}
              style={{ flex:1, padding:'4px 0', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', cursor:'pointer', fontSize:10, color:'#64748b', fontWeight:600 }}>
              ↑ Вперед
            </button>
          </div>
          {/* ── Photo inside frame controls ── */}
          <div style={{ marginTop:8, padding:'8px 0 0', borderTop:'1px solid #e2e8f0' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#1e2d7d', marginBottom:6 }}>📸 Фото в рамці</div>
            {frame.photoId && getPhoto?.(frame.photoId) ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <img src={getPhoto(frame.photoId)!.preview} alt=""
                    style={{ width:40, height:40, objectFit:'cover', borderRadius:4, border:'1px solid #e2e8f0' }}/>
                  <button onClick={()=>onChange({...frame, photoId:null, cropX:50, cropY:50, zoom:1})}
                    style={{ padding:'3px 10px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff7f7', cursor:'pointer', fontWeight:600, fontSize:10, color:'#ef4444' }}>
                    ✕ Прибрати фото
                  </button>
                </div>
                {/* Zoom control */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:10, color:'#64748b' }}>Масштаб фото</span>
                    <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{Math.round((frame.zoom??1)*100)}%</span>
                  </div>
                  <input type="range" min={100} max={400} value={Math.round((frame.zoom??1)*100)}
                    onChange={e=>onChange({...frame, zoom: +e.target.value/100})}
                    style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
                </div>
                {/* Crop position */}
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:10, color:'#64748b' }}>← →</span>
                      <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{Math.round(frame.cropX??50)}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={Math.round(frame.cropX??50)}
                      onChange={e=>onChange({...frame, cropX: +e.target.value})}
                      style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:10, color:'#64748b' }}>↑ ↓</span>
                      <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{Math.round(frame.cropY??50)}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={Math.round(frame.cropY??50)}
                      onChange={e=>onChange({...frame, cropY: +e.target.value})}
                      style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
                  </div>
                </div>
                <button onClick={()=>onChange({...frame, cropX:50, cropY:50, zoom:1})}
                  style={{ width:'100%', padding:'4px 0', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', cursor:'pointer', fontSize:10, color:'#64748b' }}>
                  ↺ Скинути кадрування
                </button>
              </div>
            ) : (
              <div style={{ fontSize:10, color:'#94a3b8', fontStyle:'italic', textAlign:'center', padding:'8px 0' }}>
                Перетягніть фото на рамку на сторінці
              </div>
            )}
          </div>
        </div>
      )}

      {/* PNG frames — grouped */}
      {allPngGroups.map(group => (
        <div key={group}>
          <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>{group}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            {PNG_FRAMES.filter(f=>f.group===group).map(f => {
              const active = frame.frameId===f.id;
              return (
                <button key={f.id} onClick={() => onChange(active ? { ...frame, frameId: null } : { ...DEFAULT_FRAME, frameId: f.id, color: frame.color })}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 4px', border: active?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background: active?'#f0f3ff':'#fff', cursor:'pointer' }}>
                  <div style={{ width:thumbW, height:thumbH, position:'relative', overflow:'hidden', borderRadius:4, background:'#f8fafc' }}>
                    <img src={f.src} alt={f.label}
                      style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                  </div>
                  <span style={{ fontSize:9, fontWeight:600, color: active?'#1e2d7d':'#64748b', lineHeight:1.2, textAlign:'center' }}>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* SVG frames — grouped */}
      {allGroups.map(group => (
        <div key={group}>
          <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>{group}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            {FRAMES.filter(f=>f.group===group).map(f => {
              const active = frame.frameId===f.id;
              const previewColor = active ? '#1e2d7d' : '#64748b';
              const svgContent = f.render(thumbW, thumbH, previewColor, active ? 100 : 60);
              return (
                <button key={f.id} onClick={() => onChange(active ? { ...frame, frameId: null } : { ...DEFAULT_FRAME, frameId: f.id, color: frame.color })}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 4px', border: active?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background: active?'#f0f3ff':'#fff', cursor:'pointer' }}>
                  <svg viewBox={`0 0 ${thumbW} ${thumbH}`} width={thumbW} height={thumbH} dangerouslySetInnerHTML={{ __html: svgContent }}/>
                  <span style={{ fontSize:9, fontWeight:600, color: active?'#1e2d7d':'#64748b', lineHeight:1.2 }}>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
