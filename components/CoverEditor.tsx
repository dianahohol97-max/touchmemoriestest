'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type CoverMaterial = 'printed' | 'leatherette' | 'fabric';
export type DecoType = 'none' | 'acryl' | 'photovstavka' | 'metal' | 'flex' | 'graviruvannya';

// ─── Cover colors from Supabase cover_colors table ───────────────────────────
// Шкірзам (cover_type_id: 08aaacb3)
export const LEATHERETTE_COLORS: Record<string, string> = {
  'Білий':              '#F5F5F0',
  'Бежевий':            '#D9C8B0',
  'Пісочний':           '#D4A76A',
  'Рудий':              '#C8844E',
  'Бордо темний':       '#7A2838',
  'Золотистий':         '#C4A83A',
  'Теракотовий':        '#C25A3C',
  'Жовтий':             '#F0B820',
  'Рожевий ніжний':     '#E8B4B8',
  'Фуксія':             '#D84080',
  'Червоний насичений': '#A01030',
  'Коричневий':         '#8E5038',
  'Вишневий':           '#7A2020',
  'Марсала':            '#6E2840',
  'Графітовий темний':  '#3A3038',
  'Фіолетовий яскравий':'#8030A0',
  'Фіолетовий темний':  '#502060',
  'Бірюзовий':          '#4E9090',
  'Оливковий':          '#A0A030',
  'Темно-зелений':      '#1E3028',
  'Бірюзовий яскравий': '#00B0B0',
  'Блакитний яскравий': '#0088D0',
  'Темно-синій':        '#1A2040',
  'Чорний':             '#1A1A1A',
  'Персиковий':         '#E8A8A0',
};

// Тканина (cover_type_id: 463df25b)
export const FABRIC_COLORS: Record<string, string> = {
  'Бежевий/пісочний':   '#C4AA88',
  'Теракотовий/цегляний':'#A04838',
  'Фуксія/пурпурний':   '#B838A0',
  'Фіолетовий темний':  '#582050',
  'Марсала/бордо':      '#602838',
  'Коричневий':         '#6E4830',
  'Сірий/графітовий':   '#586058',
  'Червоний яскравий':  '#C02030',
  'Оливковий/зелений':  '#A0A020',
};

// ─── Decoration variants from Supabase decoration_variants ───────────────────
// Variants per size (size value from product options)
export const ACRYLIC_VARIANTS: Record<string, string[]> = {
  '20x20': ['100×100 мм', 'Ø145 мм'],
  '25x25': ['100×100 мм', 'Ø145 мм'],
  '20x30': ['100×100 мм', 'Ø145 мм'],
  '30x20': ['100×100 мм', 'Ø145 мм'],
  '30x30': ['100×100 мм', 'Ø145 мм', '290×100 мм', '215×290 мм'],
};

export const PHOTO_INSERT_VARIANTS: Record<string, string[]> = {
  '20x20': ['100×100 мм'],
  '25x25': ['100×100 мм'],
  '20x30': ['100×100 мм'],
  '30x20': ['100×100 мм'],
  '30x30': ['197×197 мм', '100×100 мм'],
};

export const METAL_VARIANTS: Record<string, string[]> = {
  '20x20': ['60×60 золотий', '60×60 срібний', '90×50 золотий', '90×50 срібний'],
  '25x25': ['60×60 золотий', '60×60 срібний', '90×50 золотий', '90×50 срібний'],
  '20x30': ['60×60 золотий', '60×60 срібний', '90×50 золотий', '90×50 срібний'],
  '30x20': ['60×60 золотий', '60×60 срібний', '90×50 золотий', '90×50 срібний', '250×70 золотий', '250×70 срібний'],
  '30x30': ['60×60 золотий', '60×60 срібний', '90×50 золотий', '90×50 срібний', '250×70 золотий', '250×70 срібний'],
};

// Parse variant name to get dimensions in mm
function parseVariantDims(variant: string): { w: number; h: number; round: boolean } {
  if (variant.startsWith('Ø')) {
    const d = parseInt(variant.replace('Ø','').replace(' мм','').replace(' золотий','').replace(' срібний',''));
    return { w: d, h: d, round: true };
  }
  const match = variant.match(/(\d+)[×x](\d+)/);
  if (match) return { w: parseInt(match[1]), h: parseInt(match[2]), round: false };
  return { w: 100, h: 100, round: false };
}

