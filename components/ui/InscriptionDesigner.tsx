'use client';

import { useEffect } from 'react';
import InscriptionExamples from '@/components/ui/InscriptionExamples';

// Personalised cover inscription that the customer designs themselves:
// turn it on, type the text, pick the foil colour, font (same palette as the
// photobook editor, minus the too-thin ones) and size. Everything is written
// back into customProductOptions so the price (+price) and the order line pick
// it up. A live preview shows the text in the chosen font + foil colour.
//
// Config can be overridden per product via the DB option, e.g.
//   { "name":"Напис на обкладинці", "type":"inscription", "price":180 }

export interface InscriptionConfig {
  price?: number;
  fonts?: string[];
  sizes?: { label: string; px: number }[];
  colors?: { label: string; hex: string }[];
  maxLength?: number;
}

const DEFAULT_FONTS = ['Marck Script', 'Montserrat', 'Philosopher', 'Lobster', 'Pacifico', 'Rubik', 'Nunito', 'Ubuntu'];
const DEFAULT_SIZES = [
  { label: 'Маленький', px: 20 },
  { label: 'Середній', px: 28 },
  { label: 'Великий', px: 38 },
];
const DEFAULT_COLORS = [
  { label: 'Золотий', hex: '#C9A24B' },
  { label: 'Срібний', hex: '#C7CBD1' },
  { label: 'Білий', hex: '#FFFFFF' },
  { label: 'Чорний', hex: '#1A1A1A' },
];

// Keys written into customProductOptions (also read by price calc + cart line).
export const INSCRIPTION_KEYS = {
  on: 'Напис',
  text: 'Текст напису',
  font: 'Шрифт напису',
  size: 'Розмір напису',
  color: 'Колір напису',
};

export default function InscriptionDesigner({
  config,
  values,
  onChange,
  previewBg = '#6f675c',
}: {
  config?: InscriptionConfig;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  previewBg?: string;
}) {
  const price = Number(config?.price ?? 180);
  const fonts = config?.fonts?.length ? config.fonts : DEFAULT_FONTS;
  const sizes = config?.sizes?.length ? config.sizes : DEFAULT_SIZES;
  const colors = config?.colors?.length ? config.colors : DEFAULT_COLORS;
  const maxLength = Number(config?.maxLength ?? 60);

  const on = values[INSCRIPTION_KEYS.on] === 'yes';
  const text = values[INSCRIPTION_KEYS.text] || '';
  const font = values[INSCRIPTION_KEYS.font] || fonts[0];
  const sizeLabel = values[INSCRIPTION_KEYS.size] || sizes[1]?.label || sizes[0].label;
  const colorLabel = values[INSCRIPTION_KEYS.color] || colors[0].label;

  const sizePx = (sizes.find(s => s.label === sizeLabel) || sizes[1] || sizes[0]).px;
  const colorHex = (colors.find(c => c.label === colorLabel) || colors[0]).hex;

  // Load the preview fonts (Google Fonts) once. The site already serves Google
  // Fonts globally, so the host is allowed; this just guarantees these specific
  // families are available for the live preview on the catalog page.
  useEffect(() => {
    const id = 'inscription-fonts';
    if (document.getElementById(id)) return;
    const families = DEFAULT_FONTS.concat(fonts)
      .filter((v, i, a) => a.indexOf(v) === i)
      .map(f => `family=${f.replace(/ /g, '+')}:wght@400;600;700`)
      .join('&');
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }, [fonts]);

  return (
    <div style={{ marginTop: 4 }}>
      {/* Examples gallery — shown immediately so customers see what an inscription looks like */}
      <InscriptionExamples />
      {/* Toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', border: on ? '2px solid #1e2d7d' : '1px solid #d1d5db', borderRadius: 10, background: on ? '#f0f3ff' : 'white' }}>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(INSCRIPTION_KEYS.on, e.target.checked ? 'yes' : '')}
          style={{ width: 18, height: 18, accentColor: '#1e2d7d' }}
        />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e2d7d' }}>
          Додати персоналізований напис на обкладинку
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#1e2d7d' }}>+{price} ₴</span>
      </label>

      {on && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Text */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 6 }}>
              Текст напису <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <input
              type="text"
              value={text}
              maxLength={maxLength}
              placeholder="Напр.: Родина Петренків · 2026"
              onChange={(e) => onChange(INSCRIPTION_KEYS.text, e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
            />
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>До {maxLength} символів.</p>
          </div>

          {/* Font */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 6 }}>Шрифт</label>
            <select
              value={font}
              onChange={(e) => onChange(INSCRIPTION_KEYS.font, e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: `'${font}', sans-serif` }}
            >
              {fonts.map(f => (
                <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>
              ))}
            </select>
          </div>

          {/* Size */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 6 }}>Розмір</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sizes.map(s => {
                const sel = s.label === sizeLabel;
                return (
                  <button key={s.label} type="button" onClick={() => onChange(INSCRIPTION_KEYS.size, s.label)}
                    className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${sel ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]' : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d] hover:text-[#1e2d7d]'}`}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Foil colour */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 6 }}>Колір напису</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {colors.map(c => {
                const sel = c.label === colorLabel;
                return (
                  <button key={c.label} type="button" onClick={() => onChange(INSCRIPTION_KEYS.color, c.label)}
                    title={c.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px 6px 6px', borderRadius: 999, border: sel ? '2px solid #1e2d7d' : '1px solid #d1d5db', background: sel ? '#f0f3ff' : 'white', cursor: 'pointer' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: c.hex, border: '1px solid rgba(0,0,0,0.15)', display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live preview */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Прев'ю напису</label>
            <div style={{ width: '100%', minHeight: 110, borderRadius: 10, background: previewBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px 16px', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.25)' }}>
              <span style={{ fontFamily: `'${font}', cursive`, fontSize: sizePx, color: colorHex, lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-word', textShadow: colorHex.toLowerCase() === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.25)' : 'none' }}>
                {text || 'Ваш напис'}
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>
              Прев'ю орієнтовне — фінальний вигляд напису підтвердить студія перед друком.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
