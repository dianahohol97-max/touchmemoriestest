'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart, Upload } from 'lucide-react';
import { CoverEditor, CoverConfig, VELOUR_COLORS, LEATHERETTE_COLORS, FABRIC_COLORS } from './CoverEditor';
import { FONT_GROUPS, GOOGLE_FONTS_URL } from '@/lib/editor/constants';

// ── Types ──────────────────────────────────────────────────────────────────────

type PageColor = 'white' | 'cream' | 'black';
type InteriorType = 'blank' | 'lined' | 'dotgrid' | 'prompted';
type BookSize = '20x30' | '30x20' | '23x23';

interface WishPrompt {
  id: string;
  text: string;
  enabled: boolean;
}

const DEFAULT_PROMPTS: WishPrompt[] = [
  { id: 'p1', text: 'Моє побажання для вас...', enabled: true },
  { id: 'p2', text: 'Найкращий спогад з вами...', enabled: true },
  { id: 'p3', text: 'Порада на все життя...', enabled: true },
  { id: 'p4', text: 'Що я хочу вам побажати...', enabled: false },
  { id: 'p5', text: 'Найсмішніший момент...', enabled: false },
  { id: 'p6', text: 'Якби я міг подарувати одне...', enabled: false },
];

interface BookConfig {
  // Cover
  cover: CoverConfig;
  coverPhotos: { id: string; preview: string }[];
  // Interior
  interiorType: InteriorType;
  pageColor: PageColor;
  pageCount: number;
  prompts: WishPrompt[];
  // Size
  size: BookSize;
  // Theme
  theme: 'wedding' | 'birthday' | 'baby' | 'universal';
}

const SIZES: { id: BookSize; label: string; w: number; h: number; priceBase: number }[] = [
  { id: '20x30', label: '20×30 см', w: 200, h: 300, priceBase: 559 },
  { id: '30x20', label: '30×20 см', w: 300, h: 200, priceBase: 559 },
  { id: '23x23', label: '23×23 см', w: 230, h: 230, priceBase: 579 },
];

const THEMES = [
  { id: 'wedding',   label: '💍 Весілля',        color: '#fce7f3' },
  { id: 'birthday',  label: '🎂 День народження', color: '#fef3c7' },
  { id: 'baby',      label: '🍼 Baby Shower',     color: '#dbeafe' },
  { id: 'universal', label: '✨ Універсальна',    color: '#f0fdf4' },
];

const PAGE_COLORS: { id: PageColor; label: string; hex: string }[] = [
  { id: 'white', label: 'Білі', hex: '#ffffff' },
  { id: 'cream', label: 'Кремові', hex: '#faf6ee' },
  { id: 'black', label: 'Чорні', hex: '#1a1a1a' },
];

const INTERIOR_TYPES: { id: InteriorType; label: string; desc: string; icon: string }[] = [
  { id: 'blank',    label: 'Чисті',       desc: 'Порожні сторінки',         icon: '⬜' },
  { id: 'lined',    label: 'З лініями',   desc: 'Горизонтальні лінії',       icon: '≡' },
  { id: 'dotgrid',  label: 'Крапки',      desc: 'Сітка з крапок',            icon: '⠿' },
  { id: 'prompted', label: 'З підказками', desc: 'Готові питання для гостей', icon: '💬' },
];

const PAGE_COUNTS = [32, 48, 64, 96];

// ── Default cover ──────────────────────────────────────────────────────────────

const DEFAULT_COVER: CoverConfig = {
  coverMaterial: 'velour',
  coverColorName: 'Темно-синій',
  decoType: 'acryl',
  decoVariant: '',
  decoColor: '',
  photoId: null,
  decoText: 'Книга побажань',
  textX: 50, textY: 50,
  textFontFamily: 'Playfair Display',
  textFontSize: 32,
  extraTexts: [],
  printedBgColor: '#1e2d7d',
  printedTextBlocks: [],
  printedOverlay: { type: 'none', color: '#000000', opacity: 0, gradient: '' },
};

