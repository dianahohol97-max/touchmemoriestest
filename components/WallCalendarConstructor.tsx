'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { toast } from 'sonner';
import {
    ChevronLeft, ChevronRight, ShoppingCart, Upload,
    ZoomIn, ZoomOut, RotateCcw, LayoutGrid, Image as ImageIcon
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Photo { id: string; preview: string; width: number; height: number; name: string; }
interface Slot { photoId: string | null; cropX: number; cropY: number; zoom: number; }

type Layout = '1-full' | '1-top' | '2-h' | '2-v' | '3-top1-bot2' | '3-left1-right2' | '4-grid';

interface MonthPage {
    id: string;
    month: number; // 1–12
    year: number;
    layout: Layout;
    slots: Slot[];
}

interface CoverPage {
    id: string;
    type: 'cover';
    layout: Layout;
    slots: Slot[];
}

type Page = CoverPage | MonthPage;

const MONTHS_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                   'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const DAYS_UK   = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

// A4: 210×297mm, A3: 297×420mm — both portrait
const SIZE_DIMS = {
    A4: { w: 210, h: 297, label: 'A4 (21×29.7 см)' },
    A3: { w: 297, h: 420, label: 'A3 (29.7×42 см)' },
};

function makeSlots(n: number): Slot[] {
    return Array.from({ length: n }, () => ({ photoId: null, cropX: 50, cropY: 50, zoom: 1 }));
}

const LAYOUTS: { id: Layout; label: string; slots: number; icon: string }[] = [
    { id: '1-full',           label: '1 фото',      slots: 1, icon: '⬜' },
    { id: '1-top',            label: '1 зверху',    slots: 1, icon: '⬛' },
    { id: '2-h',              label: '2 горизонт.', slots: 2, icon: '▬▬' },
    { id: '2-v',              label: '2 вертик.',   slots: 2, icon: '▮▮' },
    { id: '3-top1-bot2',      label: '3 (1+2)',     slots: 3, icon: '⬛⬛' },
    { id: '3-left1-right2',   label: '3 (1|2)',     slots: 3, icon: '▮▮▮' },
    { id: '4-grid',           label: '4 сітка',     slots: 4, icon: '⊞' },
];

// ─── Calendar grid generator ──────────────────────────────────────────────────
function buildMonthGrid(year: number, month: number) {
    // month: 1–12
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    // Reorder: Mon=0 ... Sun=6
    const startOffset = (firstDay + 6) % 7;
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

// ─── Calendar Grid SVG ───────────────────────────────────────────────────────
function CalendarGridSVG({ year, month, W, accentColor }: { year: number; month: number; W: number; accentColor: string }) {
    const cells = buildMonthGrid(year, month);
    const rows = cells.length / 7;
    const cellW = W / 7;
    const headerH = 16;
    const cellH = (W * 0.42) / rows;
    const totalH = headerH + rows * cellH;
    const firstDay = new Date(year, month - 1, 1).getDay();

    return (
        <svg width={W} height={totalH} style={{ display: 'block' }}>
            {/* Day headers */}
            {DAYS_UK.map((d, i) => (
                <text key={d} x={cellW * i + cellW / 2} y={headerH - 3}
                    textAnchor="middle" fontSize={cellW * 0.22} fontWeight="700"
                    fill={i >= 5 ? accentColor : '#555'} fontFamily="sans-serif">
                    {d}
                </text>
            ))}
            {/* Separator */}
            <line x1={0} y1={headerH} x2={W} y2={headerH} stroke="#ddd" strokeWidth={0.5} />
            {/* Day cells */}
            {cells.map((day, idx) => {
                const col = idx % 7;
                const row = Math.floor(idx / 7);
                const x = col * cellW + cellW / 2;
                const y = headerH + row * cellH + cellH * 0.6;
                if (!day) return null;
                const isWeekend = col >= 5;
                return (
                    <text key={idx} x={x} y={y} textAnchor="middle"
                        fontSize={cellW * 0.28} fontFamily="sans-serif"
                        fill={isWeekend ? accentColor : '#222'}>
                        {day}
                    </text>
                );
            })}
        </svg>
    );
}

// ─── Photo area renderer ──────────────────────────────────────────────────────
function PhotoArea({ slot, photo, W, H, onDrop, onCropChange, onDragStart }:
    { slot: Slot; photo: Photo | null; W: number; H: number;
      onDrop: (photoId: string) => void; onCropChange: (x: number, y: number, zoom: number) => void;
      onDragStart?: () => void; }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; startY: number; cropX: number; cropY: number } | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!photo) return;
        e.preventDefault();
        dragRef.current = { startX: e.clientX, startY: e.clientY, cropX: slot.cropX, cropY: slot.cropY };
        const up = () => { dragRef.current = null; window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', move); };
        const move = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            const dx = (ev.clientX - dragRef.current.startX) / W * 100 / (slot.zoom || 1);
            const dy = (ev.clientY - dragRef.current.startY) / H * 100 / (slot.zoom || 1);
            onCropChange(Math.max(0, Math.min(100, dragRef.current.cropX - dx)), Math.max(0, Math.min(100, dragRef.current.cropY - dy)), slot.zoom);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        onCropChange(slot.cropX, slot.cropY, Math.max(0.5, Math.min(3, (slot.zoom || 1) + (e.deltaY > 0 ? -0.1 : 0.1))));
    };

    return (
        <div ref={containerRef} style={{ width: W, height: H, overflow: 'hidden', position: 'relative', cursor: photo ? 'grab' : 'default', background: '#f1f5f9' }}
            onMouseDown={handleMouseDown} onWheel={handleWheel}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('photo-id'); if (id) onDrop(id); }}>
            {photo ? (
                <img src={photo.preview} draggable={false} style={{
                    width: `${(slot.zoom || 1) * 100}%`, height: `${(slot.zoom || 1) * 100}%`,
                    objectFit: 'cover', position: 'absolute', top: '50%', left: '50%',
                    transform: `translate(calc(-50% + ${(50 - slot.cropX) * (slot.zoom || 1) * 0.5}px), calc(-50% + ${(50 - slot.cropY) * (slot.zoom || 1) * 0.5}px))`,
                    userSelect: 'none', pointerEvents: 'none',
                }} />
            ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 11, gap: 6, background: '#f8fafc', border: '1.5px dashed #d1d5db' }}>
                    <ImageIcon size={20} color="#d1d5db" />
                    <span>Перетягніть фото</span>
                </div>
            )}
        </div>
    );
}

