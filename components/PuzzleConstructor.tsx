'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ShoppingCart, Image as ImageIcon, Type, QrCode, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cart-store';
import { useT } from '@/lib/i18n/context';

// Puzzle formats: A5/A4/A3 in both orientations, piece counts from wolf.ua
type PuzzleFormat = {
  id: string;
  label: string;
  sheet: 'A5' | 'A4' | 'A3';
  orientation: 'V' | 'H';
  widthCm: number;
  heightCm: number;
  pieceCounts: number[];
  basePrice: number;
};

const PUZZLE_FORMATS: PuzzleFormat[] = [
  { id: 's-v', label: '15×21 см (вертикальний)',   sheet: 'A5', orientation: 'V', widthCm: 15,   heightCm: 21,   pieceCounts: [35, 60, 110],  basePrice: 249 },
  { id: 's-h', label: '21×15 см (горизонтальний)', sheet: 'A5', orientation: 'H', widthCm: 21,   heightCm: 15,   pieceCounts: [35, 60, 110],  basePrice: 249 },
  { id: 'm-v', label: '20×30 см (вертикальний)',   sheet: 'A4', orientation: 'V', widthCm: 20,   heightCm: 30,   pieceCounts: [60, 110, 216], basePrice: 349 },
  { id: 'm-h', label: '30×20 см (горизонтальний)', sheet: 'A4', orientation: 'H', widthCm: 30,   heightCm: 20,   pieceCounts: [60, 110, 216], basePrice: 349 },
  { id: 'l-v', label: '30×42 см (вертикальний)',   sheet: 'A3', orientation: 'V', widthCm: 29.7, heightCm: 42,   pieceCounts: [108, 216],     basePrice: 499 },
  { id: 'l-h', label: '42×30 см (горизонтальний)', sheet: 'A3', orientation: 'H', widthCm: 42,   heightCm: 29.7, pieceCounts: [108, 216],     basePrice: 499 },
];

const FINISHES = [
  { id: 'matte',  label: 'Матовий',  priceAdd: 0 },
  { id: 'glossy', label: 'Глянцевий', priceAdd: 20 },
];

const QR_PRICE = 50;

type Mode = 'photo' | 'text' | 'photo-text' | 'qr';

interface PuzzleConfig {
  formatId: string;
  pieceCount: number;
  finish: 'matte' | 'glossy';
  mode: Mode;
  photoUrl: string | null;
  cropX: number;
  cropY: number;
  zoom: number;
  text: string;
  textColor: string;
  bgColor: string;
  fontFamily: string;
  qrValue: string;
}

const FONTS = [
  { id: 'Playfair Display',   label: 'Playfair' },
  { id: 'Montserrat',         label: 'Montserrat' },
  { id: 'Dancing Script',     label: 'Dancing' },
  { id: 'Cormorant Garamond', label: 'Cormorant' },
  { id: 'Great Vibes',        label: 'Great Vibes' },
];

const BG_COLORS = ['#ffffff', '#f5ecd7', '#f8e1e1', '#e0f0e8', '#e3e8f5', '#1a1a1a', '#1e2d7d', '#8a4a4a'];
const TEXT_COLORS = ['#1a1a1a', '#ffffff', '#1e2d7d', '#c09060', '#8a4a4a', '#5a7a3a'];

