'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, ShoppingCart, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cart-store';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';
import { useT } from '@/lib/i18n/context';

// Magnet sizes (cm) with aspect ratios
const MAGNET_SIZES = [
  { id: '5x7.5',     w: 5,   h: 7.5,  label: '5×7.5',      type: 'rect',       price: 25, multiple: 12 },
  { id: '6x9',       w: 6,   h: 9,    label: '6×9',         type: 'rect',       price: 30, multiple: 10 },
  { id: '7.5x10',    w: 7.5, h: 10,   label: '7.5×10',      type: 'rect',       price: 35, multiple: 8  },
  { id: '9x9',       w: 9,   h: 9,    label: '9×9',         type: 'square',     price: 40, multiple: 6  },
  { id: '10x10',     w: 10,  h: 10,   label: '10×10',       type: 'square',     price: 45, multiple: 6  },
  { id: 'polaroid-v', w: 7.6, h: 10.1, label: 'Polaroid 7.6×10.1', type: 'polaroid',   price: 35, multiple: 8  },
  { id: 'polaroid-h', w: 8.6, h: 5.4,  label: 'Polaroid 8.6×5.4',  type: 'polaroid-h', price: 30, multiple: 10 },
] as const;

type MagnetSize = typeof MAGNET_SIZES[number];

interface Magnet {
  id: string;
  sizeId: string;
  photoUrl: string | null;
  photoFile: File | null;
  cropX: number; // 0-100 center position
  cropY: number;
  zoom: number; // 1-3
  caption?: string; // for polaroid
}

const BASE_PRICE = 215; // minimum order
const MIN_QUANTITY = 6;