// ─── Page Preview ─────────────────────────────────────────────────────────────
function PagePreview({ page, photos, size, accentColor, onSlotDrop, onCropChange, isCover, activeSlotIdx, setActiveSlotIdx }:
    { page: Page; photos: Photo[]; size: 'A4' | 'A3'; accentColor: string;
      onSlotDrop: (slotIdx: number, photoId: string) => void;
      onCropChange: (slotIdx: number, x: number, y: number, zoom: number) => void;
      isCover: boolean; activeSlotIdx: number | null; setActiveSlotIdx: (i: number | null) => void; }) {

    const dims = SIZE_DIMS[size];
    // Canvas: photo area top, calendar grid bottom (for month pages)
    const SCALE = 480 / dims.h;
    const W = Math.round(dims.w * SCALE);
    const H = 480;

    // Photo zone height: cover=100%, month=60%
    const photoZoneH = isCover ? H : Math.round(H * 0.58);
    const gridZoneH = isCover ? 0 : H - photoZoneH;

    const getSlotDefs = (layout: Layout, W: number, H: number): { x: number; y: number; w: number; h: number }[] => {
        const g = 2;
        switch (layout) {
            case '1-full': return [{ x: 0, y: 0, w: W, h: H }];
            case '1-top':  return [{ x: 0, y: 0, w: W, h: H * 0.75 }];
            case '2-h':    return [{ x: 0, y: 0, w: W, h: (H - g) / 2 }, { x: 0, y: (H - g) / 2 + g, w: W, h: (H - g) / 2 }];
            case '2-v':    return [{ x: 0, y: 0, w: (W - g) / 2, h: H }, { x: (W - g) / 2 + g, y: 0, w: (W - g) / 2, h: H }];
            case '3-top1-bot2': return [
                { x: 0, y: 0, w: W, h: H * 0.55 },
                { x: 0, y: H * 0.55 + g, w: (W - g) / 2, h: H * 0.45 - g },
                { x: (W - g) / 2 + g, y: H * 0.55 + g, w: (W - g) / 2, h: H * 0.45 - g },
            ];
            case '3-left1-right2': return [
                { x: 0, y: 0, w: W * 0.55, h: H },
                { x: W * 0.55 + g, y: 0, w: W * 0.45 - g, h: (H - g) / 2 },
                { x: W * 0.55 + g, y: (H - g) / 2 + g, w: W * 0.45 - g, h: (H - g) / 2 },
            ];
            case '4-grid': {
                const hw = (W - g) / 2, hh = (H - g) / 2;
                return [{ x: 0, y: 0, w: hw, h: hh }, { x: hw + g, y: 0, w: hw, h: hh }, { x: 0, y: hh + g, w: hw, h: hh }, { x: hw + g, y: hh + g, w: hw, h: hh }];
            }
            default: return [{ x: 0, y: 0, w: W, h: H }];
        }
    };

    const slotDefs = getSlotDefs(page.layout, W, photoZoneH);

    return (
        <div style={{ width: W, height: H, position: 'relative', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.13)', flexShrink: 0 }}>
            {/* Photo zone */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: photoZoneH, overflow: 'hidden' }}>
                {slotDefs.map((def, i) => {
                    const slot = page.slots[i] || { photoId: null, cropX: 50, cropY: 50, zoom: 1 };
                    const photo = photos.find(p => p.id === slot.photoId) || null;
                    return (
                        <div key={i} style={{ position: 'absolute', left: def.x, top: def.y, width: def.w, height: def.h, outline: activeSlotIdx === i ? '2px solid #1e2d7d' : 'none', outlineOffset: -2, cursor: 'pointer' }}
                            onClick={() => setActiveSlotIdx(activeSlotIdx === i ? null : i)}>
                            <PhotoArea slot={slot} photo={photo} W={def.w} H={def.h}
                                onDrop={id => onSlotDrop(i, id)}
                                onCropChange={(x, y, z) => onCropChange(i, x, y, z)} />
                        </div>
                    );
                })}
            </div>

            {/* Month label + grid */}
            {!isCover && (() => {
                const mp = page as MonthPage;
                return (
                    <div style={{ position: 'absolute', top: photoZoneH, left: 0, width: W, height: gridZoneH, background: '#fff', padding: '4px 8px 4px' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3, textAlign: 'center' }}>
                            {MONTHS_UK[mp.month - 1]} {mp.year}
                        </div>
                        <CalendarGridSVG year={mp.year} month={mp.month} W={W - 16} accentColor={accentColor} />
                    </div>
                );
            })()}

            {/* Page label */}
            {isCover && (
                <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                    ОБКЛАДИНКА
                </div>
            )}
        </div>
    );
}