// Is metal gold?
function isGold(variant: string) { return variant.includes('золот'); }

// ─── Darken hex ───────────────────────────────────────────────────────────────
function darkenHex(hex: string, amount = 45): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xFF) - amount);
  const b = Math.max(0, (n & 0xFF) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface CoverConfig {
  coverMaterial: CoverMaterial;
  coverColorName: string;
  decoType: DecoType;
  decoVariant: string; // e.g. "60×60 золотий", "100×100 мм", "Ø145 мм"
  photoId: string | null;
  decoText: string;
}

interface CoverEditorProps {
  canvasW: number;
  canvasH: number;
  sizeValue: string; // e.g. "20x20", "30x30"
  config: CoverConfig;
  photos: { id: string; preview: string }[];
  onChange: (patch: Partial<CoverConfig>) => void;
}

export function CoverEditor({ canvasW, canvasH, sizeValue, config, photos, onChange }: CoverEditorProps) {
  const [dragOver, setDragOver] = useState(false);

  const isSoft = config.coverMaterial !== 'printed';

  // Get bg color
  const bgColor = (() => {
    if (!isSoft) return '#fff';
    const name = config.coverColorName;
    if (config.coverMaterial === 'leatherette') return LEATHERETTE_COLORS[name] ?? '#D9C8B0';
    if (config.coverMaterial === 'fabric') return FABRIC_COLORS[name] ?? '#C4AA88';
    return '#D9C8B0';
  })();

  // Texture
  const texture = config.coverMaterial === 'leatherette'
    ? 'repeating-linear-gradient(45deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 7px),repeating-linear-gradient(-45deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 7px)'
    : config.coverMaterial === 'fabric'
    ? 'repeating-linear-gradient(90deg,rgba(255,255,255,0.06) 0px,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 4px),repeating-linear-gradient(0deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 4px)'
    : 'none';

  // Scale: canvas = page width in mm. For 20cm page, canvasW = 200mm equivalent
  // sizeValue like "20x20" => page width = 20cm = 200mm
  const pageWidthMM = parseInt(sizeValue.split('x')[0]) * 10; // cm to mm
  const scale = canvasW / pageWidthMM;

  // Deco box
  const dims = parseVariantDims(config.decoVariant || '100×100 мм');
  const boxW = dims.w * scale;
  const boxH = dims.h * scale;
  const boxL = (canvasW - boxW) / 2;
  const boxT = (canvasH - boxH) / 2;

  const photo = photos.find(p => p.id === config.photoId) ?? null;
  const goldGradient = 'linear-gradient(135deg,#9A7000 0%,#FFD700 40%,#D4AF37 55%,#8B6000 100%)';
  const silverGradient = 'linear-gradient(135deg,#5A5A5A 0%,#E8E8E8 40%,#C8C8C8 55%,#4A4A4A 100%)';

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) onChange({ photoId: id });
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{ position: 'relative', width: canvasW, height: canvasH, borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', flexShrink: 0, background: bgColor }}
    >
      {/* Texture overlay */}
      {isSoft && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: texture, pointerEvents: 'none', zIndex: 1 }} />
      )}

      {/* ── ДРУКОВАНА ── */}
      {!isSoft && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: photo ? 'transparent' : (dragOver ? '#dbeafe' : '#f1f5f9'), display: 'flex', alignItems: 'center', justifyContent: 'center', border: dragOver ? '2px dashed #1e2d7d' : 'none' }}>
          {photo
            ? <img src={photo.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
            : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
                <ImageIcon size={32} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Перетягніть фото на обкладинку</span>
              </div>
          }
        </div>
      )}

      {/* ── М'ЯКА ОБКЛАДИНКА ── */}
      {isSoft && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>

          {/* БЕЗ ОЗДОБЛЕННЯ */}
          {config.decoType === 'none' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                {config.coverColorName}
              </span>
            </div>
          )}

          {/* АКРИЛ */}
          {config.decoType === 'acryl' && (
            <div style={{ position: 'absolute', left: boxL, top: boxT, width: boxW, height: boxH, borderRadius: dims.round ? '50%' : 5, overflow: 'hidden', border: `2px solid rgba(255,255,255,${dragOver ? 0.9 : 0.5})`, boxShadow: '0 2px 16px rgba(0,0,0,0.25),inset 0 1px 2px rgba(255,255,255,0.3)', background: photo ? 'transparent' : 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {photo ? (
                <>
                  <img src={photo.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 50%)', pointerEvents: 'none' }} />
                  <button onClick={() => onChange({ photoId: null })} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)' }}>
                  <ImageIcon size={22} />
                  <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Акрил<br />{config.decoVariant}</span>
                </div>
              )}
            </div>
          )}

          {/* ФОТОВСТАВКА */}
          {config.decoType === 'photovstavka' && (
            <div style={{ position: 'absolute', left: boxL, top: boxT, width: boxW, height: boxH, borderRadius: 3, overflow: 'hidden', border: `2px dashed rgba(255,255,255,${dragOver ? 0.9 : 0.5})`, background: photo ? 'transparent' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {photo ? (
                <>
                  <img src={photo.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                  <button onClick={() => onChange({ photoId: null })} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)' }}>
                  <ImageIcon size={22} />
                  <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Фотовставка<br />{config.decoVariant}</span>
                </div>
              )}
            </div>
          )}

          {/* МЕТАЛЕВА ВСТАВКА */}
          {config.decoType === 'metal' && (
            <div style={{ position: 'absolute', left: boxL, top: boxT, width: boxW, height: boxH, borderRadius: dims.round ? '50%' : 3, background: isGold(config.decoVariant) ? goldGradient : silverGradient, boxShadow: '0 3px 14px rgba(0,0,0,0.4),inset 0 1px 1px rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ decoText: e.currentTarget.textContent || '' })}
                style={{ color: isGold(config.decoVariant) ? '#3D2800' : '#1A1A1A', fontSize: Math.max(10, Math.min(boxW / 8, 22)) + 'px', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.05em', outline: 'none', cursor: 'text', textAlign: 'center', padding: '0 6px', maxWidth: '90%', wordBreak: 'break-word' }}
              >{config.decoText || 'Ваш текст'}</span>
            </div>
          )}

          {/* ФЛЕКС */}
          {config.decoType === 'flex' && (
            <div style={{ position: 'absolute', left: canvasW * 0.1, top: canvasH * 0.42, width: canvasW * 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ decoText: e.currentTarget.textContent || '' })}
                style={{ color: config.decoVariant?.includes('срібл') ? '#C8C8C8' : config.decoVariant?.includes('біл') ? '#FFFFFF' : config.decoVariant?.includes('чорн') ? '#1A1A1A' : '#D4AF37', textShadow: '0 0 8px rgba(0,0,0,0.3)', fontSize: Math.max(16, canvasW / 9) + 'px', fontFamily: 'Playfair Display,Georgia,serif', fontWeight: 700, letterSpacing: '0.04em', outline: 'none', cursor: 'text', textAlign: 'center', userSelect: 'text' }}
              >{config.decoText || 'Ваш текст'}</span>
            </div>
          )}

          {/* ГРАВІРУВАННЯ */}
          {config.decoType === 'graviruvannya' && (
            <div style={{ position: 'absolute', left: canvasW * 0.1, top: canvasH * 0.42, width: canvasW * 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ decoText: e.currentTarget.textContent || '' })}
                style={{ color: darkenHex(bgColor, 50), textShadow: `0 1px 0 ${darkenHex(bgColor, 80)},0 -1px 0 rgba(255,255,255,0.1)`, fontSize: Math.max(16, canvasW / 9) + 'px', fontFamily: 'Playfair Display,Georgia,serif', fontWeight: 600, letterSpacing: '0.06em', outline: 'none', cursor: 'text', textAlign: 'center', userSelect: 'text' }}
              >{config.decoText || 'Ваш текст'}</span>
            </div>
          )}

        </div>
      )}

      {/* Label bottom right */}
      {isSoft && config.decoType !== 'none' && config.decoVariant && (
        <div style={{ position: 'absolute', bottom: 5, right: 7, fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, zIndex: 3, letterSpacing: '0.05em' }}>
          {config.decoVariant}
        </div>
      )}
    </div>
  );
}