// ── Interior Page Preview ──────────────────────────────────────────────────────

function InteriorPagePreview({
  interiorType, pageColor, prompts, W, H,
}: {
  interiorType: InteriorType; pageColor: PageColor;
  prompts: WishPrompt[]; W: number; H: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageHex = PAGE_COLORS.find(p => p.id === pageColor)?.hex || '#ffffff';
  const isBlack = pageColor === 'black';
  const lineColor = isBlack ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const textColor = isBlack ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)';

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = pageHex;
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.08;
    const s = W / 200;

    if (interiorType === 'blank') {
      // Just subtle corner decoration
      ctx.strokeStyle = lineColor; ctx.lineWidth = 0.5;
      ctx.strokeRect(pad * 0.5, pad * 0.5, W - pad, H - pad);

    } else if (interiorType === 'lined') {
      const lineSpacing = Math.round(18 * s);
      ctx.strokeStyle = lineColor; ctx.lineWidth = 0.8;
      for (let y = pad + lineSpacing * 2; y < H - pad; y += lineSpacing) {
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      }
      // Name label line at top
      ctx.strokeStyle = isBlack ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, pad + lineSpacing); ctx.lineTo(W - pad, pad + lineSpacing); ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = `${Math.round(7*s)}px sans-serif`;
      ctx.fillText('Ім\'я', pad, pad + lineSpacing - 3);

    } else if (interiorType === 'dotgrid') {
      const spacing = Math.round(12 * s);
      ctx.fillStyle = lineColor;
      for (let x = pad; x < W - pad; x += spacing) {
        for (let y = pad + spacing; y < H - pad; y += spacing) {
          ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill();
        }
      }

    } else if (interiorType === 'prompted') {
      const active = prompts.filter(p => p.enabled);
      const lineH = Math.round(36 * s);
      ctx.fillStyle = textColor;
      ctx.font = `${Math.round(7.5*s)}px sans-serif`;
      active.slice(0, 3).forEach((p, i) => {
        const y = pad + i * (lineH * 2.2);
        ctx.fillText(p.text, pad, y + 10);
        ctx.strokeStyle = lineColor; ctx.lineWidth = 0.8;
        for (let l = 0; l < 2; l++) {
          ctx.beginPath();
          ctx.moveTo(pad, y + 18 + l * lineH * 0.6);
          ctx.lineTo(W - pad, y + 18 + l * lineH * 0.6);
          ctx.stroke();
        }
      });
    }

    // Page number
    ctx.fillStyle = textColor;
    ctx.font = `${Math.round(7*s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('1', W / 2, H - pad * 0.4);

  }, [interiorType, pageColor, prompts, W, H]);

  return <canvas ref={canvasRef} width={W} height={H} style={{ width:'100%', height:'auto', display:'block', borderRadius:6 }}/>;
}

// ── Cover Preview Wrapper ──────────────────────────────────────────────────────

function BookCoverPreview({ cover, photos, W, H }: {
  cover: CoverConfig;
  photos: { id: string; preview: string }[];
  W: number; H: number;
}) {
  // Use CoverEditor in read-only-ish mode — just render the canvas
  // We'll use a minimal canvas render based on cover config
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;

    // BG color based on material
    let bgColor = '#1e2d7d';
    if (cover.coverMaterial === 'velour') bgColor = VELOUR_COLORS[cover.coverColorName] || '#1e2d7d';
    else if (cover.coverMaterial === 'leatherette') bgColor = LEATHERETTE_COLORS[cover.coverColorName] || '#3d2c1e';
    else if (cover.coverMaterial === 'fabric') bgColor = FABRIC_COLORS[cover.coverColorName] || '#c4aa88';
    else if (cover.coverMaterial === 'printed') bgColor = cover.printedBgColor || '#1e2d7d';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    const s = W / 240;

    // If printed material — show photo if exists
    if (cover.coverMaterial === 'printed' && cover.photoId) {
      const photo = photos.find(p => p.id === cover.photoId);
      if (photo) {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          const ia = img.width / img.height, sa = W / H;
          let dw, dh, dx, dy;
          if (ia > sa) { dh = H; dw = dh * ia; dx = -(dw - W) / 2; dy = 0; }
          else { dw = W; dh = dw / ia; dx = 0; dy = -(dh - H) / 2; }
          ctx.globalAlpha = 0.9;
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.globalAlpha = 1;
          ctx.restore();
          drawCoverText();
        };
        img.src = photo.preview;
        return;
      }
    }
    drawCoverText();

    function drawCoverText() {
      const isLight = ['Кремовий','Білий','Бежевий','Пудровий рожевий'].includes(cover.coverColorName) || cover.coverMaterial === 'fabric';
      const textC = isLight ? '#1a1a1a' : '#ffffff';
      const tx = (cover.textX / 100) * W;
      const ty = (cover.textY / 100) * H;

      if (cover.decoText) {
        ctx.fillStyle = textC;
        ctx.font = `${cover.decoType === 'acryl' ? 400 : 600} ${Math.round(cover.textFontSize * s * 0.6)}px '${cover.textFontFamily}', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cover.decoText, tx, ty);
      }

      // Extra texts
      cover.extraTexts?.forEach(et => {
        ctx.fillStyle = et.color || textC;
        ctx.font = `${Math.round(et.fontSize * s * 0.55)}px '${cover.textFontFamily}', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(et.text, (et.x / 100) * W, (et.y / 100) * H);
      });

      // Subtle border
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(W * 0.05, H * 0.04, W * 0.9, H * 0.92);
    }
  }, [cover, photos, W, H]);

  return <canvas ref={canvasRef} width={W} height={H} style={{ width:'100%', height:'auto', display:'block', borderRadius:8 }}/>;
}

// ── Main Constructor ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: '1. Тема' },
  { id: 2, label: '2. Обкладинка' },
  { id: 3, label: '3. Сторінки' },
  { id: 4, label: '4. Розмір' },
];

export default function GuestBookConstructorNew() {
  const router = useRouter();
  const { addItem } = useCartStore();

  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<BookConfig>({
    cover: { ...DEFAULT_COVER },
    coverPhotos: [],
    interiorType: 'lined',
    pageColor: 'cream',
    pageCount: 48,
    prompts: DEFAULT_PROMPTS,
    size: '20x30',
    theme: 'wedding',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  const sizeObj = SIZES.find(s => s.id === config.size) || SIZES[0];
  const materialPrice = config.cover.coverMaterial === 'printed' ? -200 : 0;
  const totalPrice = sizeObj.priceBase + materialPrice + (config.size === '23x23' ? 20 : 0);

  // Cover photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    const id = `photo-${Date.now()}`;
    setConfig(prev => ({
      ...prev,
      coverPhotos: [...prev.coverPhotos, { id, preview: url }],
      cover: { ...prev.cover, photoId: id },
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOrder = () => {
    addItem({
      id: `guestbook-${Date.now()}`,
      name: `Книга побажань ${sizeObj.label}`,
      price: totalPrice,
      qty: 1,
      image: config.coverPhotos[0]?.preview || '',
      options: {
        'Розмір': sizeObj.label,
        'Матеріал': config.cover.coverMaterial,
        'Сторінки': config.interiorType,
        'Кількість сторінок': String(config.pageCount),
        'Колір сторінок': config.pageColor,
      },
      personalization_note: `Тема: ${config.theme}, Текст: ${config.cover.decoText}`,
    });
    toast.success('✅ Книгу побажань додано до кошика!');
    router.push('/cart');
  };

  const PREV_W = sizeObj.id === '30x20' ? 320 : 220;
  const PREV_H = sizeObj.id === '30x20' ? Math.round(320 * 200 / 300) : Math.round(220 * sizeObj.h / sizeObj.w);

  return (
    <div style={{ fontFamily: 'var(--font-primary, sans-serif)' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/catalog/wishbook" style={{ color: '#64748b', textDecoration: 'none', fontSize: 13 }}>← Назад</a>
          <span style={{ color: '#e2e8f0' }}>|</span>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Конструктор книги побажань</h1>
        </div>
      </div>

      {/* Step tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex' }}>
          {STEPS.map(s => (
            <button key={s.id} onClick={() => setStep(s.id)}
              style={{ padding: '12px 24px', border: 'none', background: step === s.id ? '#f0f3ff' : 'transparent',
                color: step === s.id ? '#1e2d7d' : '#64748b',
                fontWeight: step === s.id ? 800 : 500, fontSize: 13, cursor: 'pointer',
                borderBottom: step === s.id ? '3px solid #1e2d7d' : '3px solid transparent' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', minHeight: '80vh' }}>

        {/* ── LEFT: Controls ── */}
        <div style={{ width: 360, flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── STEP 1: Theme ── */}
          {step === 1 && (
            <>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1e2d7d', margin: '0 0 4px' }}>Тема</h3>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>Оберіть подію для якої книга</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => {
                      const defText = t.id === 'wedding' ? 'Книга побажань' : t.id === 'birthday' ? 'З Днем Народження!' : t.id === 'baby' ? 'Baby Shower' : 'Книга побажань';
                      setConfig(prev => ({ ...prev, theme: t.id as any, cover: { ...prev.cover, decoText: defText } }));
                    }}
                      style={{ padding: '14px 10px', border: config.theme === t.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius: 10, background: config.theme === t.id ? '#f0f3ff' : t.color,
                        cursor: 'pointer', fontWeight: 700, fontSize: 13,
                        color: config.theme === t.id ? '#1e2d7d' : '#374151' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main text on cover */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Текст на обкладинці</label>
                <input type="text" value={config.cover.decoText}
                  onChange={e => setConfig(prev => ({ ...prev, cover: { ...prev.cover, decoText: e.target.value } }))}
                  placeholder="Книга побажань"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 8 }}/>
                {/* Quick suggestions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(config.theme === 'wedding'
                    ? ['Книга побажань', 'Наше весілля', 'Mr & Mrs', 'Guest Book', 'Гості']
                    : config.theme === 'birthday'
                    ? ['З Днем Народження!', 'Побажання', 'Вітаємо!', 'Happy Birthday', '30 і чудова']
                    : config.theme === 'baby'
                    ? ['Baby Shower', 'Ласкаво просимо!', 'Наш малюк', 'Our Baby']
                    : ['Книга побажань', 'Побажання', 'Guest Book', 'Наші гості']
                  ).map(s => (
                    <button key={s} onClick={() => setConfig(prev => ({ ...prev, cover: { ...prev.cover, decoText: s } }))}
                      style={{ padding: '4px 10px', borderRadius: 16, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: 'pointer', color: '#374151' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional text (date, names) */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Додатковий текст (імена, дата)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(config.cover.extraTexts || []).map((et, i) => (
                    <div key={et.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="text" value={et.text}
                        onChange={e => setConfig(prev => ({ ...prev, cover: { ...prev.cover, extraTexts: prev.cover.extraTexts?.map((t, j) => j === i ? { ...t, text: e.target.value } : t) } }))}
                        style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12 }}/>
                      <button onClick={() => setConfig(prev => ({ ...prev, cover: { ...prev.cover, extraTexts: prev.cover.extraTexts?.filter((_, j) => j !== i) } }))}
                        style={{ width: 26, height: 26, border: 'none', background: '#fee2e2', borderRadius: 6, cursor: 'pointer', color: '#ef4444', fontSize: 14 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setConfig(prev => ({ ...prev, cover: { ...prev.cover, extraTexts: [...(prev.cover.extraTexts || []), { id: `et-${Date.now()}`, text: '', x: 50, y: 70, fontFamily: 'Playfair Display', fontSize: 20, color: '#ffffff' }] } }))}
                    style={{ padding: '7px', border: '1.5px dashed #c7d2fe', borderRadius: 8, background: '#f8faff', color: '#1e2d7d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    + Додати рядок
                  </button>
                </div>
              </div>

              {/* Font */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Шрифт</label>
                <select value={config.cover.textFontFamily}
                  onChange={e => setConfig(prev => ({ ...prev, cover: { ...prev.cover, textFontFamily: e.target.value } }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: config.cover.textFontFamily }}>
                  {FONT_GROUPS.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.fonts.map(f => <option key={f} value={f}>{f}</option>)}
                    </optgroup>
                  ))}
                </select>
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0f3ff', borderRadius: 8, fontFamily: config.cover.textFontFamily, fontSize: 18, color: '#1e2d7d', textAlign: 'center' }}>
                  {config.cover.decoText || 'Книга побажань'}
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2: Cover ── */}
          {step === 2 && (
            <>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1e2d7d', margin: '0 0 14px' }}>Матеріал обкладинки</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[
                    { id: 'velour' as const, label: 'Велюр', desc: 'Оксамитова фактура', colors: Object.keys(VELOUR_COLORS) },
                    { id: 'leatherette' as const, label: 'Шкірзам', desc: 'Класична шкіра', colors: Object.keys(LEATHERETTE_COLORS) },
                    { id: 'fabric' as const, label: 'Тканина', desc: 'М\'яка текстура', colors: Object.keys(FABRIC_COLORS) },
                    { id: 'printed' as const, label: 'Друкована', desc: 'Повнокольоровий друк', colors: [] },
                  ].map(mat => (
                    <button key={mat.id} onClick={() => setConfig(prev => ({ ...prev, cover: { ...prev.cover, coverMaterial: mat.id, coverColorName: mat.colors[0] || '' } }))}
                      style={{ padding: '10px 8px', border: config.cover.coverMaterial === mat.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius: 10, background: config.cover.coverMaterial === mat.id ? '#f0f3ff' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: config.cover.coverMaterial === mat.id ? '#1e2d7d' : '#374151' }}>{mat.label}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{mat.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              {config.cover.coverMaterial !== 'printed' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Колір</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(
                      config.cover.coverMaterial === 'velour' ? VELOUR_COLORS :
                      config.cover.coverMaterial === 'leatherette' ? LEATHERETTE_COLORS : FABRIC_COLORS
                    ).map(([name, hex]) => (
                      <button key={name} onClick={() => setConfig(prev => ({ ...prev, cover: { ...prev.cover, coverColorName: name } }))}
                        title={name}
                        style={{ width: 32, height: 32, borderRadius: '50%', background: hex,
                          border: config.cover.coverColorName === name ? '3px solid #1e2d7d' : '2px solid #fff',
                          boxShadow: '0 0 0 1px #e2e8f0', cursor: 'pointer' }}/>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                    Обрано: <b>{config.cover.coverColorName}</b>
                  </div>
                </div>
              )}

              {/* Printed: photo upload */}
              {config.cover.coverMaterial === 'printed' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Фото для обкладинки</label>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload}/>
                  {config.coverPhotos.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {config.coverPhotos.map(p => (
                        <div key={p.id} style={{ position: 'relative', cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: config.cover.photoId === p.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0' }}
                          onClick={() => setConfig(prev => ({ ...prev, cover: { ...prev.cover, photoId: p.id } }))}>
                          <img src={p.preview} style={{ width: '100%', height: 60, objectFit: 'cover' }}/>
                          {config.cover.photoId === p.id && <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#1e2d7d', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ width: '100%', padding: '12px', border: '2px dashed #c7d2fe', borderRadius: 8, background: '#f8faff', color: '#1e2d7d', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                    <Upload size={14}/> Завантажити фото
                  </button>
                  {/* Printed BG color */}
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Колір фону</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {['#1e2d7d','#14532d','#3d2c1e','#1a1a1a','#7c3aed','#be185d','#0369a1','#ffffff','#faf6ee'].map(c => (
                        <button key={c} onClick={() => setConfig(prev => ({ ...prev, cover: { ...prev.cover, printedBgColor: c } }))}
                          style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: (config.cover.printedBgColor || '#1e2d7d') === c ? '3px solid #1e2d7d' : '1.5px solid #e2e8f0', cursor: 'pointer' }}/>
                      ))}
                      <input type="color" value={config.cover.printedBgColor || '#1e2d7d'}
                        onChange={e => setConfig(prev => ({ ...prev, cover: { ...prev.cover, printedBgColor: e.target.value } }))}
                        style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid #e2e8f0', cursor: 'pointer', padding: 1 }}/>
                    </div>
                  </div>
                </div>
              )}

              {/* Decoration type */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Декор</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {[
                    { id: 'acryl', label: 'Акрил' },
                    { id: 'photovstavka', label: 'Фотовставка' },
                    { id: 'flex', label: 'Фото Flex' },
                    { id: 'metal', label: 'Метал' },
                    { id: 'graviruvannya', label: 'Гравіювання' },
                    { id: 'none', label: 'Без декору' },
                  ].map(d => (
                    <button key={d.id} onClick={() => setConfig(prev => ({ ...prev, cover: { ...prev.cover, decoType: d.id as any } }))}
                      style={{ padding: '7px 4px', border: config.cover.decoType === d.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius: 7, background: config.cover.decoType === d.id ? '#f0f3ff' : '#fff',
                        fontSize: 10, fontWeight: 700, color: config.cover.decoType === d.id ? '#1e2d7d' : '#374151', cursor: 'pointer' }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── STEP 3: Interior ── */}
          {step === 3 && (
            <>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1e2d7d', margin: '0 0 14px' }}>Внутрішні сторінки</h3>

                {/* Type */}
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Тип сторінок</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {INTERIOR_TYPES.map(t => (
                    <button key={t.id} onClick={() => setConfig(prev => ({ ...prev, interiorType: t.id }))}
                      style={{ padding: '12px 8px', border: config.interiorType === t.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius: 10, background: config.interiorType === t.id ? '#f0f3ff' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: config.interiorType === t.id ? '#1e2d7d' : '#374151' }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{t.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Prompts editor */}
                {config.interiorType === 'prompted' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Підказки для гостей</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {config.prompts.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <input type="checkbox" checked={p.enabled}
                            onChange={() => setConfig(prev => ({ ...prev, prompts: prev.prompts.map((pp, j) => j === i ? { ...pp, enabled: !pp.enabled } : pp) }))}
                            style={{ accentColor: '#1e2d7d', width: 14, height: 14 }}/>
                          <input type="text" value={p.text}
                            onChange={e => setConfig(prev => ({ ...prev, prompts: prev.prompts.map((pp, j) => j === i ? { ...pp, text: e.target.value } : pp) }))}
                            style={{ flex: 1, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, opacity: p.enabled ? 1 : 0.5 }}/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Page color */}
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Колір сторінок</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {PAGE_COLORS.map(c => (
                    <button key={c.id} onClick={() => setConfig(prev => ({ ...prev, pageColor: c.id }))}
                      style={{ flex: 1, padding: '10px', border: config.pageColor === c.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius: 9, background: config.pageColor === c.id ? '#f0f3ff' : '#fff', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 4, background: c.hex, border: '1px solid #e2e8f0' }}/>
                      <span style={{ fontSize: 11, fontWeight: 700, color: config.pageColor === c.id ? '#1e2d7d' : '#374151' }}>{c.label}</span>
                    </button>
                  ))}
                </div>

                {/* Page count */}
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Кількість сторінок</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {PAGE_COUNTS.map(n => (
                    <button key={n} onClick={() => setConfig(prev => ({ ...prev, pageCount: n }))}
                      style={{ padding: '10px 4px', border: config.pageCount === n ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius: 8, background: config.pageCount === n ? '#f0f3ff' : '#fff',
                        cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: config.pageCount === n ? '#1e2d7d' : '#374151' }}>{n}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8' }}>стор.</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── STEP 4: Size ── */}
          {step === 4 && (
            <>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1e2d7d', margin: '0 0 14px' }}>Розмір</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {SIZES.map(s => (
                    <button key={s.id} onClick={() => setConfig(prev => ({ ...prev, size: s.id }))}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px',
                        border: config.size === s.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius: 10, background: config.size === s.id ? '#f0f3ff' : '#fff', cursor: 'pointer' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: config.size === s.id ? '#1e2d7d' : '#374151' }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.w}×{s.h} мм · {s.id === '30x20' ? 'Горизонтальна' : 'Вертикальна'}</div>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: config.size === s.id ? '#1e2d7d' : '#374151' }}>{s.priceBase} ₴</span>
                    </button>
                  ))}
                </div>

                {/* Summary */}
                <div style={{ background: '#f0f3ff', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Ваше замовлення:</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>Книга побажань {sizeObj.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d' }}>{sizeObj.priceBase} ₴</span>
                  </div>
                  {config.cover.coverMaterial === 'printed' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Друкована обкладинка</span>
                      <span style={{ fontSize: 12, color: '#10b981' }}>−200 ₴</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid #c7d2fe', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>Разом</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d' }}>{totalPrice} ₴</span>
                  </div>
                </div>

                <button onClick={handleOrder}
                  style={{ width: '100%', padding: '14px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 12,
                    fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 20px rgba(30,45,125,0.3)' }}>
                  <ShoppingCart size={18}/> Замовити — {totalPrice} ₴
                </button>
              </div>
            </>
          )}

          {/* Step navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
                background: '#fff', cursor: step === 1 ? 'not-allowed' : 'pointer', color: step === 1 ? '#cbd5e1' : '#374151', fontWeight: 600, fontSize: 13 }}>
              <ChevronLeft size={14}/> Назад
            </button>
            {step < 4 && (
              <button onClick={() => setStep(s => Math.min(4, s + 1))}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                Далі <ChevronRight size={14}/>
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div style={{ flex: 1, background: '#f4f6fb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '32px 24px', gap: 20, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {step <= 2 ? 'Обкладинка' : step === 3 ? 'Внутрішня сторінка' : 'Книга побажань'} — {sizeObj.label}
          </div>

          {/* Cover preview */}
          {(step === 1 || step === 2 || step === 4) && (
            <div style={{ width: '100%', maxWidth: PREV_W + 20 }}>
              <div style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.18)', borderRadius: 10, overflow: 'hidden' }}>
                <BookCoverPreview cover={config.cover} photos={config.coverPhotos} W={PREV_W} H={PREV_H}/>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
                {config.cover.coverMaterial === 'velour' && 'Велюр'}
                {config.cover.coverMaterial === 'leatherette' && 'Шкірзам'}
                {config.cover.coverMaterial === 'fabric' && 'Тканина'}
                {config.cover.coverMaterial === 'printed' && 'Друкована'}
                {' · '}{config.cover.coverColorName || 'Кольоровий'}
              </div>
            </div>
          )}

          {/* Interior preview */}
          {step === 3 && (
            <div style={{ width: '100%', maxWidth: PREV_W + 20 }}>
              <div style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.15)', borderRadius: 10, overflow: 'hidden' }}>
                <InteriorPagePreview interiorType={config.interiorType} pageColor={config.pageColor} prompts={config.prompts} W={PREV_W} H={PREV_H}/>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
                {INTERIOR_TYPES.find(t => t.id === config.interiorType)?.label} · {PAGE_COLORS.find(c => c.id === config.pageColor)?.label} сторінки · {config.pageCount} стор.
              </div>
            </div>
          )}

          {/* Step 4: show both */}
          {step === 4 && (
            <div style={{ width: '100%', maxWidth: PREV_W + 20 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, textAlign: 'center' }}>Внутрішня сторінка</div>
              <div style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)', borderRadius: 8, overflow: 'hidden' }}>
                <InteriorPagePreview interiorType={config.interiorType} pageColor={config.pageColor} prompts={config.prompts} W={PREV_W} H={PREV_H}/>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