export default function PuzzleConstructor(_props: { productSlug?: string } = {}) {
  const t = useT();
  const router = useRouter();
  const { addItem } = useCartStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<PuzzleConfig>({
    formatId: 'a4-v',
    pieceCount: 60,
    finish: 'matte',
    mode: 'photo',
    photoUrl: null,
    cropX: 50, cropY: 50, zoom: 1,
    text: 'Ваш текст',
    textColor: '#1a1a1a',
    bgColor: '#f5ecd7',
    fontFamily: 'Playfair Display',
    qrValue: 'https://touch.memories',
  });

  const format = PUZZLE_FORMATS.find(f => f.id === config.formatId)!;

  useEffect(() => {
    if (!format.pieceCounts.includes(config.pieceCount)) {
      setConfig(c => ({ ...c, pieceCount: format.pieceCounts[1] || format.pieceCounts[0] }));
    }
  }, [config.formatId]);

  const update = (patch: Partial<PuzzleConfig>) => setConfig(c => ({ ...c, ...patch }));

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Будь ласка, завантажте зображення'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      update({ photoUrl: e.target?.result as string, cropX: 50, cropY: 50, zoom: 1 });
      toast.success(t('puzzle.uploadPhoto'));
    };
    reader.readAsDataURL(file);
  };

  const qrImageUrl = config.qrValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(config.qrValue)}&margin=10`
    : null;

  const finishData = FINISHES.find(f => f.id === config.finish)!;
  const totalPrice = format.basePrice + finishData.priceAdd + (config.mode === 'qr' ? QR_PRICE : 0);

  const addToCart = () => {
    if ((config.mode === 'photo' || config.mode === 'photo-text') && !config.photoUrl) { toast.error(t('puzzle.uploadPhoto')); return; }
    if (config.mode === 'text' && !config.text.trim()) { toast.error(t('puzzle.textPlaceholder')); return; }
    if (config.mode === 'qr' && !config.qrValue.trim()) { toast.error(t('puzzle.qrPlaceholder')); return; }
    addItem({
      id: `puzzle-${Date.now()}`,
      name: 'Фотопазл',
      price: totalPrice,
      qty: 1,
      image: config.photoUrl || '',
      options: {
        'Формат': format.label,
        'Деталей': `${config.pieceCount}`,
        'Покриття': finishData.label,
        'Тип': config.mode === 'photo' ? 'Фото' : config.mode === 'text' ? 'Текст' : config.mode === 'photo-text' ? 'Фото + текст' : 'QR-код',
      },
      personalization_note: `${format.label} · ${config.pieceCount} деталей · ${finishData.label}`,
    });
    toast.success(t('puzzle.addToCart'));
    router.push('/cart');
  };

  // Preview scaling — max 360px on longer dimension
  const maxPreview = 360;
  const pScale = Math.min(maxPreview / format.widthCm, maxPreview / format.heightCm);
  const previewW = format.widthCm * pScale;
  const previewH = format.heightCm * pScale;

  // Piece grid estimation
  const pieceCols = Math.max(2, Math.round(Math.sqrt(config.pieceCount * (format.widthCm / format.heightCm))));
  const pieceRows = Math.max(2, Math.round(config.pieceCount / pieceCols));

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px', fontFamily: 'var(--font-primary, sans-serif)' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', margin: 0 }}>{t('puzzle.title')}</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{t('puzzle.subtitle')}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d' }}>{totalPrice} ₴</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{format.label} · {config.pieceCount} деталей</div>
        </div>
      </div>

      <div className="puzzle-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* LEFT: Mode + format + pieces + finish */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e2d7d', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('puzzle.what')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {([
                { id: 'photo' as Mode,      label: t('puzzle.photo'),        icon: <ImageIcon size={14} /> },
                { id: 'text' as Mode,       label: t('puzzle.text'),       icon: <Type size={14} /> },
                { id: 'photo-text' as Mode, label: t('puzzle.photoText'),  icon: <Sparkles size={14} /> },
                { id: 'qr' as Mode,         label: `QR (+${QR_PRICE}₴)`, icon: <QrCode size={14} /> },
              ]).map(m => (
                <button key={m.id} onClick={() => update({ mode: m.id })}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 6px', border: config.mode === m.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: config.mode === m.id ? '#f0f3ff' : '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: config.mode === m.id ? '#1e2d7d' : '#475569' }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e2d7d', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('puzzle.format')}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {PUZZLE_FORMATS.map(f => {
                const isActive = config.formatId === f.id;
                return (
                  <button key={f.id} onClick={() => update({ formatId: f.id })}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: isActive ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: isActive ? '#f0f3ff' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#1e2d7d' : '#1e293b' }}>{f.label}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{f.widthCm}×{f.heightCm} см · {f.basePrice}₴</div>
                    </div>
                    <div style={{ width: f.orientation === 'V' ? 14 : 22, height: f.orientation === 'V' ? 22 : 14, border: '2px solid ' + (isActive ? '#1e2d7d' : '#cbd5e1'), borderRadius: 2, flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e2d7d', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('puzzle.pieces')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {format.pieceCounts.map(pc => (
                <button key={pc} onClick={() => update({ pieceCount: pc })}
                  style={{ padding: '12px 4px', border: config.pieceCount === pc ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: config.pieceCount === pc ? '#f0f3ff' : '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: config.pieceCount === pc ? '#1e2d7d' : '#475569' }}>
                  {pc}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e2d7d', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('puzzle.finish')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {FINISHES.map(f => {
                const finishLabel = f.id === 'matte' ? t('puzzle.matte') : t('puzzle.glossy');
                return (
                  <button key={f.id} onClick={() => update({ finish: f.id as 'matte' | 'glossy' })}
                    style={{ padding: '10px 8px', border: config.finish === f.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: config.finish === f.id ? '#f0f3ff' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: config.finish === f.id ? '#1e2d7d' : '#475569' }}>
                    <div>{finishLabel}</div>
                    {f.priceAdd > 0 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>+{f.priceAdd}₴</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CENTER: Preview */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, minHeight: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Попередній перегляд</div>

          <div style={{ position: 'relative', padding: 20 }}>
            <div style={{ position: 'absolute', inset: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.08)', borderRadius: 6 }} />

            <div style={{
              position: 'relative', width: previewW, height: previewH,
              background: (config.mode === 'text' || config.mode === 'qr') ? config.bgColor : '#f1f5f9',
              borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)',
            }}>
              {(config.mode === 'photo' || config.mode === 'photo-text') && (
                config.photoUrl ? (
                  <img src={config.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${config.cropX}% ${config.cropY}%`, transform: `scale(${config.zoom})` }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 8 }}>
                    <ImageIcon size={40} color="#cbd5e1" />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{t('puzzle.uploadPhoto')}</span>
                  </div>
                )
              )}

              {config.mode === 'photo-text' && config.photoUrl && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: '8%', padding: '10px 20px', textAlign: 'center', fontFamily: config.fontFamily + ', serif', fontSize: Math.max(14, previewW * 0.07), color: config.textColor, textShadow: '0 2px 8px rgba(0,0,0,0.6)', fontWeight: 700, wordWrap: 'break-word', lineHeight: 1.2 }}>
                  {config.text}
                </div>
              )}

              {config.mode === 'text' && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', fontFamily: config.fontFamily + ', serif', fontSize: Math.max(18, previewW * 0.09), color: config.textColor, fontWeight: 700, wordWrap: 'break-word', lineHeight: 1.2 }}>
                  {config.text}
                </div>
              )}

              {config.mode === 'qr' && qrImageUrl && (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8%', gap: 10 }}>
                  <img src={qrImageUrl} alt="QR" style={{ width: '65%', maxWidth: '65%', objectFit: 'contain', background: '#fff', padding: 6, borderRadius: 4 }} />
                  {config.text && (
                    <div style={{ fontSize: Math.max(11, previewW * 0.04), fontFamily: config.fontFamily + ', serif', color: config.textColor, textAlign: 'center', fontWeight: 600, wordWrap: 'break-word' }}>
                      {config.text}
                    </div>
                  )}
                </div>
              )}

              {/* Jigsaw grid overlay */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.45 }}
                viewBox={`0 0 ${pieceCols * 100} ${pieceRows * 100}`} preserveAspectRatio="none">
                {Array.from({ length: pieceCols - 1 }).map((_, i) => (
                  <line key={'v' + i} x1={(i + 1) * 100} y1={0} x2={(i + 1) * 100} y2={pieceRows * 100} stroke="#fff" strokeWidth="2" strokeDasharray="4,4" />
                ))}
                {Array.from({ length: pieceRows - 1 }).map((_, i) => (
                  <line key={'h' + i} x1={0} y1={(i + 1) * 100} x2={pieceCols * 100} y2={(i + 1) * 100} stroke="#fff" strokeWidth="2" strokeDasharray="4,4" />
                ))}
              </svg>
            </div>
          </div>

          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {format.widthCm} × {format.heightCm} см · ~{pieceCols}×{pieceRows} деталей
          </div>
        </div>

        {/* RIGHT: Mode controls */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {(config.mode === 'photo' || config.mode === 'photo-text') && (
            <>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1e2d7d', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('puzzle.uploadPhoto')}</div>
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ width: '100%', padding: '16px', border: '2px dashed #cbd5e1', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Upload size={20} color="#64748b" />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e2d7d' }}>{config.photoUrl ? t('puzzle.replacePhoto') : t('puzzle.uploadPhoto')}</div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} style={{ display: 'none' }} />
              </div>

              {config.photoUrl && (
                <>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{t('puzzle.zoom')}</span><span>{config.zoom.toFixed(1)}x</span>
                    </label>
                    <input type="range" min="1" max="3" step="0.1" value={config.zoom}
                      onChange={e => update({ zoom: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{t('puzzle.positionX')}</span><span>{Math.round(config.cropX)}%</span>
                    </label>
                    <input type="range" min="0" max="100" value={config.cropX}
                      onChange={e => update({ cropX: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{t('puzzle.positionY')}</span><span>{Math.round(config.cropY)}%</span>
                    </label>
                    <input type="range" min="0" max="100" value={config.cropY}
                      onChange={e => update({ cropY: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                  </div>
                  <button onClick={() => update({ cropX: 50, cropY: 50, zoom: 1 })}
                    style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', cursor: 'pointer', fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                    ↺ {t('puzzle.reset')}
                  </button>
                </>
              )}
            </>
          )}

          {(config.mode === 'text' || config.mode === 'photo-text' || config.mode === 'qr') && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1e2d7d', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {config.mode === 'qr' ? t('puzzle.caption') : t('puzzle.yourText')}
              </div>
              <textarea value={config.text} onChange={e => update({ text: e.target.value })}
                placeholder={config.mode === 'qr' ? t('puzzle.qrCaption') : t('puzzle.textPlaceholder')}
                rows={3}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          )}

          {config.mode === 'qr' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1e2d7d', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('puzzle.qrData')}</div>
              <input type="text" value={config.qrValue} onChange={e => update({ qrValue: e.target.value })}
                placeholder={t('puzzle.qrPlaceholder')}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                {t('puzzle.qrExamples')}
              </div>
            </div>
          )}

          {(config.mode === 'text' || config.mode === 'photo-text' || config.mode === 'qr') && (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>{t('puzzle.font')}</div>
                <select value={config.fontFamily} onChange={e => update({ fontFamily: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, background: '#fff' }}>
                  {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>{t('puzzle.textColor')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TEXT_COLORS.map(c => (
                    <button key={c} onClick={() => update({ textColor: c })}
                      style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: config.textColor === c ? '3px solid #1e2d7d' : '1px solid #e2e8f0', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              {(config.mode === 'text' || config.mode === 'qr') && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>{t('puzzle.backgroundColor')}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {BG_COLORS.map(c => (
                      <button key={c} onClick={() => update({ bgColor: c })}
                        style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: config.bgColor === c ? '3px solid #1e2d7d' : '1px solid #e2e8f0', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 'auto', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#64748b' }}>{t('puzzle.basePrice')}</span>
              <span style={{ fontWeight: 600 }}>{format.basePrice} ₴</span>
            </div>
            {finishData.priceAdd > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>{t('puzzle.glossPrice')}</span>
                <span style={{ fontWeight: 600 }}>+{finishData.priceAdd} ₴</span>
              </div>
            )}
            {config.mode === 'qr' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>{t('puzzle.qrPrice')}</span>
                <span style={{ fontWeight: 600 }}>+{QR_PRICE} ₴</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#1e2d7d', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
              <span>{t('puzzle.total')}</span><span style={{ fontSize: 18 }}>{totalPrice} ₴</span>
            </div>
            <button onClick={addToCart}
              style={{ width: '100%', marginTop: 12, padding: '12px', border: 'none', borderRadius: 8, background: '#1e2d7d', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ShoppingCart size={16} /> {t('puzzle.addToCart')}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .puzzle-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
