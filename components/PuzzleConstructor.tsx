'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { Upload, ShoppingCart, X, ChevronLeft } from 'lucide-react';

interface PieceOption {
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

const STEP_LABELS = ['Деталі', 'Фото', 'Замовлення'];

// Puzzle size info per slug
const PUZZLE_INFO: Record<string, { label: string; dims: string; ratio: number; desc: string }> = {
    'puzzle-a4':   { label: 'Пазл A4',          dims: '21×29,7 см', ratio: 210/297, desc: 'Формат A4 (21×29,7 см)' },
    'puzzle-20x30':{ label: 'Фотопазл 20×30',   dims: '20×30 см',   ratio: 20/30,   desc: 'Класичний формат 20×30 см' },
};

export default function PuzzleConstructor({ productSlug }: { productSlug: string }) {
    const { addItem } = useCartStore();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [step, setStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [pieceOptions, setPieceOptions] = useState<PieceOption[]>([]);
    const [selectedPieces, setSelectedPieces] = useState<PieceOption | null>(null);
    const [photo, setPhoto] = useState<PhotoFile | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [qty, setQty] = useState(1);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const info = PUZZLE_INFO[productSlug] || PUZZLE_INFO['puzzle-20x30'];

    useEffect(() => {
        async function fetchProduct() {
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('slug', productSlug)
                .eq('is_active', true)
                .single();
            if (data) {
                setProduct(data);
                const opts = (data.options || []);
                const piecesOpt = opts.find((o: any) => o.name === 'Кількість деталей');
                if (piecesOpt?.options?.length) {
                    const mapped = piecesOpt.options.map((o: any) => ({
                        label: o.label, value: o.value, price: o.price,
                    }));
                    setPieceOptions(mapped);
                    setSelectedPieces(mapped[0]);
                }
            }
            setLoading(false);
        }
        fetchProduct();
    }, [productSlug]);

    const totalPrice = product ? (Number(product.price) + (selectedPieces?.price || 0)) * qty : 0;

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
        if (!selectedPieces || !photo) return;
        addItem({
            id: `puzzle-${Date.now()}`,
            product_id: product?.id || productSlug,
            name: `${product?.name || info.label} · ${selectedPieces.label}`,
            price: totalPrice,
            qty,
            image: photo.preview,
            options: {
                'Розмір': info.dims,
                'Кількість деталей': selectedPieces.label,
            },
            slug: productSlug,
            personalization_note: `Файл: ${photo.file.name} (${photo.width}×${photo.height}px)`,
        });
        toast.success('Додано до кошика!');
        setStep(3);
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e2d7d]" />
        </div>
    );

