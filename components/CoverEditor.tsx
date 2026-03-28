'use client';

import { useState, useRef } from 'react';
import { ImageIcon, Type, Trash2 } from 'lucide-react';

// Cover material types
type CoverType = 'printed' | 'velour' | 'leatherette' | 'fabric';
type DecoType = 'none' | 'acrylic' | 'photo_insert' | 'flex' | 'metal' | 'engraving';
type FlexColor = 'gold' | 'silver' | 'white' | 'black';
type MetalColor = 'gold' | 'silver' | 'black';

// Velour color map
const VELOUR_COLORS: Record<string, string> = {
  'кремовий':  '#F5ECD7',
  'бежевий':   '#E8D5B0',
  'білий':     '#F8F8F5',
  'чорний':    '#1A1A1A',
  'темно-синій':'#1B2A4A',
  'бордо':     '#6B1A2A',
  'сірий':     '#8A8A8A',
  'пудровий':  '#E8C5C0',
  'зелений':   '#2D5A3D',
  'коричневий':'#6B4423',
};

const LEATHERETTE_COLORS: Record<string, string> = {
  'чорний':    '#1A1A1A',
  'коричневий':'#5C3317',
  'бордо':     '#6B1A2A',
  'білий':     '#F0EDE8',
  'темно-синій':'#1B2A4A',
};

const FLEX_COLORS: Record<FlexColor, { label: string; hex: string }> = {
  gold:   { label: 'Золото',  hex: '#D4AF37' },
  silver: { label: 'Срібло',  hex: '#C0C0C0' },
  white:  { label: 'Білий',   hex: '#FFFFFF' },
  black:  { label: 'Чорний',  hex: '#1A1A1A' },
};

const METAL_COLORS: Record<MetalColor, { label: string; gradient: string }> = {
  gold:   { label: 'Золото',  gradient: 'linear-gradient(135deg, #B8860B, #FFD700, #B8860B)' },
  silver: { label: 'Срібло',  gradient: 'linear-gradient(135deg, #808080, #E8E8E8, #808080)' },
  black:  { label: 'Чорне',   gradient: 'linear-gradient(135deg, #1A1A1A, #444, #1A1A1A)' },
};

interface CoverConfig {
  coverType: CoverType;
  coverColorName: string;
  decoType: DecoType;
  decoSize?: string;       // e.g. "145x100"
  flexColor?: FlexColor;
  metalColor?: MetalColor;
  photoId?: string | null;
  flexText?: string;
  metalText?: string;
  engravingText?: string;
}

interface CoverEditorProps {
  canvasW: number;
  canvasH: number;
  config: CoverConfig;
  photos: { id: string; preview: string }[];
  onChange: (cfg: CoverConfig) => void;
}