export default function MagnetConstructor() {
  
    const t = useT();
const router = useRouter();
  const { addItem } = useCartStore();
  const [magnets, setMagnets] = useState<Magnet[]>([]);
  const [activeMagnetId, setActiveMagnetId] = useState<string | null>(null);
  const [defaultSizeId, setDefaultSizeId] = useState<string>('9x9');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMagnet = magnets.find(m => m.id === activeMagnetId) || null;

  // Handle multiple file uploads — create a magnet per file
  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      toast.error(t('magnet.image_error'));
      return;
    }

    const newMagnets: Magnet[] = await Promise.all(
      fileArray.map(file => new Promise<Magnet>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sizeId: defaultSizeId,
            photoUrl: e.target?.result as string,
            photoFile: file,
            cropX: 50,
            cropY: 50,
            zoom: 1,
          });
        };
        reader.readAsDataURL(file);
      }))
    );

    setMagnets(prev => [...prev, ...newMagnets]);
    if (!activeMagnetId && newMagnets.length > 0) {
      setActiveMagnetId(newMagnets[0].id);
    }
    toast.success(`Додано ${newMagnets.length} ${newMagnets.length === 1 ? 'магніт' : t('magnet.added_multiple')}`);
  };

  const removeMagnet = (id: string) => {
    setMagnets(prev => prev.filter(m => m.id !== id));
    if (activeMagnetId === id) {
      setActiveMagnetId(magnets[0]?.id || null);
    }
  };

  const updateMagnet = (id: string, updates: Partial<Magnet>) => {
    setMagnets(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const clearAll = () => {
    if (!confirm('Видалити всі магніти?')) return;
    setMagnets([]);
    setActiveMagnetId(null);
  };

  const totalPrice = Math.max(BASE_PRICE, magnets.reduce((sum, m) => {
    const size = MAGNET_SIZES.find(s => s.id === m.sizeId);
    return sum + (size?.price || 0);
  }, 0));

  // Per-size multiple validation
  const sizeCountMap: Record<string, number> = {};
  magnets.forEach(m => { sizeCountMap[m.sizeId] = (sizeCountMap[m.sizeId] || 0) + 1; });
  const multipleErrors: { sizeId: string; label: string; count: number; multiple: number; toRemove: number; toAdd: number }[] = [];
  Object.entries(sizeCountMap).forEach(([sizeId, count]) => {
    const sizeObj = MAGNET_SIZES.find(s => s.id === sizeId);
    if (!sizeObj) return;
    const remainder = count % sizeObj.multiple;
    if (remainder !== 0) {
      multipleErrors.push({
        sizeId,
        label: sizeObj.label,
        count,
        multiple: sizeObj.multiple,
        toRemove: remainder,
        toAdd: sizeObj.multiple - remainder,
      });
    }
  });
  const hasMultipleErrors = multipleErrors.length > 0;

  const handleAddToCart = () => {
    if (magnets.length < MIN_QUANTITY) {
      toast.error(`Мінімум ${MIN_QUANTITY} магнітів в замовленні`);
      return;
    }
    if (hasMultipleErrors) {
      toast.error('Виправте кількість магнітів (має бути кратна вказаному числу)');
      return;
    }
    const sizes = magnets.map(m => MAGNET_SIZES.find(s => s.id === m.sizeId)?.label).filter(Boolean);
    addItem({
      id: `magnet-${Date.now()}`,
      name: 'Фотомагніти',
      price: totalPrice,
      qty: 1,
      image: magnets[0]?.photoUrl || '',
      options: { 'Кількість': `${magnets.length} шт`, 'Розміри': [...new Set(sizes)].join(', ') },
      personalization_note: `${magnets.length} магнітів`,
    });
    toast.success(t('magnet.magnets_added'));
    router.push('/cart');
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px', fontFamily: 'var(--font-primary, sans-serif)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', margin: 0 }}>Конструктор магнітів</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
            Завантажте фото, оберіть розмір і оформіть замовлення (мін. {MIN_QUANTITY} шт)
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d' }}>{totalPrice} ₴</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{magnets.length} магнітів</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Gallery + upload ── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, position: 'sticky', top: 20, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1e2d7d' }}>Мої магніти ({magnets.length})</div>
            {magnets.length > 0 && (
              <button onClick={clearAll} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Очистити
              </button>
            )}
          </div>

          {/* Upload button */}
          <button onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', padding: '24px 16px', border: '2px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 12, transition: 'all 0.15s' }}>
            <Upload size={24} color="#64748b" />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d' }}>Завантажити фото</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Можна кілька файлів одразу</div>
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*"
            onChange={e => e.target.files && handleFiles(e.target.files)}
            style={{ display: 'none' }} />

          {/* Magnet thumbnails list */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {magnets.map(m => {
              const size = MAGNET_SIZES.find(s => s.id === m.sizeId)!;
              const isActive = m.id === activeMagnetId;
              return (
                <div key={m.id} onClick={() => setActiveMagnetId(m.id)}
                  style={{ position: 'relative', cursor: 'pointer', border: isActive ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', aspectRatio: `${size.w} / ${size.h}`, background: '#f1f5f9' }}>
                  {m.photoUrl && (
                    <img src={m.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${m.zoom}) translate(${(50 - m.cropX) / m.zoom}%, ${(50 - m.cropY) / m.zoom}%)` }} />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removeMagnet(m.id); }}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    <X size={12} />
                  </button>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2px 4px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, textAlign: 'center', fontWeight: 600 }}>
                    {size.label}
                  </div>
                </div>
              );
            })}
          </div>

          {magnets.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8', fontSize: 12 }}>
              Поки що немає магнітів.<br />Завантажте фото щоб почати.
            </div>
          )}
        </div>

        {/* ── CENTER: Preview ── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, minHeight: 500 }}>
          {activeMagnet ? (() => {
            const size = MAGNET_SIZES.find(s => s.id === activeMagnet.sizeId)!;
            // Scale magnet preview — max 360px on longer side
            const scale = 360 / Math.max(size.w, size.h);
            const pxW = size.w * scale;
            const pxH = size.h * scale;
            const isPolaroidV = size.type === 'polaroid';
            const isPolaroidH = size.type === 'polaroid-h';
            const isPolaroid = isPolaroidV || isPolaroidH;
            // Polaroid white frame: ~10% top/sides, 25% bottom for V; flipped for H
            const frameTop = isPolaroid ? (isPolaroidV ? 8 : 6) : 0;
            const frameBottom = isPolaroidV ? 22 : (isPolaroidH ? 6 : 0);
            const frameSide = isPolaroid ? 7 : 0;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Попередній перегляд — {size.label} см</div>

                {/* Magnet visualization with shadow */}
                <div style={{ position: 'relative', padding: 40 }}>
                  {/* Magnet shadow (magnetic look) */}
                  <div style={{
                    position: 'absolute', inset: 40,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08)',
                    borderRadius: isPolaroid ? 4 : (size.type === 'square' ? 6 : 8),
                  }} />

                  {/* Magnet body */}
                  <div style={{
                    position: 'relative',
                    width: pxW, height: pxH,
                    background: isPolaroid ? '#fff' : '#f1f5f9',
                    borderRadius: isPolaroid ? 4 : (size.type === 'square' ? 6 : 8),
                    overflow: 'hidden',
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}>
                    {/* Photo area */}
                    <div style={{
                      position: 'absolute',
                      top: `${frameTop}%`,
                      bottom: `${frameBottom}%`,
                      left: `${frameSide}%`,
                      right: `${frameSide}%`,
                      overflow: 'hidden',
                      background: '#e2e8f0',
                    }}>
                      {activeMagnet.photoUrl ? (
                        <img
                          src={activeMagnet.photoUrl}
                          alt=""
                          style={{
                            width: '100%', height: '100%',
                            objectFit: 'cover',
                            objectPosition: `${activeMagnet.cropX}% ${activeMagnet.cropY}%`,
                            transform: `scale(${activeMagnet.zoom})`,
                          }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
                          Немає фото
                        </div>
                      )}
                    </div>

                    {/* Polaroid caption area */}
                    {isPolaroidV && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0, left: 0, right: 0,
                        height: '22%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 8%',
                      }}>
                        <input
                          type="text"
                          placeholder="Ваш підпис..."
                          value={activeMagnet.caption || ''}
                          onChange={e => updateMagnet(activeMagnet.id, { caption: e.target.value })}
                          style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            fontFamily: 'cursive',
                            fontSize: Math.max(10, pxH * 0.04),
                            color: '#1a1a1a',
                            textAlign: 'center',
                            outline: 'none',
                          }}
                        />
                      </div>
                    )}

                    {/* Subtle highlight for magnetic feel */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 40%)',
                      pointerEvents: 'none',
                    }} />
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  Реальний розмір: {size.w} × {size.h} см
                </div>
              </div>
            );
          })() : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: '#94a3b8', gap: 12 }}>
              <Upload size={48} color="#cbd5e1" />
              <div style={{ fontSize: 15, fontWeight: 600 }}>Завантажте фото щоб почати</div>
              <div style={{ fontSize: 12 }}>Лівий блок → «Завантажити фото»</div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Controls ── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, position: 'sticky', top: 20, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>

          {/* Default size for new uploads */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>Розмір для нових магнітів</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {MAGNET_SIZES.map(s => (
                <button key={s.id} onClick={() => setDefaultSizeId(s.id)}
                  style={{ padding: '8px 6px', border: defaultSizeId === s.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: defaultSizeId === s.id ? '#f0f3ff' : '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: defaultSizeId === s.id ? '#1e2d7d' : '#475569', textAlign: 'left' }}>
                  <div>{s.label} см</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{s.price} ₴ · кратно {s.multiple} шт</div>
                </button>
              ))}
            </div>
          </div>

          {/* Active magnet controls */}
          {activeMagnet && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>Налаштування магніту</div>

              {/* Size picker for active magnet */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Розмір</label>
                <select value={activeMagnet.sizeId} onChange={e => updateMagnet(activeMagnet.id, { sizeId: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, background: '#fff' }}>
                  {MAGNET_SIZES.map(s => (
                    <option key={s.id} value={s.id}>{s.label} см — {s.price} ₴ (кратно {s.multiple} шт)</option>
                  ))}
                </select>
              </div>

              {/* Zoom */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Масштаб</span>
                  <span>{activeMagnet.zoom.toFixed(1)}x</span>
                </label>
                <input type="range" min="1" max="3" step="0.1" value={activeMagnet.zoom}
                  onChange={e => updateMagnet(activeMagnet.id, { zoom: parseFloat(e.target.value) })}
                  style={{ width: '100%' }} />
              </div>

              {/* Crop X */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Позиція по X</span>
                  <span>{Math.round(activeMagnet.cropX)}%</span>
                </label>
                <input type="range" min="0" max="100" value={activeMagnet.cropX}
                  onChange={e => updateMagnet(activeMagnet.id, { cropX: parseFloat(e.target.value) })}
                  style={{ width: '100%' }} />
              </div>

              {/* Crop Y */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Позиція по Y</span>
                  <span>{Math.round(activeMagnet.cropY)}%</span>
                </label>
                <input type="range" min="0" max="100" value={activeMagnet.cropY}
                  onChange={e => updateMagnet(activeMagnet.id, { cropY: parseFloat(e.target.value) })}
                  style={{ width: '100%' }} />
              </div>

              <button onClick={() => updateMagnet(activeMagnet.id, { cropX: 50, cropY: 50, zoom: 1 })}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', cursor: 'pointer', fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 12 }}>
                ↺ Скинути кадрування
              </button>

              <button onClick={() => removeMagnet(activeMagnet.id)}
                style={{ width: '100%', padding: '8px', border: '1px solid #fee2e2', borderRadius: 6, background: '#fff7f7', cursor: 'pointer', fontSize: 11, color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Trash2 size={12} /> Видалити магніт
              </button>
            </div>
          )}

          {/* Add to cart */}
          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 16, paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: '#64748b' }}>Кількість:</span>
              <span style={{ fontWeight: 700, color: '#1e2d7d' }}>{magnets.length} шт</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
              <span style={{ color: '#64748b' }}>Сума:</span>
              <span style={{ fontWeight: 900, color: '#1e2d7d', fontSize: 18 }}>{totalPrice} ₴</span>
            </div>
            {magnets.length < MIN_QUANTITY && magnets.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: 8, fontSize: 11, color: '#92400e', marginBottom: 10 }}>
                Додайте ще {MIN_QUANTITY - magnets.length} магнітів (мін. замовлення {MIN_QUANTITY} шт)
              </div>
            )}
            {hasMultipleErrors && magnets.length >= MIN_QUANTITY && (
              <div style={{ background: '#fff7ed', border: '1.5px solid #fdba74', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                {multipleErrors.map(err => (
                  <div key={err.sizeId} style={{ marginBottom: multipleErrors.length > 1 ? 8 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>
                      ⚠️ {err.label} см — {err.count} шт, має бути кратно {err.multiple}
                    </div>
                    <div style={{ fontSize: 10, color: '#78350f', marginTop: 2 }}>
                      Видаліть <b>{err.toRemove}</b> або додайте <b>{err.toAdd}</b> магніт{err.toAdd > 1 ? 'и' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* QR Code Generator */}
            <div style={{ marginBottom: 12 }}><QRCodeGenerator compact label="Додати QR-код до замовлення" /></div>

            <button onClick={handleAddToCart} disabled={magnets.length < MIN_QUANTITY || hasMultipleErrors}
              style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 8, background: magnets.length >= MIN_QUANTITY && !hasMultipleErrors ? '#1e2d7d' : '#e2e8f0', color: magnets.length >= MIN_QUANTITY && !hasMultipleErrors ? '#fff' : '#94a3b8', fontWeight: 800, fontSize: 14, cursor: magnets.length >= MIN_QUANTITY && !hasMultipleErrors ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ShoppingCart size={16} /> До кошика
            </button>
          </div>
        </div>
      </div>

      {/* Mobile responsive fallback */}
      <style>{`
        @media (max-width: 960px) {
          div[style*="grid-template-columns: 280px 1fr 300px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
