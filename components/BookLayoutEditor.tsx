'use client';

import { useState, useEffect, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ShoppingCart, Image as ImageIcon, Type, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';

interface PhotoData {
    id: string;
    preview: string;
    width: number;
    height: number;
    name: string;
}

interface BookConfig {
    productSlug: string;
    productName: string;
    selectedSize?: string;
    selectedCoverType?: string;
    selectedPageCount: string;
    totalPrice: number;
    enableKalka?: boolean;
    enableEndpaper?: boolean;
}

interface Spread {
    id: number;
    type: 'cover' | 'content' | 'endpaper';
    label: string;
    leftSlot: string | null;  // photoId or null
    rightSlot: string | null; // photoId or null
}

const SPREAD_DIMENSIONS: Record<string, { width: number; height: number }> = {
    '20×20': { width: 405, height: 203 },
    '25×25': { width: 500, height: 254 },
    '20×30': { width: 420, height: 305 },
    '30×20': { width: 610, height: 203 },
    '30×30': { width: 610, height: 305 },
    'A4':    { width: 420, height: 297 },
};

export default function BookLayoutEditor() {
    const router = useRouter();
    const { addItem } = useCartStore();

    const [config, setConfig] = useState<BookConfig | null>(null);
    const [photos, setPhotos] = useState<PhotoData[]>([]);
    const [spreads, setSpreads] = useState<Spread[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [zoom, setZoom] = useState(50);
    const [leftTab, setLeftTab] = useState<'photos' | 'text'>('photos');
    const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    // ─── Load config & photos from sessionStorage ───
    useEffect(() => {
        const configJson = sessionStorage.getItem('bookConstructorConfig');
        if (configJson) {
            setConfig(JSON.parse(configJson));
        } else {
            toast.error('Конфігурація не знайдена');
            router.push('/order/book');
            return;
        }
        const photosJson = sessionStorage.getItem('bookConstructorPhotos');
        if (photosJson) {
            setPhotos(JSON.parse(photosJson));
        } else {
            toast.error('Фото не знайдені');
            router.push('/editor/book/upload');
        }
    }, [router]);

    // ─── Initialize spreads ───
    useEffect(() => {
        if (!config) return;
        const m = config.selectedPageCount.match(/(\d+)/);
        const totalPages = m ? parseInt(m[0]) : 20;
        const newSpreads: Spread[] = [];

        // Cover
        newSpreads.push({ id: 0, type: 'cover', label: 'Обкладинка', leftSlot: null, rightSlot: null });

        // Content spreads
        for (let i = 0; i < totalPages; i += 2) {
            newSpreads.push({
                id: newSpreads.length,
                type: 'content',
                label: `${i + 1}–${i + 2}`,
                leftSlot: null,
                rightSlot: null,
            });
        }

        setSpreads(newSpreads);
    }, [config]);

    // ─── Helpers ───
    const usedPhotoIds = new Set(spreads.flatMap(s => [s.leftSlot, s.rightSlot].filter(Boolean)));
    const currentSpread = spreads[currentIdx];
    const dims = config?.selectedSize
        ? SPREAD_DIMENSIONS[config.selectedSize.replace(/[хxX]/g, '×')] || SPREAD_DIMENSIONS['A4']
        : SPREAD_DIMENSIONS['A4'];
    const scale = zoom / 100;
    const canvasW = dims.width * scale * 2; // 2 pages
    const canvasH = dims.height * scale * 2;
    const pageW = canvasW / 2;

    const allSlotsFilled = spreads.every(s => {
        if (s.type === 'cover') return s.rightSlot !== null; // only front cover required
        return s.leftSlot !== null && s.rightSlot !== null;
    });

    const getPhotoPreview = (id: string | null) => {
        if (!id) return null;
        return photos.find(p => p.id === id)?.preview || null;
    };

    // ─── Drag & Drop ───
    const onDragStart = (photoId: string) => setDragPhotoId(photoId);
    const onDragEnd = () => { setDragPhotoId(null); setDropTarget(null); };

    const onSlotDragOver = (e: DragEvent, slotKey: string) => {
        e.preventDefault();
        setDropTarget(slotKey);
    };
    const onSlotDragLeave = () => setDropTarget(null);

    const onSlotDrop = (e: DragEvent, spreadIdx: number, side: 'left' | 'right') => {
        e.preventDefault();
        setDropTarget(null);
        if (!dragPhotoId) return;
        setSpreads(prev => prev.map((s, i) => {
            if (i !== spreadIdx) return s;
            return side === 'left' ? { ...s, leftSlot: dragPhotoId } : { ...s, rightSlot: dragPhotoId };
        }));
        setDragPhotoId(null);
    };

    const clearSlot = (spreadIdx: number, side: 'left' | 'right') => {
        setSpreads(prev => prev.map((s, i) => {
            if (i !== spreadIdx) return s;
            return side === 'left' ? { ...s, leftSlot: null } : { ...s, rightSlot: null };
        }));
    };

    // ─── Add to cart ───
    const handleAddToCart = () => {
        if (!allSlotsFilled) {
            toast.error('Заповніть всі сторінки перед замовленням');
            return;
        }
        if (!config) return;

        addItem({
            id: `photobook-${Date.now()}`,
            name: config.productName || 'Фотокнига',
            price: config.totalPrice,
            qty: 1,
            image: getPhotoPreview(spreads[0]?.rightSlot) || '/placeholder-poster.jpg',
            options: {
                'Розмір': config.selectedSize || '',
                'Сторінок': config.selectedPageCount,
                'Фото': `${photos.length} шт`,
            },
            personalization_note: `Розкладка: ${spreads.length} розворотів`,
        });

        toast.success('Додано до кошика!');
        router.push('/cart');
    };

    if (!config || spreads.length === 0) {
        return <div className="min-h-screen flex items-center justify-center">Завантаження редактора...</div>;
    }

    // ─── Photo Slot component ───
    const PhotoSlot = ({ spreadIdx, side, isCover }: { spreadIdx: number; side: 'left' | 'right'; isCover?: boolean }) => {
        const photoId = side === 'left' ? spreads[spreadIdx].leftSlot : spreads[spreadIdx].rightSlot;
        const preview = getPhotoPreview(photoId);
        const slotKey = `${spreadIdx}-${side}`;
        const isOver = dropTarget === slotKey;

        return (
            <div
                onDragOver={(e) => onSlotDragOver(e, slotKey)}
                onDragLeave={onSlotDragLeave}
                onDrop={(e) => onSlotDrop(e, spreadIdx, side)}
                style={{
                    width: isCover ? pageW : pageW,
                    height: canvasH,
                    backgroundColor: preview ? 'transparent' : '#f1f5f9',
                    border: isOver ? '3px dashed #1e2d7d' : '1px solid #e2e8f0',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'border-color 0.15s',
                    cursor: dragPhotoId ? 'copy' : 'default',
                }}
            >
                {preview ? (
                    <>
                        <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                        <button
                            onClick={() => clearSlot(spreadIdx, side)}
                            style={{
                                position: 'absolute', top: 6, right: 6,
                                background: 'rgba(0,0,0,0.6)', color: '#fff',
                                border: 'none', borderRadius: '50%', width: 28, height: 28,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 8 }}>
                        <ImageIcon size={32} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Перетягніть фото</span>
                    </div>
                )}
            </div>
        );
    };

    // ─── Spread Thumbnail for right panel ───
    const SpreadThumb = ({ spread, idx }: { spread: Spread; idx: number }) => {
        const isActive = idx === currentIdx;
        const leftPrev = getPhotoPreview(spread.leftSlot);
        const rightPrev = getPhotoPreview(spread.rightSlot);

        return (
            <button
                onClick={() => setCurrentIdx(idx)}
                style={{
                    width: '100%', padding: '6px',
                    border: isActive ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                    borderRadius: 6, background: isActive ? '#f0f3ff' : '#fff',
                    cursor: 'pointer', textAlign: 'center',
                }}
            >
                <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                    <div style={{ flex: 1, aspectRatio: `${dims.width}/${dims.height}`, background: leftPrev ? `url(${leftPrev}) center/cover` : '#f1f5f9', borderRadius: 2 }} />
                    {spread.type !== 'cover' && (
                        <div style={{ flex: 1, aspectRatio: `${dims.width}/${dims.height}`, background: rightPrev ? `url(${rightPrev}) center/cover` : '#f1f5f9', borderRadius: 2 }} />
                    )}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? '#1e2d7d' : '#64748b' }}>{spread.label}</span>
            </button>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
            {/* ═══ TOP BAR ═══ */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0',
                flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#1e2d7d' }}>
                        {config.productName || 'Фотокнига'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                        Крок 3: Розміщення фото • {photos.length} фото завантажено
                    </div>
                </div>

                {/* Zoom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setZoom(z => Math.max(20, z - 10))} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                        <ZoomOut size={16} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', minWidth: 40, textAlign: 'center' }}>{zoom}%</span>
                    <button onClick={() => setZoom(z => Math.min(150, z + 10))} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                        <ZoomIn size={16} />
                    </button>
                </div>

                {/* Add to cart */}
                <button
                    onClick={handleAddToCart}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 24px', background: allSlotsFilled ? '#1e2d7d' : '#94a3b8',
                        color: '#fff', border: 'none', borderRadius: 8,
                        fontWeight: 700, fontSize: 14, cursor: allSlotsFilled ? 'pointer' : 'not-allowed',
                    }}
                >
                    <ShoppingCart size={16} />
                    Додати до кошика • {config.totalPrice} ₴
                </button>
            </div>

            {/* ═══ 3-PANEL BODY ═══ */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── LEFT PANEL: Media & Elements ── */}
                <div style={{ width: 240, borderRight: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setLeftTab('photos')}
                            style={{
                                flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                                fontWeight: 700, fontSize: 13,
                                background: leftTab === 'photos' ? '#f0f3ff' : '#fff',
                                color: leftTab === 'photos' ? '#1e2d7d' : '#64748b',
                                borderBottom: leftTab === 'photos' ? '2px solid #1e2d7d' : 'none',
                            }}
                        >
                            <ImageIcon size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                            Фото ({photos.length})
                        </button>
                        <button
                            onClick={() => setLeftTab('text')}
                            style={{
                                flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                                fontWeight: 700, fontSize: 13,
                                background: leftTab === 'text' ? '#f0f3ff' : '#fff',
                                color: leftTab === 'text' ? '#1e2d7d' : '#64748b',
                                borderBottom: leftTab === 'text' ? '2px solid #1e2d7d' : 'none',
                            }}
                        >
                            <Type size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                            Текст
                        </button>
                    </div>

                    {/* Panel Content */}
                    <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                        {leftTab === 'photos' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {photos.map((photo, i) => {
                                    const isUsed = usedPhotoIds.has(photo.id);
                                    return (
                                        <div
                                            key={photo.id}
                                            draggable={!isUsed}
                                            onDragStart={() => !isUsed && onDragStart(photo.id)}
                                            onDragEnd={onDragEnd}
                                            style={{
                                                position: 'relative',
                                                aspectRatio: '1',
                                                borderRadius: 6,
                                                overflow: 'hidden',
                                                cursor: isUsed ? 'default' : 'grab',
                                                opacity: isUsed ? 0.4 : 1,
                                                border: '1px solid #e2e8f0',
                                            }}
                                        >
                                            <img
                                                src={photo.preview}
                                                alt={photo.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                draggable={false}
                                            />
                                            <span style={{
                                                position: 'absolute', bottom: 2, left: 2,
                                                background: isUsed ? '#10b981' : 'rgba(0,0,0,0.6)',
                                                color: '#fff', fontSize: 10, fontWeight: 700,
                                                padding: '1px 5px', borderRadius: 4,
                                            }}>
                                                {i + 1}{isUsed && ' ✓'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                                <Type size={32} style={{ marginBottom: 8 }} />
                                <p style={{ fontSize: 13, fontWeight: 600 }}>Текст (скоро)</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── CENTER PANEL: Canvas ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 24 }}>
                    {/* Spread label */}
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e2d7d', marginBottom: 12 }}>
                        {currentSpread?.label}
                    </div>

                    {/* Canvas */}
                    <div style={{ display: 'flex', gap: currentSpread?.type === 'cover' ? 0 : 2, justifyContent: 'center' }}>
                        {currentSpread?.type === 'cover' ? (
                            // Cover: single centered page (front cover = right slot)
                            <PhotoSlot spreadIdx={currentIdx} side="right" isCover />
                        ) : (
                            <>
                                <PhotoSlot spreadIdx={currentIdx} side="left" />
                                <PhotoSlot spreadIdx={currentIdx} side="right" />
                            </>
                        )}
                    </div>

                    {/* Page numbers */}
                    <div style={{ display: 'flex', gap: currentSpread?.type === 'cover' ? 0 : 2, marginTop: 8 }}>
                        {currentSpread?.type === 'cover' ? (
                            <span style={{ width: pageW, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>Обкладинка</span>
                        ) : (
                            <>
                                <span style={{ width: pageW, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                                    Стор. {(currentIdx - 1) * 2 + 1}
                                </span>
                                <span style={{ width: pageW, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                                    Стор. {(currentIdx - 1) * 2 + 2}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* ── RIGHT PANEL: Spread Navigator ── */}
                <div style={{ width: 200, borderLeft: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d' }}>Розвороти</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{spreads.length}</span>
                    </div>

                    <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {spreads.map((spread, idx) => (
                            <SpreadThumb key={spread.id} spread={spread} idx={idx} />
                        ))}
                    </div>

                    {/* Prev/Next */}
                    <div style={{ display: 'flex', borderTop: '1px solid #e2e8f0', padding: 8, gap: 8 }}>
                        <button
                            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                            disabled={currentIdx === 0}
                            style={{
                                flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 6,
                                background: '#fff', cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                                opacity: currentIdx === 0 ? 0.4 : 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentIdx(i => Math.min(spreads.length - 1, i + 1))}
                            disabled={currentIdx === spreads.length - 1}
                            style={{
                                flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 6,
                                background: '#fff', cursor: currentIdx === spreads.length - 1 ? 'not-allowed' : 'pointer',
                                opacity: currentIdx === spreads.length - 1 ? 0.4 : 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
