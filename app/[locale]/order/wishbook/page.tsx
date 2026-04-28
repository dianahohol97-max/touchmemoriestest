'use client';

import { Suspense, useState, useRef, useCallback } from 'react';
import { CartSuccessModal } from '@/components/ui/CartSuccessModal';
import { useT } from '@/lib/i18n/context';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { useCartStore } from '@/store/cart-store';
import { CoverEditor, CoverConfig, VELOUR_COLORS, LEATHERETTE_COLORS, FABRIC_COLORS } from '@/components/CoverEditor';
import { toast } from 'sonner';
import { ShoppingCart, Upload, Check, X } from 'lucide-react';

const DECO_LABELS: Record<string, string> = {
  acryl: 'Акрил', photovstavka: 'Фотовставка', flex: 'Фотодрук Flex',
  metal: 'Метал', graviruvannya: 'Гравіювання',
};

const SIZE_DIMENSIONS: Record<string, { w: number; h: number }> = {
  '20×30': { w: 20, h: 30 }, '30×20': { w: 30, h: 20 }, '23×23': { w: 23, h: 23 },
};

function WishbookCoverEditorContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const router = useRouter();
  const addItem = useCartStore(s => s.addItem);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const size = searchParams.get('size') || '20×30';
  const coverType = searchParams.get('cover') || 'Велюр';
  const coverColor = searchParams.get('cover_color') || '';
  const lamination = searchParams.get('lamination') || '';
  const decoration = searchParams.get('decoration') || '';
  const decorationVariant = searchParams.get('decoration_variant') || '';

  const dims = SIZE_DIMENSIONS[size] || { w: 20, h: 30 };
  const MAX_W = 280;
  const scale = MAX_W / dims.w;
  const canvasW = MAX_W;
  const canvasH = Math.round(dims.h * scale);

  const coverMaterial: CoverConfig['coverMaterial'] =
    coverType.toLowerCase().includes('велюр') ? 'velour' :
    coverType.toLowerCase().includes('шкір') ? 'leatherette' :
    coverType.toLowerCase().includes('тканин') ? 'fabric' : 'printed';

  const colorMap = coverMaterial === 'velour' ? VELOUR_COLORS :
    coverMaterial === 'leatherette' ? LEATHERETTE_COLORS :
    coverMaterial === 'fabric' ? FABRIC_COLORS : {};
  const effectiveHex = (colorMap as Record<string, string>)[coverColor] || '#e8ecf4';

  const [photos, setPhotos] = useState<{ id: string; preview: string }[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [coverState, setCoverState] = useState<CoverConfig>({
    coverMaterial,
    coverColorName: coverColor,
    decoType: (decoration as CoverConfig['decoType']) || 'none',
    decoVariant: decorationVariant,
    decoColor: '',
    photoId: null,
    decoText: '',
    textX: 50, textY: 85,
    textFontFamily: 'Playfair Display, serif',
    textFontSize: 22,
    extraTexts: [],
    printedPhotoSlot: { x: 10, y: 10, w: 80, h: 60, shape: 'rect' },
    printedTextBlocks: [],
    printedOverlay: { type: 'none', color: '#000000', opacity: 0.3, gradient: '' },
    printedBgColor: '#ffffff',
  });

  const config = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(sessionStorage.getItem('bookConstructorConfig') || '{}'); } catch { return {}; } })()
    : {};
  const price = config.totalPrice || 0;

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const newPhotos = await Promise.all(
      Array.from(files).slice(0, 10).map(file => new Promise<{ id: string; preview: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve({ id: Math.random().toString(36).slice(2), preview: e.target?.result as string });
        reader.readAsDataURL(file);
      }))
    );
    setPhotos(prev => [...prev, ...newPhotos]);
  }, []);

  const handleAddToCart = () => {
    addItem({
      id: `wishbook-${Date.now()}`,
      name: 'Книга побажань',
      price,
      qty: 1,
      slug: 'wishbook',
      category_slug: 'wishbook',
      options: { size, cover: coverType, coverColor, lamination, decoration, decorationVariant, coverDesign: coverState },
    });
    toast.success('Книгу побажань додано до кошика!');
    setShowCartModal(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <Navigation />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '90px 16px 60px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', marginBottom: 6 }}>Редактор обкладинки — Книга побажань</h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>Налаштуйте дизайн обкладинки вашої книги побажань</p>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* LEFT: Cover preview */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Обкладинка</div>
            <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
              {/* Back cover */}
              <div style={{ width: Math.round(canvasW * 0.4), height: canvasH, background: effectiveHex, borderRight: '2px solid rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 7, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>ЗАДНЯ</span>
              </div>
              {/* Front cover — CoverEditor */}
              <CoverEditor
                canvasW={canvasW}
                canvasH={canvasH}
                sizeValue={size.replace('×', 'x')}
                config={coverState}
                photos={photos}
                onChange={patch => setCoverState(prev => ({ ...prev, ...patch }))}
              />
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
              {size} см · {coverType}{coverColor ? ` · ${coverColor}` : ''}
            </p>
          </div>

          {/* RIGHT: Controls */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Text — FIRST (primary for wishbook) */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 10 }}> Текст на обкладинці</div>
              <input value={coverState.decoText || ''}
                onChange={e => setCoverState(prev => ({ ...prev, decoText: e.target.value }))}
                placeholder="Наприклад: Наше весілля · 2025"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Photo upload — OPTIONAL, collapsible */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, marginBottom: 14 }}>
              <div 
                onClick={() => {
                  const el = document.getElementById('wishbook-photo-section');
                  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                }}
                style={{ fontSize: 13, fontWeight: 700, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span> Додати фото на обкладинку <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>(необов'язково)</span></span>
                <span style={{ fontSize: 16, color: '#94a3b8' }}></span>
              </div>
              <div id="wishbook-photo-section" style={{ display: 'none', marginTop: 12 }}>
                {photos.length === 0 ? (
                  <div onClick={() => fileInputRef.current?.click()}
                    style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                    <Upload size={22} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, color: '#64748b', fontWeight: 600, margin: 0 }}>Завантажити фото</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, marginBottom: 0 }}>JPG, PNG · до 20 МБ</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {photos.map(ph => (
                      <div key={ph.id} style={{ position: 'relative' }}>
                        <img src={ph.preview} alt=""
                          onClick={() => setCoverState(prev => ({ ...prev, photoId: ph.id }))}
                          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: coverState.photoId === ph.id ? '2px solid #1e2d7d' : '2px solid #e2e8f0' }} />
                        {coverState.photoId === ph.id && (
                          <div style={{ position: 'absolute', top: 2, left: 2, width: 14, height: 14, background: '#1e2d7d', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={8} color="#fff" />
                          </div>
                        )}
                        <button onClick={() => setPhotos(prev => prev.filter(p => p.id !== ph.id))}
                          style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#ef4444', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={8} color="#fff" />
                        </button>
                      </div>
                    ))}
                    <div onClick={() => fileInputRef.current?.click()}
                      style={{ width: 60, height: 60, border: '2px dashed #cbd5e1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', fontSize: 22 }}>+</div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => e.target.files && handleFiles(e.target.files)} />
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: '#f0f3ff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Параметри</div>
              {[
                { label: 'Розмір', value: size },
                { label: 'Обкладинка', value: coverType },
                ...(coverColor ? [{ label: 'Колір', value: coverColor }] : []),
                ...(lamination ? [{ label: 'Ламінація', value: lamination }] : []),
                ...(decoration ? [{ label: 'Оздоблення', value: DECO_LABELS[decoration] || decoration }] : []),
              ].map(p => (
                <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>{p.label}</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{p.value}</span>
                </div>
              ))}
              {price > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#1e2d7d', marginTop: 8, paddingTop: 8, borderTop: '1px solid #c7d2fe' }}>
                  <span>Ціна</span><span>{price} ₴</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleAddToCart}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 24px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                <ShoppingCart size={18} /> {t('photo_print.add_to_cart')}
              </button>
              <button onClick={() => router.back()}
                style={{ padding: '12px 24px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                ← Змінити параметри
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer categories={[]} />
    </div>
  );
}

export default function WishbookOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
      <WishbookCoverEditorContent />
    </Suspense>
  );
}