export function CoverEditor({ canvasW, canvasH, config, photos, onChange }: CoverEditorProps) {
  const [dragOver, setDragOver] = useState(false);
  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);

  const isSoft = ['velour','leatherette','fabric'].includes(config.coverType);
  const bgColor = isSoft
    ? (config.coverType === 'velour' ? VELOUR_COLORS[config.coverColorName] : LEATHERETTE_COLORS[config.coverColorName]) ?? '#E8D5B0'
    : '#f0f0f0';

  // Deco box size relative to canvas
  const decoSizePx = (() => {
    if (!config.decoSize) return { w: canvasW * 0.5, h: canvasH * 0.35 };
    const [wMM, hMM] = config.decoSize.split('x').map(Number);
    // scale: canvas represents ~200mm wide page
    const scale = canvasW / 200;
    return { w: wMM * scale, h: hMM * scale };
  })();

  const decoX = (canvasW - decoSizePx.w) / 2;
  const decoY = (canvasH - decoSizePx.h) / 2;

  const photo = photos.find(p => p.id === config.photoId);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData('photoId') || draggingPhotoId;
    if (id) onChange({ ...config, photoId: id });
  };

  // Texture overlay for velour
  const textureStyle: React.CSSProperties = config.coverType === 'velour'
    ? { backgroundImage: `radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 60%), linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.08) 100%)` }
    : config.coverType === 'leatherette'
    ? { backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 8px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 8px)` }
    : {};

  return (
    <div
      style={{ position: 'relative', width: canvasW, height: canvasH, borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', flexShrink: 0, background: bgColor, ...textureStyle }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Printed cover — full photo */}
      {config.coverType === 'printed' && (
        <div style={{ position: 'absolute', inset: 0, background: photo ? 'transparent' : '#f1f5f9', border: dragOver ? '3px dashed #1e2d7d' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photo ? (
            <img src={photo.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
              <ImageIcon size={32} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Перетягніть фото на обкладинку</span>
            </div>
          )}
        </div>
      )}

      {/* Soft cover — colored background */}
      {isSoft && (
        <>
          {/* No deco */}
          {config.decoType === 'none' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600 }}>
              Без оздоблення
            </div>
          )}

          {/* Acrylic / Photo insert */}
          {(config.decoType === 'acrylic' || config.decoType === 'photo_insert') && (
            <div
              style={{ position: 'absolute', left: decoX, top: decoY, width: decoSizePx.w, height: decoSizePx.h, border: dragOver ? '3px dashed #1e2d7d' : '2px solid rgba(255,255,255,0.6)', borderRadius: 4, overflow: 'hidden', background: photo ? 'transparent' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              {photo ? (
                <>
                  <img src={photo.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                  {config.decoType === 'acrylic' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(220,240,255,0.15)', backdropFilter: 'blur(0.5px)', pointerEvents: 'none' }} />
                  )}
                  <button onClick={() => onChange({ ...config, photoId: null })}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)' }}>
                  <ImageIcon size={24} />
                  <span style={{ fontSize: 10, fontWeight: 600, textAlign: 'center' }}>
                    {config.decoType === 'acrylic' ? 'Акрил' : 'Фотовставка'}<br />
                    {config.decoSize || ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Flex */}
          {config.decoType === 'flex' && (
            <div style={{ position: 'absolute', left: decoX, top: decoY, width: decoSizePx.w, height: decoSizePx.h / 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ ...config, flexText: e.currentTarget.textContent || '' })}
                style={{ color: FLEX_COLORS[config.flexColor || 'gold'].hex, fontSize: Math.max(14, decoSizePx.w / 10), fontFamily: 'Playfair Display, serif', fontWeight: 700, textShadow: config.flexColor === 'gold' || config.flexColor === 'silver' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none', outline: 'none', cursor: 'text', textAlign: 'center', minWidth: 40 }}
              >
                {config.flexText || 'Ваш текст'}
              </span>
            </div>
          )}

          {/* Metal insert */}
          {config.decoType === 'metal' && (
            <div style={{ position: 'absolute', left: decoX, top: decoY, width: decoSizePx.w, height: decoSizePx.h * 0.6, borderRadius: 4, background: METAL_COLORS[config.metalColor || 'silver'].gradient, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ ...config, metalText: e.currentTarget.textContent || '' })}
                style={{ color: config.metalColor === 'gold' ? '#5C3A00' : config.metalColor === 'silver' ? '#2A2A2A' : '#E0E0E0', fontSize: Math.max(12, decoSizePx.w / 12), fontFamily: 'Montserrat, sans-serif', fontWeight: 700, outline: 'none', cursor: 'text', textAlign: 'center', padding: '0 8px' }}
              >
                {config.metalText || 'Ваш текст'}
              </span>
            </div>
          )}

          {/* Engraving */}
          {config.decoType === 'engraving' && (
            <div style={{ position: 'absolute', left: decoX, top: decoY, width: decoSizePx.w, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ ...config, engravingText: e.currentTarget.textContent || '' })}
                style={{ color: adjustColor(bgColor, -40), fontSize: Math.max(14, decoSizePx.w / 10), fontFamily: 'Playfair Display, serif', fontWeight: 600, outline: 'none', cursor: 'text', textAlign: 'center' }}
              >
                {config.engravingText || 'Ваш текст'}
              </span>
            </div>
          )}
        </>
      )}

      {/* Size label */}
      {isSoft && config.decoType !== 'none' && config.decoSize && (
        <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
          {config.decoSize} мм
        </div>
      )}
    </div>
  );
}

// Darken hex color by amount
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