// ─── Main Constructor ─────────────────────────────────────────────────────────
export default function WallCalendarConstructor({ initialSize = 'A4' }: { initialSize?: string }) {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { addItem } = useCartStore();

    const [size, setSize] = useState<'A4' | 'A3'>(initialSize === 'A3' ? 'A3' : 'A4');
    const [accentColor, setAccentColor] = useState('#1e2d7d');
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [pages, setPages] = useState<Page[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
    const [product, setProduct] = useState<any>(null);
    const [zoom, setZoom] = useState(100);
    const [step, setStep] = useState<'config' | 'editor'>('config');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ACCENT_COLORS = [
        { hex: '#1e2d7d', name: 'Темно-синій' }, { hex: '#C0392B', name: 'Червоний' },
        { hex: '#27AE60', name: 'Зелений' }, { hex: '#8E44AD', name: 'Фіолетовий' },
        { hex: '#E67E22', name: 'Помаранчевий' }, { hex: '#1ABC9C', name: 'Бірюзовий' },
        { hex: '#2C3E50', name: 'Графіт' }, { hex: '#000000', name: 'Чорний' },
    ];

    // Build 13 pages: cover + 12 months
    const buildPages = useCallback((sz: 'A4' | 'A3'): Page[] => {
        const cover: CoverPage = { id: 'cover', type: 'cover', layout: '1-full', slots: makeSlots(1) };
        const months: MonthPage[] = Array.from({ length: 12 }, (_, i) => ({
            id: `month-${i + 1}`,
            month: i + 1,
            year: 2026,
            layout: '1-top',
            slots: makeSlots(1),
        }));
        return [cover, ...months];
    }, []);

    useEffect(() => {
        supabase.from('products').select('*').eq('slug', 'wall-calendar-2026').eq('is_active', true).single()
            .then(({ data }) => setProduct(data));
    }, []);

    const startEditor = () => {
        setPages(buildPages(size));
        setCurrentIdx(0);
        setStep('editor');
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files) return;
        const newPhotos: Photo[] = [];
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;
            const preview = URL.createObjectURL(file);
            const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new window.Image(); i.onload = () => res(i); i.onerror = rej; i.src = preview; });
            newPhotos.push({ id: `p-${Date.now()}-${Math.random().toString(36).slice(7)}`, preview, width: img.width, height: img.height, name: file.name });
        }
        setPhotos(prev => [...prev, ...newPhotos]);
        if (newPhotos.length) toast.success(`Додано ${newPhotos.length} фото`);
    };

    const setLayout = (layout: Layout) => {
        const def = LAYOUTS.find(l => l.id === layout)!;
        setPages(prev => prev.map((p, i) => i !== currentIdx ? p : { ...p, layout, slots: makeSlots(def.slots) }));
        setActiveSlotIdx(null);
    };

    const onSlotDrop = (slotIdx: number, photoId: string) => {
        setPages(prev => prev.map((p, i) => {
            if (i !== currentIdx) return p;
            const slots = p.slots.map((s, si) => si === slotIdx ? { ...s, photoId } : s);
            return { ...p, slots };
        }));
    };

    const onCropChange = (slotIdx: number, x: number, y: number, zoom: number) => {
        setPages(prev => prev.map((p, i) => {
            if (i !== currentIdx) return p;
            const slots = p.slots.map((s, si) => si === slotIdx ? { ...s, cropX: x, cropY: y, zoom } : s);
            return { ...p, slots };
        }));
    };

    const autoFill = () => {
        let pi = 0;
        setPages(prev => prev.map(page => {
            const slots = page.slots.map(s => {
                if (s.photoId || pi >= photos.length) return s;
                return { ...s, photoId: photos[pi++].id };
            });
            return { ...page, slots };
        }));
        toast.success('Фото розставлені автоматично');
    };

    const addToCart = () => {
        const basePrice = product ? (size === 'A3' ? Number(product.price) + 100 : Number(product.price)) : 590;
        addItem({
            id: `wall-cal-${Date.now()}`,
            product_id: product?.id || 'wall-calendar-2026',
            name: `Настінний фотокалендар 2026 · ${SIZE_DIMS[size].label}`,
            price: basePrice,
            qty: 1,
            image: photos[0]?.preview || '',
            options: { 'Розмір': SIZE_DIMS[size].label },
            slug: 'wall-calendar-2026',
        });
        toast.success('Календар додано до кошика!');
    };

    const cur = pages[currentIdx];
    const isCover = cur && 'type' in cur && cur.type === 'cover';
    const usedIds = new Set(pages.flatMap(p => p.slots.map(s => s.photoId).filter(Boolean)));
    const basePrice = product ? (size === 'A3' ? Number(product.price) + 100 : Number(product.price)) : 590;

    // ── CONFIG STEP ──────────────────────────────────────────────────────────
    if (step === 'config') return (
        <div style={{ minHeight: '100vh', fontFamily: 'var(--font-primary, sans-serif)' }}>
            <Navigation />
            <main style={{ maxWidth: 680, margin: '0 auto', padding: '80px 16px 60px' }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', marginBottom: 6 }}>Настінний фотокалендар 2026</h1>
                <p style={{ color: '#64748b', marginBottom: 32 }}>Обкладинка + 12 місяців зі слотами для фото і календарною сіткою</p>

                {/* Size */}
                <div style={{ marginBottom: 28 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 12 }}>Розмір <span style={{ color: '#ef4444' }}>*</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {(['A4', 'A3'] as const).map(sz => (
                            <button key={sz} onClick={() => setSize(sz)}
                                style={{ padding: '20px 16px', border: size === sz ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 12, background: size === sz ? '#f0f3ff' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: size === sz ? '#1e2d7d' : '#374151' }}>{sz}</div>
                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{SIZE_DIMS[sz].label}</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e2d7d', marginTop: 8 }}>
                                    {sz === 'A4' ? (product ? `${Number(product.price)} ₴` : '590 ₴') : (product ? `${Number(product.price) + 100} ₴` : '690 ₴')}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Accent color */}
                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 12 }}>
                        Акцентний колір календаря
                        <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b', fontWeight: 400 }}>— вихідні та назви місяців</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {ACCENT_COLORS.map(c => (
                            <button key={c.hex} onClick={() => setAccentColor(c.hex)} title={c.name}
                                style={{ width: 36, height: 36, borderRadius: '50%', background: c.hex, border: accentColor === c.hex ? '3px solid #1e2d7d' : '2px solid #e2e8f0', cursor: 'pointer', boxShadow: accentColor === c.hex ? '0 0 0 2px #fff, 0 0 0 4px #1e2d7d' : 'none' }} />
                        ))}
                    </div>
                </div>

                {/* Info */}
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '14px 18px', marginBottom: 28, fontSize: 13, color: '#0369a1' }}>
                    📅 Календар складається з <b>13 сторінок</b>: обкладинка + 12 місяців (Січень–Грудень 2026). Кожна сторінка — слоти для фото + автоматична календарна сітка.
                </div>

                <button onClick={startEditor}
                    style={{ width: '100%', padding: 16, background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                    Перейти до редактора →
                </button>
            </main>
            <Footer categories={[]} />
        </div>
    );

    // ── EDITOR STEP ──────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6fb', fontFamily: 'var(--font-primary, sans-serif)' }}>

            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setStep('config')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 8px', borderRadius: 6 }}>
                        <ChevronLeft size={20} />
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>НАЗАД</span>
                    </button>
                    <div style={{ width: 1, height: 32, background: '#e2e8f0' }} />
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#1e2d7d' }}>Настінний календар 2026 · {size}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{photos.length} фото · 13 сторінок</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#1e2d7d' }}>{basePrice} ₴</span>
                    <button onClick={addToCart}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                        <ShoppingCart size={15} /> До кошика
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* Left panel — photos */}
                <div style={{ width: 200, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                        <button onClick={() => fileInputRef.current?.click()}
                            style={{ width: '100%', padding: '8px', border: '2px dashed #c7d2fe', borderRadius: 8, background: '#f0f3ff', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#1e2d7d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Upload size={14} /> Додати фото
                        </button>
                        <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
                            onChange={e => handleFiles(e.target.files)} />
                        <button onClick={autoFill}
                            style={{ width: '100%', marginTop: 6, padding: '6px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1e2d7d' }}>
                            Авто-заповнення
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {photos.map(p => (
                            <div key={p.id} draggable
                                onDragStart={e => e.dataTransfer.setData('photo-id', p.id)}
                                style={{ borderRadius: 6, overflow: 'hidden', cursor: 'grab', border: usedIds.has(p.id) ? '2px solid #10b981' : '2px solid transparent', flexShrink: 0 }}>
                                <img src={p.preview} style={{ width: '100%', height: 64, objectFit: 'cover', display: 'block' }} />
                            </div>
                        ))}
                        {photos.length === 0 && <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '20px 8px' }}>Додайте фото щоб почати</p>}
                    </div>
                </div>

                {/* Center — canvas */}
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
                    {/* Page nav */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <button onClick={() => { setCurrentIdx(i => Math.max(0, i - 1)); setActiveSlotIdx(null); }} disabled={currentIdx === 0}
                            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', cursor: 'pointer', opacity: currentIdx === 0 ? 0.4 : 1 }}>
                            <ChevronLeft size={16} />
                        </button>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {pages.map((p, i) => {
                                const hasPhoto = p.slots.some(s => s.photoId);
                                const label = 'type' in p ? 'О' : `${(p as MonthPage).month}`;
                                return (
                                    <button key={p.id} onClick={() => { setCurrentIdx(i); setActiveSlotIdx(null); }}
                                        style={{ width: 28, height: 28, borderRadius: 6, border: currentIdx === i ? '2px solid #1e2d7d' : '1px solid #e2e8f0', background: currentIdx === i ? '#1e2d7d' : hasPhoto ? '#f0fdf4' : '#fff', color: currentIdx === i ? '#fff' : '#374151', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => { setCurrentIdx(i => Math.min(pages.length - 1, i + 1)); setActiveSlotIdx(null); }} disabled={currentIdx === pages.length - 1}
                            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', cursor: 'pointer', opacity: currentIdx === pages.length - 1 ? 0.4 : 1 }}>
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Page label */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12 }}>
                        {isCover ? 'Обкладинка' : `${MONTHS_UK[(cur as MonthPage).month - 1]} 2026`}
                    </div>

                    {/* Canvas */}
                    {cur && (
                        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
                            <PagePreview page={cur} photos={photos} size={size} accentColor={accentColor}
                                onSlotDrop={onSlotDrop} onCropChange={onCropChange}
                                isCover={!!isCover} activeSlotIdx={activeSlotIdx} setActiveSlotIdx={setActiveSlotIdx} />
                        </div>
                    )}

                    {/* Zoom */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                        <button onClick={() => setZoom(z => Math.max(30, z - 10))} style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomOut size={13} /></button>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
                        <button onClick={() => setZoom(z => Math.min(130, z + 10))} style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomIn size={13} /></button>
                    </div>
                </div>

                {/* Right panel — layouts */}
                <div style={{ width: 180, background: '#fff', borderLeft: '1px solid #e2e8f0', padding: 12, flexShrink: 0, overflowY: 'auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Шаблон</div>
                    <div style={{ display: 'grid', gap: 6 }}>
                        {(isCover ? LAYOUTS : LAYOUTS).map(l => (
                            <button key={l.id} onClick={() => setLayout(l.id)}
                                style={{ padding: '8px 10px', border: cur?.layout === l.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: cur?.layout === l.id ? '#f0f3ff' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 12, fontWeight: 600, color: cur?.layout === l.id ? '#1e2d7d' : '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14 }}>{l.icon}</span>
                                <span>{l.label}</span>
                            </button>
                        ))}
                    </div>

                    <div style={{ marginTop: 20, height: 1, background: '#f1f5f9' }} />
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '12px 0 10px' }}>Акцент</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ACCENT_COLORS.map(c => (
                            <button key={c.hex} onClick={() => setAccentColor(c.hex)} title={c.name}
                                style={{ width: 26, height: 26, borderRadius: '50%', background: c.hex, border: accentColor === c.hex ? '2px solid #1e2d7d' : '1px solid #e2e8f0', cursor: 'pointer', boxShadow: accentColor === c.hex ? '0 0 0 2px #fff, 0 0 0 3px #1e2d7d' : 'none' }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