    return (
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 60px', fontFamily: 'var(--font-primary, sans-serif)' }}>

            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', marginBottom: 6 }}>
                    {product?.name || info.label}
                </h1>
                <p style={{ color: '#64748b', fontSize: 15 }}>
                    {info.desc} · {product?.short_description || 'Пазл з вашою фотографією'}
                </p>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 40 }}>
                {STEP_LABELS.map((label, i) => {
                    const n = i + 1;
                    const active = step === n, done = step > n;
                    return (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: done ? '#10b981' : active ? '#1e2d7d' : '#e2e8f0',
                                    color: done || active ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 800, flexShrink: 0
                                }}>{done ? '✓' : n}</div>
                                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#1e2d7d' : done ? '#10b981' : '#94a3b8' }}>{label}</span>
                            </div>
                            {i < STEP_LABELS.length - 1 && (
                                <div style={{ flex: 1, height: 2, background: done ? '#10b981' : '#e2e8f0', margin: '0 8px' }} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── STEP 1: PIECES ── */}
            {step === 1 && (
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>Оберіть кількість деталей</h2>
                    <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
                        Розмір пазла: <b>{info.dims}</b>. Більше деталей — складніше і цікавіше!
                    </p>

                    {/* Puzzle format visual */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{
                            width: Math.round(160 * info.ratio), height: 160,
                            background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
                            border: '2px solid #93c5fd', borderRadius: 8, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0, position: 'relative', overflow: 'hidden'
                        }}>
                            {/* Puzzle piece lines */}
                            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.25 }}>
                                <line x1="33%" y1="0" x2="33%" y2="100%" stroke="#1e2d7d" strokeWidth="1" strokeDasharray="4,4"/>
                                <line x1="66%" y1="0" x2="66%" y2="100%" stroke="#1e2d7d" strokeWidth="1" strokeDasharray="4,4"/>
                                <line x1="0" y1="33%" x2="100%" y2="33%" stroke="#1e2d7d" strokeWidth="1" strokeDasharray="4,4"/>
                                <line x1="0" y1="66%" x2="100%" y2="66%" stroke="#1e2d7d" strokeWidth="1" strokeDasharray="4,4"/>
                            </svg>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e2d7d', zIndex: 1 }}>{info.dims}</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
                                🧩 Матеріал: картон 1.5 мм<br/>
                                🎨 Друк: повноколірний, глянець<br/>
                                📦 В комплекті: пазл + коробка з зображенням
                            </div>
                        </div>
                    </div>

                    {/* Pieces selector */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                        {pieceOptions.map(opt => {
                            const isSelected = selectedPieces?.value === opt.value;
                            const basePrice = product ? Number(product.price) : 0;
                            return (
                                <button key={opt.value} onClick={() => setSelectedPieces(opt)}
                                    style={{
                                        padding: '20px 16px', border: isSelected ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                                        borderRadius: 12, background: isSelected ? '#f0f3ff' : '#fff',
                                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                                        boxShadow: isSelected ? '0 0 0 1px #1e2d7d' : 'none'
                                    }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>
                                        {opt.value === '120' ? '🟦' : opt.value === '252' ? '🧩' : '🔷'}
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: isSelected ? '#1e2d7d' : '#374151', marginBottom: 4 }}>
                                        {opt.label}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                                        {opt.value === '120' ? 'Легкий рівень' : opt.value === '252' ? 'Середній рівень' : 'Складний рівень'}
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 900, color: '#1e2d7d' }}>
                                        {basePrice + opt.price} ₴
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <button onClick={() => setStep(2)} disabled={!selectedPieces}
                        style={{
                            width: '100%', padding: '16px', background: '#1e2d7d',
                            color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 800,
                            cursor: 'pointer', transition: 'background 0.2s'
                        }}>
                        Далі — завантажити фото →
                    </button>
                </div>
            )}

            {/* ── STEP 2: PHOTO ── */}
            {step === 2 && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <button onClick={() => setStep(1)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                            <ChevronLeft size={16} /> Назад
                        </button>
                        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Завантажте фото для пазла</h2>
                    </div>

                    {/* Tip */}
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400e' }}>
                        💡 Рекомендуємо яскраве фото з чіткими деталями. Для формату <b>{info.dims}</b> — мінімум <b>1200×1800 px</b>. Пропорція фото буде збережена.
                    </div>

                    {/* Drop zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files); }}
                        onClick={() => !photo && fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${isDragging ? '#1e2d7d' : photo ? '#10b981' : '#c7d2fe'}`,
                            borderRadius: 12, background: isDragging ? '#eff6ff' : photo ? '#f0fdf4' : '#f8faff',
                            cursor: photo ? 'default' : 'pointer', textAlign: 'center',
                            transition: 'all 0.2s', marginBottom: 20, overflow: 'hidden',
                            minHeight: photo ? 0 : 200, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => handleFileSelect(e.target.files)} />

                        {photo ? (
                            <div style={{ position: 'relative', width: '100%' }}>
                                <img src={photo.preview} alt="preview"
                                    style={{ maxHeight: 380, maxWidth: '100%', display: 'block', margin: '0 auto', objectFit: 'contain' }} />
                                <button onClick={e => { e.stopPropagation(); setPhoto(null); }}
                                    style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                    <X size={16} />
                                </button>
                                <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, padding: '4px 8px', borderRadius: 6 }}>
                                    {photo.width} × {photo.height} px · {photo.file.name}
                                </div>
                            </div>
                        ) : (
                            <>
                                <Upload size={40} color="#93c5fd" style={{ marginBottom: 12 }} />
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#1e2d7d', marginBottom: 6 }}>
                                    Перетягніть фото або натисніть для вибору
                                </div>
                                <div style={{ fontSize: 13, color: '#94a3b8' }}>JPG, PNG · до 50 МБ</div>
                            </>
                        )}
                    </div>

                    {photo && (
                        <button onClick={() => fileInputRef.current?.click()}
                            style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 16 }}>
                            ↺ Обрати інше фото
                        </button>
                    )}

                    {/* Qty + price */}
                    {photo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                            <div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Пазл</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                                    {info.dims} · {selectedPieces?.label}
                                </div>
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <button onClick={() => setQty(q => Math.max(1, q - 1))}
                                        style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#1e2d7d' }}>−</button>
                                    <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 800, fontSize: 15, color: '#1e2d7d' }}>{qty}</span>
                                    <button onClick={() => setQty(q => q + 1)}
                                        style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#1e2d7d' }}>+</button>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 900, color: '#1e2d7d' }}>{totalPrice} ₴</div>
                            </div>
                        </div>
                    )}

                    <button onClick={handleAddToCart} disabled={!photo}
                        style={{
                            width: '100%', padding: '16px', background: photo ? '#1e2d7d' : '#94a3b8',
                            color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 800,
                            cursor: photo ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'background 0.2s'
                        }}>
                        <ShoppingCart size={20} /> Додати до кошика
                    </button>
                </div>
            )}

            {/* ── STEP 3: DONE ── */}
            {step === 3 && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: 60, marginBottom: 16 }}>🧩</div>
                    <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e2d7d', marginBottom: 8 }}>Додано до кошика!</h2>
                    <p style={{ color: '#64748b', marginBottom: 32, fontSize: 15 }}>
                        Пазл <b>{info.dims} · {selectedPieces?.label}</b> чекає на тебе в кошику
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
