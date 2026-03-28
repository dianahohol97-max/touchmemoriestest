'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';

type CoverMaterial = 'printed' | 'velour' | 'leatherette' | 'fabric';
type DecoType = 'none' | 'acrylic' | 'photo_insert' | 'flex' | 'metal' | 'engraving';
type AcrylSize = '100x100' | 'circle145';
type FlexColor = 'gold' | 'silver' | 'white' | 'black';
type MetalColor = 'gold' | 'silver' | 'black';

// Velour colors matching the product page
const VELOUR_COLORS: Record<string, string> = {
  'кремовий':     '#F2E6D0',
  'бежевий':      '#D9C4A0',
  'білий':        '#F8F6F1',
  'чорний':       '#1C1C1C',
  'темно-синій':  '#1B2A4A',
  'бордо':        '#5C1A28',
  'сірий':        '#7A7A7A',
  'пудровий':     '#E8C5BF',
  'зелений':      '#2B5240',
  'коричневий':   '#614020',
  'темно-коричневий': '#3D2410',
};

const FLEX_OPTIONS: { id: FlexColor; label: string; hex: string; textShadow?: string }[] = [
  { id: 'gold',   label: 'Золото',  hex: '#D4AF37', textShadow: '0 0 8px rgba(212,175,55,0.6)' },
  { id: 'silver', label: 'Срібло',  hex: '#C0C0C0', textShadow: '0 0 6px rgba(192,192,192,0.5)' },
  { id: 'white',  label: 'Білий',   hex: '#FFFFFF', textShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  { id: 'black',  label: 'Чорний',  hex: '#1A1A1A', textShadow: 'none' },
];

const METAL_OPTIONS: { id: MetalColor; label: string; gradient: string; textColor: string }[] = [
  { id: 'gold',   label: 'Золото',  gradient: 'linear-gradient(135deg, #9A6F00 0%, #FFD700 45%, #D4AF37 55%, #8B6000 100%)', textColor: '#3D2A00' },
  { id: 'silver', label: 'Срібло',  gradient: 'linear-gradient(135deg, #5A5A5A 0%, #E8E8E8 45%, #C8C8C8 55%, #4A4A4A 100%)', textColor: '#1A1A1A' },
  { id: 'black',  label: 'Чорне',   gradient: 'linear-gradient(135deg, #0A0A0A 0%, #3A3A3A 45%, #2A2A2A 55%, #0A0A0A 100%)', textColor: '#C0C0C0' },
];

export interface CoverConfig {
  coverMaterial: CoverMaterial;
  coverColorName: string;
  decoType: DecoType;
  acrylSize?: AcrylSize;
  flexColor?: FlexColor;
  metalColor?: MetalColor;
  photoId?: string | null;
  decoText?: string;
}

interface CoverEditorProps {
  canvasW: number;
  canvasH: number;
  config: CoverConfig;
  photos: { id: string; preview: string }[];
  onChange: (cfg: Partial<CoverConfig>) => void;
}

function darkenHex(hex: string, amount = 40): string {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xFF) - amount);
  const b = Math.max(0, (n & 0xFF) - amount);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

