'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { Upload, ShoppingCart, X, ChevronLeft } from 'lucide-react';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';
import { useT } from '@/lib/i18n/context';

interface SizeOption {
    label: string;
    value: string;
    price: number;
}

interface PhotoFile {
    id: string;
    file: File;
    preview: string;
    width: number;
    height: number;
}

const STEP_LABELS = ['Розмір', 'Фото', 'Замовлення'];

export default function CanvasPrintConstructor() {
    const t = useT();
    const { addItem } = useCartStore();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [step, setStep] = useState(1); // 1=size, 2=photo, 3=cart
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sizeOptions, setSizeOptions] = useState<SizeOption[]>([]);
    const [selectedSize, setSelectedSize] = useState<SizeOption | null>(null);
    const [photo, setPhoto] = useState<PhotoFile | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [qty, setQty] = useState(1);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function fetchProduct() {
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('slug', 'druk-na-polotni')
                .eq('is_active', true)
                .single();
            if (data) {
                setProduct(data);
                const opts = (data.options || []);
                const sizeOpt = opts.find((o: any) => o.name === 'Розмір');
                if (sizeOpt?.options) {
                    setSizeOptions(sizeOpt.options.map((o: any) => ({
                        label: o.label,
                        value: o.value,
                        price: o.price,
                    })));
                    setSelectedSize({ label: sizeOpt.options[0].label, value: sizeOpt.options[0].value, price: sizeOpt.options[0].price });
                }
            }
            setLoading(false);
        }
        fetchProduct();
    }, []);

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith('image/')) { toast.error('Оберіть зображення'); return; }
        const preview = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((res, rej) => {
            const im = new window.Image(); im.onload = () => res(im); im.onerror = rej; im.src = preview;
        });
        setPhoto({ id: Date.now().toString(), file, preview, width: img.width, height: img.height });
    };

    const handleAddToCart = () => {
        if (!selectedSize || !photo) return;
        addItem({
            id: `canvas-${Date.now()}`,
            product_id: product?.id || 'druk-na-polotni',
            name: `Друк на полотні ${selectedSize.label}`,
            price: selectedSize.price * qty,
            qty,
            image: photo.preview,
            options: { 'Розмір': selectedSize.label },
            slug: 'druk-na-polotni',
            personalization_note: `Файл: ${photo.file.name} (${photo.width}×${photo.height}px)`,
        });
        toast.success(t('canvasprint.added_to_cart'));
        setStep(3);
    };

    // ── Get aspect ratio for size preview ──
    const getSizeDims = (val: string) => {
        const m = val.match(/(\d+)x(\d+)/);
        if (!m) return { w: 1, h: 1 };
        return { w: parseInt(m[1]), h: parseInt(m[2]) };
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e2d7d]" />
        </div>
    );

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 60px', fontFamily: 'var(--font-primary, sans-serif)' }}>

            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', marginBottom: 6 }}>
                    {product?.name || 'Друк на полотні'}
                </h1>
                <p style={{ color: '#64748b', fontSize: 15 }}>
                    {product?.short_description || 'Фотографія на якісному художньому полотні'}
                </p>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 40 }}>
                {STEP_LABELS.map((label, i) => {
                    const n = i + 1;
                    const active = step === n;
                    const done = step > n;
                    return (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: done ? '#10b981' : active ? '#1e2d7d' : '#e2e8f0',
                                    color: done || active ? '#fff' : '#94a3b8',
                                    fontSize: 13, fontWeight: 800, flexShrink: 0
                                }}>
                                    {done ? '✓' : n}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#1e2d7d' : done ? '#10b981' : '#94a3b8' }}>
                                    {label}
                                </span>
                            </div>
                            {i < STEP_LABELS.length - 1 && (
                                <div style={{ flex: 1, height: 2, background: done ? '#10b981' : '#e2e8f0', margin: '0 8px' }} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── STEP 1: SIZE ── */}
            {step === 1 && (
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', marginBottom: 20 }}>{t('canvasprint.select_size')}</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
                        {sizeOptions.map(opt => {
                            const dims = getSizeDims(opt.value);
                            const maxH = 80;
                            const scale = Math.min(maxH / dims.h, 120 / dims.w);
                            const pw = Math.round(dims.w * scale);
                            const ph = Math.round(dims.h * scale);
                            const isSelected = selectedSize?.value === opt.value;
                            return (
                                <button key={opt.value} onClick={() => setSelectedSize(opt)}
                                    style={{
                                        padding: '16px 12px', border: isSelected ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                                        borderRadius: 12, background: isSelected ? '#f0f3ff' : '#fff',
                                        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                                        transition: 'all 0.15s', boxShadow: isSelected ? '0 0 0 1px #1e2d7d' : 'none'
                                    }}>
                                    {/* Visual size preview */}
                                    <div style={{
                                        width: pw, height: ph, border: `2px solid ${isSelected ? '#1e2d7d' : '#cbd5e1'}`,
                                        borderRadius: 3, background: isSelected ? '#dbeafe' : '#f1f5f9',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 9, color: isSelected ? '#1e2d7d' : '#94a3b8', fontWeight: 600
                                    }}>
                                        {opt.value.replace('x', '×')} см
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#1e2d7d' : '#374151' }}>{opt.label}</div>
                                        <div style={{ fontSize: 14, fontWeight: 900, color: isSelected ? '#1e2d7d' : '#1e2d7d', marginTop: 2 }}>{opt.price} ₴</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {selectedSize && (
                        <div style={{ background: '#f0f3ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '14px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: 13, color: '#64748b' }}>{t('canvasprint.selected_size')}</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d' }}>{selectedSize.label}</div>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: '#1e2d7d' }}>{selectedSize.price} ₴</div>
                        </div>
                    )}

                    <button onClick={() => setStep(2)} disabled={!selectedSize}
                        style={{
                            width: '100%', padding: '16px', background: selectedSize ? '#1e2d7d' : '#94a3b8',
                            color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 800,
                            cursor: selectedSize ? 'pointer' : 'not-allowed', transition: 'background 0.2s'
                        }}>
                        Далі — завантажити фото →
                    </button>
                </div>
            )}

            {/* ── STEP 2: PHOTO UPLOAD ── */}
            {step === 2 && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <button onClick={() => setStep(1)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                            <ChevronLeft size={16} /> Назад
                        </button>
                        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>{t('canvasprint.upload_photo')}</h2>
                    </div>

                    {/* Recommendations */}
                    {selectedSize && (() => {
                        const dims = getSizeDims(selectedSize.value);
                        const minPx = Math.max(dims.w, dims.h) * 40; // ~40px/cm for print quality
                        return (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400e' }}>
                                💡 Для розміру <b>{selectedSize.label}</b> рекомендовано фото від <b>{minPx}×{Math.round(minPx * dims.h / dims.w)} px</b> (300 dpi). Мінімум — 150 dpi.
                            </div>
                        );
                    })()}

                    {/* Drop zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files); }}
                        onClick={() => !photo && fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${isDragging ? '#1e2d7d' : photo ? '#10b981' : '#c7d2fe'}`,
                            borderRadius: 12, padding: photo ? 0 : '48px 24px',
                            background: isDragging ? '#eff6ff' : photo ? '#f0fdf4' : '#f8faff',
                            cursor: photo ? 'default' : 'pointer', textAlign: 'center',
                            transition: 'all 0.2s', marginBottom: 24, overflow: 'hidden',
                            minHeight: photo ? 0 : 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                        }}>
                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => handleFileSelect(e.target.files)} />

                        {photo ? (
                            <div style={{ position: 'relative' }}>
                                <img src={photo.preview} alt="preview"
                                    style={{ maxHeight: 400, maxWidth: '100%', display: 'block', objectFit: 'contain' }} />
                                <button onClick={e => { e.stopPropagation(); setPhoto(null); }}
                                    style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                    <X size={16} />
                                </button>
                                <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, padding: '4px 8px', borderRadius: 6 }}>
                                    {photo.width} × {photo.height} px
                                </div>
                            </div>
                        ) : (
                            <>
                                <Upload size={40} color="#93c5fd" style={{ marginBottom: 12 }} />
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#1e2d7d', marginBottom: 6 }}>
                                    Перетягніть фото або натисніть для вибору
                                </div>
                                <div style={{ fontSize: 13, color: '#94a3b8' }}>{t('canvasprint.file_types')}</div>
                            </>
                        )}
                    </div>

                    {photo && (
                        <div style={{ marginBottom: 20 }}>
                            <button onClick={() => fileInputRef.current?.click()}
                                style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                                ↺ Обрати інше фото
                            </button>
                        </div>
                    )}

                    {/* Quantity + price */}
                    {photo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{t('canvasprint.quantity')}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                                    style={{ width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#1e2d7d' }}>−</button>
                                <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 800, fontSize: 16, color: '#1e2d7d' }}>{qty}</span>
                                <button onClick={() => setQty(q => q + 1)}
                                    style={{ width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#1e2d7d' }}>+</button>
                            </div>
                            <div style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 900, color: '#1e2d7d' }}>
                                {(selectedSize!.price * qty).toLocaleString('uk-UA')} ₴
                            </div>
                        </div>
                    )}

                    {/* QR Code Generator */}
                    <div style={{ marginBottom: 12 }}><QRCodeGenerator compact label={t('canvasprint.add_qr')} /></div>

                    <button onClick={handleAddToCart} disabled={!photo}
                        style={{
                            width: '100%', padding: '16px', background: photo ? '#1e2d7d' : '#94a3b8',
                            color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 800,
                            cursor: photo ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'background 0.2s'
                        }}>
                        <ShoppingCart size={20} /> Додати до кошика
                    </button>
                </div>
            )}

            {/* ── STEP 3: ADDED TO CART ── */}
            {step === 3 && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: 60, marginBottom: 16 }}>🎨</div>
                    <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e2d7d', marginBottom: 8 }}>{t('canvasprint.added_to_cart')}</h2>
                    <p style={{ color: '#64748b', marginBottom: 32, fontSize: 15 }}>
                        Полотно <b>{selectedSize?.label}</b> чекає на тебе в кошику
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a href="/checkout"
                            style={{ padding: '14px 32px', background: '#1e2d7d', color: '#fff', borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: 'none', display: 'inline-block' }}>
                            Оформити замовлення →
                        </a>
                        <a href="/catalog"
                            style={{ padding: '14px 32px', background: '#fff', color: '#1e2d7d', border: '2px solid #1e2d7d', borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: 'none', display: 'inline-block' }}>
                            ← Продовжити покупки
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