export function CoverEditor({ canvasW, canvasH, config, photos, onChange }: CoverEditorProps) {
  const [dragOver, setDragOver] = useState(false);

  const isSoft = config.coverMaterial !== 'printed';
  const bgColor = isSoft ? (VELOUR_COLORS[config.coverColorName?.toLowerCase()] ?? '#F2E6D0') : '#fff';

  // Velour texture overlay
  const textureOverlay = config.coverMaterial === 'velour'
    ? 'radial-gradient(ellipse at 25% 25%, rgba(255,255,255,0.14) 0%, transparent 50%), radial-gradient(ellipse at 75% 75%, rgba(0,0,0,0.1) 0%, transparent 50%)'
    : config.coverMaterial === 'leatherette'
    ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 7px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 7px)'
    : 'none';

  // Deco box dimensions
  const getDecoBox = () => {
    const scale = canvasW / 200; // 200mm = one page width
    if (config.decoType === 'acrylic' || config.decoType === 'photo_insert') {
      if (config.acrylSize === 'circle145') {
        const d = 145 * scale;
        return { w: d, h: d, round: true };
      }
      // 100x100
      const s = 100 * scale;
      return { w: s, h: s, round: false };
    }
    if (config.decoType === 'flex' || config.decoType === 'engraving') {
      return { w: canvasW * 0.7, h: canvasH * 0.12, round: false };
    }
    if (config.decoType === 'metal') {
      return { w: canvasW * 0.6, h: canvasH * 0.18, round: false };
    }
    return { w: canvasW * 0.5, h: canvasH * 0.3, round: false };
  };

  const photo = photos.find(p => p.id === config.photoId) ?? null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) onChange({ photoId: id });
  };

  const box = getDecoBox();
  const boxLeft = (canvasW - box.w) / 2;
  const boxTop = (canvasH - box.h) / 2;

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        width: canvasW, height: canvasH,
        borderRadius: 4, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        flexShrink: 0,
        background: bgColor,
      }}
    >
      {/* Texture */}
      {isSoft && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: textureOverlay, pointerEvents: 'none', zIndex: 1 }} />
      )}

      {/* ── ДРУКОВАНА: повне фото ── */}
      {!isSoft && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          {photo ? (
            <img src={photo.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#94a3b8', background: dragOver ? '#dbeafe' : '#f1f5f9', border: dragOver ? '2px dashed #1e2d7d' : 'none' }}>
              <ImageIcon size={32} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Перетягніть фото на обкладинку</span>
            </div>
          )}
        </div>
      )}

      {/* ── М'ЯКА ОБКЛАДИНКА ── */}
      {isSoft && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          {/* БЕЗ ОЗДОБЛЕННЯ */}
          {config.decoType === 'none' && (
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {config.coverColorName || 'Без оздоблення'}
            </span>
          )}

          {/* АКРИЛ або ФОТОВСТАВКА */}
          {(config.decoType === 'acrylic' || config.decoType === 'photo_insert') && (
            <div
              style={{
                position: 'absolute',
                left: boxLeft, top: boxTop,
                width: box.w, height: box.h,
                borderRadius: box.round ? '50%' : 4,
                border: `2px solid rgba(255,255,255,${dragOver ? '0.9' : '0.5'})`,
                overflow: 'hidden',
                background: photo ? 'transparent' : 'rgba(255,255,255,0.12)',
                boxShadow: config.decoType === 'acrylic' ? '0 2px 12px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {photo ? (
                <>
                  <img src={photo.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                  {/* Acrylic glass effect */}
                  {config.decoType === 'acrylic' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)', pointerEvents: 'none' }} />
                  )}
                  <button
                    onClick={() => onChange({ photoId: null })}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    ×
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)' }}>
                  <ImageIcon size={22} />
                  <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center' }}>
                    {config.decoType === 'acrylic' ? 'Акрил' : 'Фотовставка'}
                    <br />
                    {config.acrylSize === 'circle145' ? 'Ø145 мм' : '100×100 мм'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ФЛЕКС */}
          {config.decoType === 'flex' && (() => {
            const fc = FLEX_OPTIONS.find(f => f.id === (config.flexColor || 'gold'))!;
            return (
              <div style={{ position: 'absolute', left: boxLeft, top: boxTop, width: box.w, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => onChange({ decoText: e.currentTarget.textContent || '' })}
                  style={{
                    color: fc.hex,
                    textShadow: fc.textShadow,
                    fontSize: Math.max(16, canvasW / 9) + 'px',
                    fontFamily: 'Playfair Display, Georgia, serif',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    outline: 'none',
                    cursor: 'text',
                    textAlign: 'center',
                    minWidth: 40,
                    userSelect: 'text',
                  }}
                >
                  {config.decoText || 'Ваш текст'}
                </span>
              </div>
            );
          })()}

          {/* МЕТАЛЕВА ВСТАВКА */}
          {config.decoType === 'metal' && (() => {
            const mc = METAL_OPTIONS.find(m => m.id === (config.metalColor || 'silver'))!;
            return (
              <div style={{
                position: 'absolute', left: boxLeft, top: boxTop,
                width: box.w, height: box.h,
                borderRadius: 3,
                background: mc.gradient,
                boxShadow: '0 3px 12px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => onChange({ decoText: e.currentTarget.textContent || '' })}
                  style={{ color: mc.textColor, fontSize: Math.max(13, canvasW / 11) + 'px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.05em', outline: 'none', cursor: 'text', textAlign: 'center', padding: '0 10px' }}
                >
                  {config.decoText || 'Ваш текст'}
                </span>
              </div>
            );
          })()}

          {/* ГРАВІРУВАННЯ */}
          {config.decoType === 'engraving' && (
            <div style={{ position: 'absolute', left: boxLeft, top: boxTop, width: box.w, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ decoText: e.currentTarget.textContent || '' })}
                style={{
                  color: darkenHex(bgColor, 50),
                  fontSize: Math.max(16, canvasW / 9) + 'px',
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  outline: 'none',
                  cursor: 'text',
                  textAlign: 'center',
                  textShadow: `0 1px 0 ${darkenHex(bgColor, 80)}, 0 -1px 0 rgba(255,255,255,0.15)`,
                  userSelect: 'text',
                }}
              >
                {config.decoText || 'Ваш текст'}
              </span>
            </div>
          )}

        </div>
      )}

      {/* Size label */}
      {isSoft && config.decoType !== 'none' && (
        <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600, zIndex: 3, letterSpacing: '0.05em' }}>
          {config.decoType === 'acrylic' && (config.acrylSize === 'circle145' ? 'Акрил Ø145мм' : 'Акрил 100×100мм')}
          {config.decoType === 'photo_insert' && 'Фотовставка'}
          {config.decoType === 'flex' && 'Флекс'}
          {config.decoType === 'metal' && 'Металева вставка'}
          {config.decoType === 'engraving' && 'Гравірування'}
        </div>
      )}
    </div>
  );
}
