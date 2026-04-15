'use client';
import { haptic, startPointerDrag } from '@/lib/hooks/useMobileInteractions';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { toast } from 'sonner';
import { CoverEditor, CoverConfig } from './CoverEditor';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';
import {
    ChevronLeft, ChevronRight, ShoppingCart,
    Upload, ZoomIn, ZoomOut, Image as ImageIcon
} from 'lucide-react';
import { useT } from '@/lib/i18n/context';

//  Types 
interface Photo { id: string; preview: string; width: number; height: number; name: string; }
interface Slot  { photoId: string | null; cropX: number; cropY: number; zoom: number; }
type Layout = '1-full'|'1-top'|'2-h'|'2-v'|'3-top1-bot2'|'3-left1-right2'|'4-grid'|'5-2top3bot'|'5-cross'|'6-grid'|'6-2rows';

interface MonthPage {
    id: string; month: number; year: number;
    layout: Layout; slots: Slot[];
}
type Page = { id: 'cover'; type: 'cover' } | MonthPage;

//  Constants 
const MONTHS_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                   'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const DAYS_UK   = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const SIZE_DIMS = {
    A4: { w: 210, h: 297, label: 'A4 (21×29.7 см)', px: 480 },
    A3: { w: 297, h: 420, label: 'A3 (29.7×42 см)', px: 480 },
};
const LAYOUTS: { id: Layout; label: string; slots: number; icon: string }[] = [
    { id: '1-full',         label: '1 повне',      slots: 1, icon: '' },
    { id: '1-top',          label: '1 зверху',     slots: 1, icon: '' },
    { id: '2-h',            label: '2 горизонт.',  slots: 2, icon: '' },
    { id: '2-v',            label: '2 вертик.',    slots: 2, icon: '' },
    { id: '3-top1-bot2',    label: '3 (1+2)',      slots: 3, icon: '⊤⊤' },
    { id: '3-left1-right2', label: '3 (1|2)',      slots: 3, icon: '⊢⊢' },
    { id: '4-grid',         label: '4 сітка',      slots: 4, icon: '⊞' },
    { id: '5-2top3bot',     label: '5 (2+3)',      slots: 5, icon: '⊟⊟' },
    { id: '5-cross',        label: '5 хрест',      slots: 5, icon: '' },
    { id: '6-grid',         label: '6 сітка 3×2',  slots: 6, icon: '' },
    { id: '6-2rows',        label: '6 (2 рядки)',  slots: 6, icon: '≡≡' },
];
const ACCENT_COLORS = [
    '#1e2d7d','#C0392B','#27AE60','#8E44AD','#E67E22','#1ABC9C','#2C3E50','#000000',
];
const DEFAULT_COVER: CoverConfig = {
    coverMaterial: 'printed',
    coverColorName: '',
    decoType: 'none',
    decoVariant: '',
    decoColor: '',
    photoId: null,
    textX: 50, textY: 72,
    decoText: '',
    textFontFamily: 'Playfair Display',
    textFontSize: 48,
    printedBgColor: '#1e2d7d',
    printedPhotoSlot: { x: 0, y: 0, w: 100, h: 75, shape: 'rect' },
    printedTextBlocks: [
        { id: 'title', text: 'Мій календар 2026', x: 50, y: 82, fontSize: 22, fontFamily: 'Playfair Display', color: '#ffffff', bold: true },
    ],
    printedOverlay: { type: 'gradient', color: '#000000', opacity: 50, gradient: 'linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.65) 100%)' },
};

function makeSlots(n: number): Slot[] {
    return Array.from({ length: n }, () => ({ photoId: null, cropX: 50, cropY: 50, zoom: 1 }));
}

//  Calendar Grid 
function CalendarGrid({ year, month, W, accent, marks = [] }: { year: number; month: number; W: number; accent: string; marks?: {day:number;shape:'circle'|'heart';color:string}[] }) {
    const first = new Date(year, month - 1, 1).getDay();
    const days  = new Date(year, month, 0).getDate();
    const offset = (first + 6) % 7;
    const cells: (number|null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = cells.length / 7;
    const cw = W / 7;
    const hdrH = 15;
    const cellH = Math.round((W * 0.40) / rows);
    const totalH = hdrH + rows * cellH;
    return (
        <svg width={W} height={totalH} style={{ display: 'block' }}>
            {DAYS_UK.map((d, i) => (
                <text key={d} x={cw*i+cw/2} y={hdrH-3} textAnchor="middle"
                    fontSize={cw*0.22} fontWeight="700" fontFamily="sans-serif"
                    fill={i>=5 ? accent : '#555'}>{d}</text>
            ))}
            <line x1={0} y1={hdrH} x2={W} y2={hdrH} stroke="#ddd" strokeWidth={0.5}/>
            {cells.map((day, idx) => {
                if (!day) return null;
                const col = idx % 7, row = Math.floor(idx / 7);
                const cx = cw*col+cw/2, cy = hdrH+row*cellH+cellH*0.5;
                const mark = marks.find(m => m.day === day);
                const r = cellH * 0.36;
                return (
                    <g key={idx}>
                        {mark && mark.shape === 'circle' && (
                            <circle cx={cx} cy={cy} r={r} fill={mark.color}/>
                        )}
                        {mark && mark.shape === 'heart' && (
                            <path d={heartPath(cx, cy - r*0.08, r)} fill={mark.color}/>
                        )}
                        <text x={cx} y={cy + cellH*0.18}
                            textAnchor="middle" fontSize={cw*0.28} fontFamily="sans-serif"
                            fill={mark ? '#ffffff' : col>=5 ? accent : '#222'}>{day}</text>
                    </g>
                );
            })}
        </svg>
    );
}

function heartPath(cx: number, cy: number, r: number): string {
    const s = r / 8;
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * Math.PI * 2;
        const x = cx + s * 16 * Math.pow(Math.sin(t), 3);
        const y = cy - s * (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t));
        pts.push(`${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ') + ' Z';
}

//  Photo slot renderer 
function PhotoSlot({ slot, photo, W, H, onDrop, onCropChange }:
    { slot: Slot; photo: Photo|null; W: number; H: number;
      onDrop:(id:string)=>void; onCropChange:(x:number,y:number,z:number)=>void }) {
    const t = useT();
    const drag = useRef<{sx:number;sy:number;cx:number;cy:number}|null>(null);
    const handleMD = (e: React.PointerEvent) => {
        if (!photo) return; e.preventDefault();
        haptic.light();
        const startCX = slot.cropX, startCY = slot.cropY;
        const zoom = slot.zoom || 1;
        startPointerDrag(e, (dx, dy) => {
            onCropChange(
                Math.max(0, Math.min(100, startCX - dx/W*100/zoom)),
                Math.max(0, Math.min(100, startCY - dy/H*100/zoom)),
                slot.zoom
            );
        });
    };
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        onCropChange(slot.cropX, slot.cropY, Math.max(0.5, Math.min(3, (slot.zoom||1)+(e.deltaY>0?-0.1:0.1))));
    };
    return (
        <div style={{ width:W, height:H, overflow:'hidden', position:'relative', background:'#f1f5f9', cursor: photo?'grab':'default' }}
            onPointerDown={handleMD} onWheel={handleWheel}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('photo-id');if(id)onDrop(id);}}>
            {photo ? (
                <img src={photo.preview} draggable={false} style={{
                    width:`${(slot.zoom||1)*100}%`, height:`${(slot.zoom||1)*100}%`,
                    objectFit:'cover', position:'absolute', top:'50%', left:'50%',
                    transform:`translate(calc(-50% + ${(50-slot.cropX)*(slot.zoom||1)*0.5}px), calc(-50% + ${(50-slot.cropY)*(slot.zoom||1)*0.5}px))`,
                    userSelect:'none', pointerEvents:'none',
                }}/>
            ) : (
                <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'1.5px dashed #d1d5db', color:'#cbd5e1', gap:4 }}>
                    <ImageIcon size={18} color="#d1d5db"/>
                    <span style={{ fontSize:9, fontWeight:600 }}>{t('wallcal.drag_photo_hint')}</span>
                </div>
            )}
        </div>
    );
}

//  Month page preview 
function MonthPreview({ page, photos, size, accent, onSlotDrop, onCropChange, activeSlot, setActiveSlot, marks = [] }:
    { page: MonthPage; photos: Photo[]; size: 'A4'|'A3'; accent: string;
      onSlotDrop:(i:number,id:string)=>void; onCropChange:(i:number,x:number,y:number,z:number)=>void;
      activeSlot: number|null; setActiveSlot:(i:number|null)=>void;
      marks?: {day:number;shape:'circle'|'heart';color:string}[] }) {

    const dims = SIZE_DIMS[size];
    const scale = 480 / dims.h;
    const W = Math.round(dims.w * scale);
    const H = 480;
    const spiralH = Math.round(H * 0.045);
    const photoH = Math.round((H - spiralH) * 0.56);
    const gridH  = H - spiralH - photoH;
    const g = 2;

    // All slot positions offset by spiralH
    const slotDefs: {x:number;y:number;w:number;h:number}[] = (() => {
        switch (page.layout) {
            case '1-full':         return [{x:0,y:spiralH,w:W,h:photoH}];
            case '1-top':          return [{x:0,y:spiralH,w:W,h:photoH*0.9}];
            case '2-h':            return [{x:0,y:spiralH,w:W,h:(photoH-g)/2},{x:0,y:spiralH+(photoH-g)/2+g,w:W,h:(photoH-g)/2}];
            case '2-v':            return [{x:0,y:spiralH,w:(W-g)/2,h:photoH},{x:(W-g)/2+g,y:spiralH,w:(W-g)/2,h:photoH}];
            case '3-top1-bot2':    return [{x:0,y:spiralH,w:W,h:photoH*0.55},{x:0,y:spiralH+photoH*0.55+g,w:(W-g)/2,h:photoH*0.45-g},{x:(W-g)/2+g,y:spiralH+photoH*0.55+g,w:(W-g)/2,h:photoH*0.45-g}];
            case '3-left1-right2': return [{x:0,y:spiralH,w:W*0.55,h:photoH},{x:W*0.55+g,y:spiralH,w:W*0.45-g,h:(photoH-g)/2},{x:W*0.55+g,y:spiralH+(photoH-g)/2+g,w:W*0.45-g,h:(photoH-g)/2}];
            case '4-grid':         { const hw=(W-g)/2,hh=(photoH-g)/2; return [{x:0,y:spiralH,w:hw,h:hh},{x:hw+g,y:spiralH,w:hw,h:hh},{x:0,y:spiralH+hh+g,w:hw,h:hh},{x:hw+g,y:spiralH+hh+g,w:hw,h:hh}]; }
            case '5-2top3bot':     { const topH=Math.round(photoH*0.55),botH=photoH-topH-g,tw=(W-g)/2,bw=(W-2*g)/3; return [{x:0,y:spiralH,w:tw,h:topH},{x:tw+g,y:spiralH,w:tw,h:topH},{x:0,y:spiralH+topH+g,w:bw,h:botH},{x:bw+g,y:spiralH+topH+g,w:bw,h:botH},{x:2*(bw+g),y:spiralH+topH+g,w:bw,h:botH}]; }
            case '5-cross':        { const w3=(W-2*g)/3,h3=(photoH-2*g)/3; return [{x:w3+g,y:spiralH,w:w3,h:h3},{x:0,y:spiralH+h3+g,w:w3,h:h3},{x:w3+g,y:spiralH+h3+g,w:w3,h:h3},{x:2*(w3+g),y:spiralH+h3+g,w:w3,h:h3},{x:w3+g,y:spiralH+2*(h3+g),w:w3,h:h3}]; }
            case '6-grid':         { const hw=(W-2*g)/3,hh=(photoH-g)/2; return Array.from({length:6},(_,i)=>({x:(i%3)*(hw+g),y:spiralH+Math.floor(i/3)*(hh+g),w:hw,h:hh})); }
            case '6-2rows':        { const hw=(W-2*g)/3,hh=(photoH-g)/2; return Array.from({length:6},(_,i)=>({x:(i%3)*(hw+g),y:spiralH+Math.floor(i/3)*(hh+g),w:hw,h:hh})); }
            default:               return [{x:0,y:0,w:W,h:photoH}];
        }
    })();

    return (
        <div style={{ width:W, height:H, position:'relative', background:'#fff', boxShadow:'0 4px 24px rgba(0,0,0,0.13)', flexShrink:0 }}>
            {/* Spring/spiral binding space */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:Math.round(H*0.045), background:'#f1f5f9', zIndex:10, borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', gap: Math.round(W/14) }}>
              {Array.from({length:14}).map((_,i)=>(
                <div key={i} style={{ width:Math.round(W*0.038), height:Math.round(W*0.038), borderRadius:'50%', border:'1.5px solid #94a3b8', background:'#fff' }}/>
              ))}
            </div>
            {/* Photo slots */}
            {slotDefs.map((def,i) => {
                const slot = page.slots[i] || {photoId:null,cropX:50,cropY:50,zoom:1};
                const photo = photos.find(p=>p.id===slot.photoId)||null;
                return (
                    <div key={i} style={{ position:'absolute', left:def.x, top:def.y, width:def.w, height:def.h, outline: activeSlot===i ? '2px solid #1e2d7d' : 'none', outlineOffset:-2 }}
                        onClick={()=>setActiveSlot(activeSlot===i?null:i)}>
                        <PhotoSlot slot={slot} photo={photo} W={def.w} H={def.h}
                            onDrop={id=>onSlotDrop(i,id)}
                            onCropChange={(x,y,z)=>onCropChange(i,x,y,z)}/>
                    </div>
                );
            })}
            {/* Calendar grid */}
            <div style={{ position:'absolute', top:spiralH+photoH, left:0, width:W, height:gridH, background:'#fff', padding:'4px 8px 2px' }}>
                <div style={{ fontSize:11, fontWeight:900, color:accent, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2, textAlign:'center' }}>
                    {MONTHS_UK[page.month-1]} {page.year}
                </div>
                <CalendarGrid year={page.year} month={page.month} W={W-16} accent={accent}
                    marks={marks}/>
            </div>
        </div>
    );
}

//  Main constructor 
export default function WallCalendarConstructor({ initialSize='A4' }: { initialSize?: string }) {
    const t = useT();
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { addItem } = useCartStore();

    const [size, setSize]           = useState<'A4'|'A3'>(initialSize==='A3'?'A3':'A4');
    const [accent, setAccent]       = useState('#1e2d7d');
    const [photos, setPhotos]       = useState<Photo[]>([]);
    const [pages, setPages]         = useState<MonthPage[]>([]);
    const [coverConfig, setCoverConfig] = useState<CoverConfig>(DEFAULT_COVER);
    const [currentIdx, setCurrentIdx]   = useState(0); // 0=cover, 1-12=months
    const [activeSlot, setActiveSlot]   = useState<number|null>(null);
    const [product, setProduct]     = useState<any>(null);
    const [zoom, setZoom]           = useState(100);
    // Marked dates per month: { [monthKey]: MarkedDate[] }
    interface MarkedDate { day: number; shape: 'circle' | 'heart'; color: string; }
    const [markedDates, setMarkedDates] = useState<Record<string, MarkedDate[]>>({});
    const [markShape, setMarkShape] = useState<'circle'|'heart'>('circle');
    const [markColor, setMarkColor] = useState('#1e2d7d');
    const [step, setStep]           = useState<'config'|'editor'>('config');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        supabase.from('products').select('*').eq('slug','wall-calendar-2026').eq('is_active',true).single().then(({data})=>setProduct(data));
    }, []);

    const buildMonthPages = (): MonthPage[] =>
        Array.from({length:12}, (_,i) => ({
            id:`month-${i+1}`, month:i+1, year:2026, layout:'1-top' as Layout, slots:makeSlots(1),
        }));

    const startEditor = () => { setPages(buildMonthPages()); setCurrentIdx(0); setStep('editor'); };

    const handleFiles = async (files: FileList|null) => {
        if (!files) return;
        const news: Photo[] = [];
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;
            const preview = URL.createObjectURL(file);
            const img = await new Promise<HTMLImageElement>((res,rej)=>{const i=new window.Image();i.onload=()=>res(i);i.onerror=rej;i.src=preview;});
            news.push({id:`p-${Date.now()}-${Math.random().toString(36).slice(7)}`,preview,width:img.width,height:img.height,name:file.name});
        }
        setPhotos(prev=>[...prev,...news]);
        if (news.length) toast.success(`Додано ${news.length} фото`);
    };

    const setLayout = (layout: Layout) => {
        const def = LAYOUTS.find(l=>l.id===layout)!;
        setPages(prev=>prev.map((p,i)=> i!==currentIdx-1 ? p : {...p, layout, slots:makeSlots(def.slots)}));
        setActiveSlot(null);
    };

    const onSlotDrop = (si: number, photoId: string) => {
        setPages(prev=>prev.map((p,i)=> i!==currentIdx-1 ? p : {...p, slots:p.slots.map((s,j)=>j===si?{...s,photoId}:s)}));
    };
    const onCropChange = (si:number, x:number, y:number, z:number) => {
        setPages(prev=>prev.map((p,i)=> i!==currentIdx-1 ? p : {...p, slots:p.slots.map((s,j)=>j===si?{...s,cropX:x,cropY:y,zoom:z}:s)}));
    };

    const autoFill = () => {
        let pi = 0;
        setPages(prev=>prev.map(page=>({...page, slots:page.slots.map(s=>{
            if (s.photoId||pi>=photos.length) return s;
            return {...s,photoId:photos[pi++].id};
        })})));
        toast.success(t('wallcal.photos_auto_filled'));
    };

    const addToCart = () => {
        const basePrice = product ? (size==='A3' ? Number(product.price)+100 : Number(product.price)) : 590;
        addItem({
            id:`wall-cal-${Date.now()}`,
            product_id: product?.id||'wall-calendar-2026',
            name:`Настінний фотокалендар 2026 · ${SIZE_DIMS[size].label}`,
            price: basePrice, qty:1,
            image: photos[0]?.preview||'',
            options:{'Розмір':SIZE_DIMS[size].label},
            slug:'wall-calendar-2026',
        });
        toast.success(t('wallcal.calendar_added_to_cart'));
    };

    const isCover = currentIdx === 0;
    const curMonth = pages[currentIdx-1] || null;
    const usedIds = new Set(pages.flatMap(p=>p.slots.map(s=>s.photoId).filter(Boolean)));
    const basePrice = product ? (size==='A3' ? Number(product.price)+100 : Number(product.price)) : 590;

    // Cover canvas size
    const coverW = Math.round(SIZE_DIMS[size].w * 480 / SIZE_DIMS[size].h);
    const coverH = 480;

    //  CONFIG 
    if (step==='config') return (
        <div style={{minHeight:'100vh', fontFamily:'var(--font-primary, sans-serif)'}}>
            <Navigation/>
            <main style={{maxWidth:660, margin:'0 auto', padding:'80px 16px 60px'}}>
                <a href="/catalog/wall-calendar-2026" style={{display:'inline-flex',alignItems:'center',gap:6,color:'#64748b',textDecoration:'none',fontSize:13,marginBottom:20,opacity:0.8}}>
                  ← Назад до каталогу
                </a>
                <h1 style={{fontSize:28,fontWeight:900,color:'#1e2d7d',marginBottom:6}}>{t('wallcal.title')}</h1>
                <p style={{color:'#64748b',marginBottom:32}}>{t('wallcal.description')}</p>

                <div style={{marginBottom:28}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#374151',marginBottom:12}}>Розмір <span style={{color:'#ef4444'}}>*</span></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                        {(['A4','A3'] as const).map(sz=>(
                            <button key={sz} onClick={()=>setSize(sz)} style={{padding:'20px 16px',border:size===sz?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:12,background:size===sz?'#f0f3ff':'#fff',cursor:'pointer',textAlign:'left'}}>
                                <div style={{fontSize:22,fontWeight:900,color:size===sz?'#1e2d7d':'#374151'}}>{sz}</div>
                                <div style={{fontSize:13,color:'#64748b',marginTop:4}}>{SIZE_DIMS[sz].label}</div>
                                <div style={{fontSize:15,fontWeight:800,color:'#1e2d7d',marginTop:8}}>
                                    {sz==='A4'?(product?`${Number(product.price)} ₴`:'590 ₴'):(product?`${Number(product.price)+100} ₴`:'690 ₴')}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{marginBottom:32}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#374151',marginBottom:12}}>
                        Акцентний колір <span style={{fontSize:12,color:'#94a3b8',fontWeight:400}}>{t('wallcal.accent_color_desc')}</span>
                    </div>
                    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                        {ACCENT_COLORS.map(c=>(
                            <button key={c} onClick={()=>setAccent(c)} title={c}
                                style={{width:36,height:36,borderRadius:'50%',background:c,border:accent===c?'3px solid #1e2d7d':'2px solid #e2e8f0',cursor:'pointer',boxShadow:accent===c?'0 0 0 2px #fff, 0 0 0 4px #1e2d7d':'none'}}/>
                        ))}
                    </div>
                </div>

                <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:10,padding:'14px 18px',marginBottom:28,fontSize:13,color:'#0369a1'}}>
                     <b>{t('wallcal.info_pages')}</b> обкладинка (повний редактор — фото, текст, шрифт, кольори) + 12 місяців (Січень–Грудень 2026) зі слотами для фото і сіткою.
                </div>

                <button onClick={startEditor} style={{width:'100%',padding:16,background:'#1e2d7d',color:'#fff',border:'none',borderRadius:10,fontSize:16,fontWeight:800,cursor:'pointer'}}>
                    Перейти до редактора →
                </button>
            </main>
            <Footer categories={[]}/>
        </div>
    );

    //  EDITOR 
    return (
        <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#f4f6fb',fontFamily:'var(--font-primary, sans-serif)'}}>

            {/* Top bar */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 20px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0,gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <button onClick={()=>setStep('config')} style={{background:'none',border:'none',cursor:'pointer',color:'#374151',display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'4px 8px',borderRadius:6}}>
                        <ChevronLeft size={20}/>
                        <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>{t('wallcal.back_button')}</span>
                    </button>
                    <div style={{width:1,height:32,background:'#e2e8f0'}}/>
                    <div>
                        <div style={{fontWeight:800,fontSize:14,color:'#1e2d7d'}}>{t('wallcal.editor_title')}</div>
                        <div style={{fontSize:11,color:'#94a3b8'}}>{photos.length} фото · 13 сторінок</div>
                    </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:15,fontWeight:800,color:'#1e2d7d'}}>{basePrice} ₴</span>
                    <button onClick={addToCart} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',background:'#1e2d7d',color:'#fff',border:'none',borderRadius:10,fontWeight:700,fontSize:14,cursor:'pointer'}}>
                        <ShoppingCart size={15}/> До кошика
                    </button>
                </div>
            </div>

            <div style={{display:'flex',flex:1,overflow:'hidden'}}>

                {/* Left — photos */}
                <div style={{width:200,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',flexShrink:0}}>
                    <div style={{padding:'12px 10px 8px',borderBottom:'1px solid #f1f5f9'}}>
                        <button onClick={()=>fileInputRef.current?.click()} style={{width:'100%',padding:'8px',border:'2px dashed #c7d2fe',borderRadius:8,background:'#f0f3ff',cursor:'pointer',fontWeight:700,fontSize:12,color:'#1e2d7d',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                            <Upload size={14}/> Додати фото
                        </button>
                        <input ref={fileInputRef} type="file" multiple accept="image/*" style={{display:'none'}} onChange={e=>handleFiles(e.target.files)}/>
                        {!isCover && (
                            <button onClick={autoFill} style={{width:'100%',marginTop:6,padding:'6px',border:'1px solid #e2e8f0',borderRadius:7,background:'#fff',cursor:'pointer',fontSize:12,fontWeight:600,color:'#1e2d7d'}}>
                                Авто-заповнення
                            </button>
                        )}
                    </div>
                    <div style={{flex:1,overflowY:'auto',padding:8,display:'flex',flexDirection:'column',gap:4}}>
                        {photos.map(p=>(
                            <div key={p.id} draggable
                                onDragStart={e=>{e.dataTransfer.setData('photo-id',p.id); e.dataTransfer.setData('text/plain',p.id);}}
                                style={{borderRadius:6,overflow:'hidden',cursor:'grab',border:usedIds.has(p.id)||coverConfig.photoId===p.id?'2px solid #10b981':'2px solid transparent',flexShrink:0}}>
                                <img src={p.preview} style={{width:'100%',height:64,objectFit:'cover',display:'block'}}/>
                            </div>
                        ))}
                        {photos.length===0 && <p style={{fontSize:11,color:'#94a3b8',textAlign:'center',padding:'20px 8px'}}>{t('wallcal.add_photos_to_start')}</p>}
                    </div>
                </div>

                {/* Center — canvas */}
                <div style={{flex:1,overflow:'auto',display:'flex',flexDirection:'column',alignItems:'center',padding:'24px 16px'}}>
                    {/* Nav strip */}
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:14,flexWrap:'wrap',justifyContent:'center'}}>
                        <button onClick={()=>{setCurrentIdx(i=>Math.max(0,i-1));setActiveSlot(null);}} disabled={currentIdx===0}
                            style={{padding:'5px 9px',border:'1px solid #e2e8f0',borderRadius:7,background:'#fff',cursor:'pointer',opacity:currentIdx===0?0.4:1}}>
                            <ChevronLeft size={14}/>
                        </button>
                        {/* Cover btn */}
                        <button onClick={()=>{setCurrentIdx(0);setActiveSlot(null);}}
                            style={{padding:'4px 10px',height:28,borderRadius:6,border:currentIdx===0?'2px solid #1e2d7d':'1px solid #e2e8f0',background:currentIdx===0?'#1e2d7d':'#fff',color:currentIdx===0?'#fff':'#374151',fontSize:10,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>
                            Обкл.
                        </button>
                        {pages.map((p,i)=>{
                            const has=p.slots.some(s=>s.photoId);
                            const mLabels=['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
                            return (
                                <button key={p.id} onClick={()=>{setCurrentIdx(i+1);setActiveSlot(null);}}
                                    style={{padding:'4px 7px',height:28,borderRadius:6,border:currentIdx===i+1?'2px solid #1e2d7d':'1px solid #e2e8f0',background:currentIdx===i+1?'#1e2d7d':has?'#f0fdf4':'#fff',color:currentIdx===i+1?'#fff':'#374151',fontSize:10,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                                    {mLabels[p.month-1]||p.month}
                                </button>
                            );
                        })}
                        <button onClick={()=>{setCurrentIdx(i=>Math.min(13,i+1));setActiveSlot(null);}} disabled={currentIdx===13}
                            style={{padding:'5px 9px',border:'1px solid #e2e8f0',borderRadius:7,background:'#fff',cursor:'pointer',opacity:currentIdx===13?0.4:1}}>
                            <ChevronRight size={14}/>
                        </button>
                    </div>

                    <div style={{fontSize:13,fontWeight:700,color:'#64748b',marginBottom:12}}>
                        {isCover ? 'Обкладинка' : `${MONTHS_UK[(curMonth?.month||1)-1]} 2026`}
                    </div>

                    {/* Canvas */}
                    <div style={{transform:`scale(${zoom/100})`,transformOrigin:'top center'}}>
                        {isCover ? (
                            <CoverEditor
                                canvasW={coverW} canvasH={coverH}
                                sizeValue={size==='A4'?'210x297':'297x420'}
                                config={coverConfig}
                                photos={photos}
                                onChange={patch=>setCoverConfig(prev=>({...prev,...patch}))}
                            />
                        ) : curMonth ? (
                            <MonthPreview
                                page={curMonth} photos={photos} size={size} accent={accent}
                                onSlotDrop={onSlotDrop} onCropChange={onCropChange}
                                activeSlot={activeSlot} setActiveSlot={setActiveSlot}
                                marks={(markedDates as any)[`m${curMonth.month}`] || []}/>
                        ) : null}
                    </div>

                    {/* Zoom */}
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:16}}>
                        <button onClick={()=>setZoom(z=>Math.max(30,z-10))} style={{padding:'5px 8px',border:'1px solid #d1d5db',borderRadius:6,background:'#fff',cursor:'pointer'}}><ZoomOut size={13}/></button>
                        <span style={{fontSize:11,fontWeight:700,color:'#475569',minWidth:36,textAlign:'center'}}>{zoom}%</span>
                        <button onClick={()=>setZoom(z=>Math.min(130,z+10))} style={{padding:'5px 8px',border:'1px solid #d1d5db',borderRadius:6,background:'#fff',cursor:'pointer'}}><ZoomIn size={13}/></button>
                    </div>

                    {/* Page thumbnail strip */}
                    <div style={{marginTop:20,padding:'12px 0',borderTop:'1px solid #e2e8f0',width:'100%'}}>
                        <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textAlign:'center',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.08em'}}>Всі сторінки</div>
                        <div style={{display:'flex',gap:6,overflowX:'auto',padding:'0 8px',flexWrap:'nowrap',justifyContent:'center'}}>
                            {/* Cover thumb */}
                            <button onClick={()=>{setCurrentIdx(0);setActiveSlot(null);}}
                                style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'transparent',border:'none',cursor:'pointer',padding:2}}>
                                <div style={{width:36,height:50,borderRadius:4,border:currentIdx===0?'2px solid #1e2d7d':'1.5px solid #e2e8f0',background:coverConfig.printedBgColor||'#1e2d7d',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                                    {coverConfig.photoId && photos.find(p=>p.id===coverConfig.photoId)
                                        ? <img src={photos.find(p=>p.id===coverConfig.photoId)!.preview} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                        : <span style={{fontSize:7,color:'#fff',fontWeight:700}}>Обкл.</span>}
                                </div>
                                <span style={{fontSize:8,fontWeight:currentIdx===0?800:600,color:currentIdx===0?'#1e2d7d':'#94a3b8'}}>Обкл.</span>
                            </button>
                            {/* Month thumbs */}
                            {pages.map((p,i)=>{
                                const mLabels=['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
                                const mainSlot=p.slots[0];
                                const thumbPh=mainSlot?.photoId?photos.find(ph=>ph.id===mainSlot.photoId):null;
                                return (
                                    <button key={p.id} onClick={()=>{setCurrentIdx(i+1);setActiveSlot(null);}}
                                        style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'transparent',border:'none',cursor:'pointer',padding:2}}>
                                        <div style={{width:36,height:50,borderRadius:4,border:currentIdx===i+1?'2px solid #1e2d7d':'1.5px solid #e2e8f0',background:'#f8fafc',overflow:'hidden',position:'relative'}}>
                                            {thumbPh
                                                ? <img src={thumbPh.preview} style={{width:'100%',height:'60%',objectFit:'cover',display:'block'}}/>
                                                : <div style={{width:'100%',height:'60%',background:'#e2e8f0'}}/>}
                                            <div style={{background:accent,height:'40%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                                <span style={{fontSize:6,fontWeight:700,color:'#fff'}}>{mLabels[p.month-1]}</span>
                                            </div>
                                        </div>
                                        <span style={{fontSize:8,fontWeight:currentIdx===i+1?800:600,color:currentIdx===i+1?'#1e2d7d':'#94a3b8'}}>{mLabels[p.month-1]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right — tools */}
                <div style={{width:180,background:'#fff',borderLeft:'1px solid #e2e8f0',padding:12,flexShrink:0,overflowY:'auto'}}>
                    {isCover ? (
                        /* Cover tools */
                        <div style={{display:'flex',flexDirection:'column',gap:12}}>
                            <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase'}}>{t('wallcal.cover_editor_label')}</div>

                            {/* Cover templates */}
                            <div>
                                <div style={{fontSize:10,fontWeight:700,color:'#374151',marginBottom:6}}>{t('wallcal.template_label')}</div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                                    {[
                                        {id:'photo-full', label:'Фото фон', bg:'#1e2d7d'},
                                        {id:'split',      label:'Фото + смуга', bg:'#14532d'},
                                        {id:'frame',      label:'З рамкою', bg:'#3d2c1e'},
                                        {id:'minimal',    label:'Мінімал', bg:'#f8fafc'},
                                        {id:'dark',       label:'Темна', bg:'#0a0e1a'},
                                        {id:'light',      label:'Світла', bg:'#faf7f2'},
                                    ].map(t => {
                                        const isSel = (coverConfig.printedBgColor || '#1e2d7d') === t.bg;
                                        return (
                                            <button key={t.id}
                                                onClick={()=>setCoverConfig(prev=>({...prev, printedBgColor: t.bg, printedOverlay:{type:'none',color:'#000',opacity:0,gradient:''}}))}
                                                style={{padding:'6px 4px',border:isSel?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:7,background:'#fff',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                                                <div style={{width:28,height:20,borderRadius:3,background:t.bg}}/>
                                                <span style={{fontSize:8,fontWeight:700,color:isSel?'#1e2d7d':'#374151'}}>{t.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* BG color */}
                            <div>
                                <div style={{fontSize:10,fontWeight:700,color:'#374151',marginBottom:5}}>{t('wallcal.bg_color_label')}</div>
                                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:4}}>
                                    {['#1e2d7d','#0a0e1a','#14532d','#3d2c1e','#7c3aed','#be185d','#ffffff','#faf7f2','#1a1a1a','#0369a1'].map(c=>(
                                        <button key={c} onClick={()=>setCoverConfig(prev=>({...prev,printedBgColor:c}))}
                                            style={{width:22,height:22,borderRadius:'50%',background:c,border:(coverConfig.printedBgColor||'#1e2d7d')===c?'3px solid #1e2d7d':'1.5px solid #e2e8f0',cursor:'pointer',boxShadow:'0 0 0 0.5px #e2e8f0'}}/>
                                    ))}
                                    <input type="color" value={coverConfig.printedBgColor||'#1e2d7d'} onChange={e=>setCoverConfig(prev=>({...prev,printedBgColor:e.target.value}))}
                                        style={{width:22,height:22,borderRadius:4,border:'1px solid #e2e8f0',cursor:'pointer',padding:1}}/>
                                </div>
                            </div>

                            {/* Text */}
                            <div>
                                <div style={{fontSize:10,fontWeight:700,color:'#374151',marginBottom:5}}>{t('wallcal.text_label')}</div>
                                <input type="text"
                                    value={coverConfig.printedTextBlocks?.[0]?.text || ''}
                                    onChange={e=>setCoverConfig(prev=>({...prev,printedTextBlocks:[
                                        {...(prev.printedTextBlocks?.[0]||{id:'t1',text:'',x:50,y:82,fontSize:22,fontFamily:'Playfair Display',color:'#ffffff',bold:true}),text:e.target.value},
                                        ...(prev.printedTextBlocks?.slice(1)||[])
                                    ]}))}
                                    placeholder={t('wallcal.text_placeholder')}
                                    style={{width:'100%',padding:'6px 8px',border:'1px solid #e2e8f0',borderRadius:7,fontSize:11,boxSizing:'border-box',marginBottom:6}}/>
                                {/* Font */}
                                <select
                                    value={coverConfig.printedTextBlocks?.[0]?.fontFamily||'Playfair Display'}
                                    onChange={e=>setCoverConfig(prev=>({...prev,printedTextBlocks:[
                                        {...(prev.printedTextBlocks?.[0]||{id:'t1',text:'',x:50,y:82,fontSize:22,color:'#ffffff',bold:true}),fontFamily:e.target.value},
                                        ...(prev.printedTextBlocks?.slice(1)||[])
                                    ]}))}
                                    style={{width:'100%',padding:'5px 7px',border:'1px solid #e2e8f0',borderRadius:7,fontSize:10,marginBottom:6,cursor:'pointer'}}>
                                    {['Playfair Display','Montserrat','Lora','Dancing Script','Cormorant Garamond','EB Garamond','Great Vibes','Raleway','Oswald','Cinzel'].map(f=>(
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                                {/* Text color */}
                                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
                                    <span style={{fontSize:9,color:'#64748b'}}>{t('wallcal.text_color_label')}</span>
                                    {['#ffffff','#1a1a1a','#1e2d7d','#c8a96e','#be185d','#4ade80'].map(c=>(
                                        <button key={c} onClick={()=>setCoverConfig(prev=>({...prev,printedTextBlocks:[
                                            {...(prev.printedTextBlocks?.[0]||{id:'t1',text:'',x:50,y:82,fontSize:22,fontFamily:'Playfair Display',bold:true}),color:c},
                                            ...(prev.printedTextBlocks?.slice(1)||[])
                                        ]}))}
                                            style={{width:18,height:18,borderRadius:'50%',background:c,border:'1.5px solid #e2e8f0',cursor:'pointer'}}/>
                                    ))}
                                    <input type="color"
                                        value={coverConfig.printedTextBlocks?.[0]?.color||'#ffffff'}
                                        onChange={e=>setCoverConfig(prev=>({...prev,printedTextBlocks:[
                                            {...(prev.printedTextBlocks?.[0]||{id:'t1',text:'',x:50,y:82,fontSize:22,fontFamily:'Playfair Display',bold:true}),color:e.target.value},
                                            ...(prev.printedTextBlocks?.slice(1)||[])
                                        ]}))}
                                        style={{width:18,height:18,borderRadius:4,border:'1px solid #e2e8f0',cursor:'pointer',padding:1}}/>
                                </div>
                                {/* Font size */}
                                <div style={{display:'flex',alignItems:'center',gap:5}}>
                                    <span style={{fontSize:9,color:'#64748b'}}>{t('wallcal.font_size_label')}</span>
                                    <input type="range" min={12} max={60}
                                        value={coverConfig.printedTextBlocks?.[0]?.fontSize||22}
                                        onChange={e=>setCoverConfig(prev=>({...prev,printedTextBlocks:[
                                            {...(prev.printedTextBlocks?.[0]||{id:'t1',text:'',x:50,y:82,color:'#ffffff',fontFamily:'Playfair Display',bold:true}),fontSize:+e.target.value},
                                            ...(prev.printedTextBlocks?.slice(1)||[])
                                        ]}))}
                                        style={{flex:1,accentColor:'#1e2d7d'}}/>
                                    <span style={{fontSize:9,color:'#475569',width:16}}>{coverConfig.printedTextBlocks?.[0]?.fontSize||22}</span>
                                </div>
                            </div>

                            {/* Text position */}
                            <div>
                                <div style={{fontSize:10,fontWeight:700,color:'#374151',marginBottom:5}}>{t('wallcal.text_position_label')}</div>
                                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                                        <span style={{fontSize:9,color:'#64748b',width:16}}>X</span>
                                        <input type="range" min={10} max={90}
                                            value={coverConfig.printedTextBlocks?.[0]?.x||50}
                                            onChange={e=>setCoverConfig(prev=>({...prev,printedTextBlocks:[
                                                {...(prev.printedTextBlocks?.[0]||{id:'t1',text:'',y:82,fontSize:22,color:'#ffffff',fontFamily:'Playfair Display',bold:true}),x:+e.target.value},
                                                ...(prev.printedTextBlocks?.slice(1)||[])
                                            ]}))}
                                            style={{flex:1,accentColor:'#1e2d7d'}}/>
                                    </div>
                                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                                        <span style={{fontSize:9,color:'#64748b',width:16}}>Y</span>
                                        <input type="range" min={5} max={95}
                                            value={coverConfig.printedTextBlocks?.[0]?.y||82}
                                            onChange={e=>setCoverConfig(prev=>({...prev,printedTextBlocks:[
                                                {...(prev.printedTextBlocks?.[0]||{id:'t1',text:'',x:50,fontSize:22,color:'#ffffff',fontFamily:'Playfair Display',bold:true}),y:+e.target.value},
                                                ...(prev.printedTextBlocks?.slice(1)||[])
                                            ]}))}
                                            style={{flex:1,accentColor:'#1e2d7d'}}/>
                                    </div>
                                </div>
                            </div>

                            <p style={{fontSize:10,color:'#94a3b8',lineHeight:1.5,marginTop:4}}>
                                 Перетягніть фото на обкладинку зліва
                            </p>
                        </div>
                    ) : (
                        /* Month tools */
                        <>
                            <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10}}>{t('wallcal.photo_template_label')}</div>
                            <div style={{display:'grid',gap:5}}>
                                {LAYOUTS.map(l=>(
                                    <button key={l.id} onClick={()=>setLayout(l.id)}
                                        style={{padding:'7px 10px',border:curMonth?.layout===l.id?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:8,background:curMonth?.layout===l.id?'#f0f3ff':'#fff',cursor:'pointer',textAlign:'left',fontSize:12,fontWeight:600,color:curMonth?.layout===l.id?'#1e2d7d':'#374151',display:'flex',alignItems:'center',gap:8}}>
                                        <span style={{fontSize:13}}>{l.icon}</span><span>{l.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div style={{marginTop:16,height:1,background:'#f1f5f9'}}/>
                            <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase',margin:'12px 0 8px'}}>{t('wallcal.accent_label')}</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                                {ACCENT_COLORS.map(c=>(
                                    <button key={c} onClick={()=>setAccent(c)} title={c}
                                        style={{width:26,height:26,borderRadius:'50%',background:c,border:accent===c?'2px solid #1e2d7d':'1px solid #e2e8f0',cursor:'pointer',boxShadow:accent===c?'0 0 0 2px #fff, 0 0 0 3px #1e2d7d':'none'}}/>
                                ))}
                            </div>

                            {/* Marked dates */}
                            <div style={{marginTop:12,height:1,background:'#f1f5f9'}}/>
                            <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase',margin:'12px 0 6px'}}>{t('wallcal.marked_dates_label')}</div>
                            {curMonth && (() => {
                                const key = `m${curMonth.month}`;
                                const monthMarks = markedDates[key] || [];
                                const toggleMark = (day: number) => {
                                    setMarkedDates(prev => {
                                        const ex = prev[key] || [];
                                        const idx = ex.findIndex(m => m.day === day);
                                        if (idx >= 0) {
                                            const same = ex[idx].shape === markShape && ex[idx].color === markColor;
                                            if (same) return {...prev, [key]: ex.filter((_,i)=>i!==idx)};
                                            return {...prev, [key]: ex.map((m,i)=>i===idx?{...m,shape:markShape,color:markColor}:m)};
                                        }
                                        return {...prev, [key]: [...ex, {day, shape:markShape, color:markColor}]};
                                    });
                                };
                                // Get days in month
                                const fd = new Date(curMonth.year, curMonth.month-1, 1).getDay();
                                const startOffset = fd === 0 ? 6 : fd - 1;
                                const daysInMonth = new Date(curMonth.year, curMonth.month, 0).getDate();
                                return (
                                    <div>
                                        <div style={{display:'flex',gap:4,marginBottom:5,flexWrap:'wrap'}}>
                                            <button onClick={()=>setMarkShape('circle')} style={{padding:'3px 6px',border:markShape==='circle'?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:10,background:markShape==='circle'?'#f0f3ff':'#fff',fontSize:9,fontWeight:700,cursor:'pointer',color:markShape==='circle'?'#1e2d7d':'#374151'}}>{t('wallcal.circle_mark')}</button>
                                            <button onClick={()=>setMarkShape('heart')} style={{padding:'3px 6px',border:markShape==='heart'?'2px solid #e11d48':'1px solid #e2e8f0',borderRadius:10,background:markShape==='heart'?'#fff1f2':'#fff',fontSize:9,fontWeight:700,cursor:'pointer',color:markShape==='heart'?'#e11d48':'#374151'}}>{t('wallcal.heart_mark')}</button>
                                        </div>
                                        <div style={{display:'flex',gap:3,marginBottom:5,flexWrap:'wrap'}}>
                                            {['#1e2d7d','#e11d48','#16a34a','#c8a96e','#7c3aed','#ea580c','#000'].map(c=>(
                                                <button key={c} onClick={()=>setMarkColor(c)} style={{width:16,height:16,borderRadius:'50%',background:c,border:markColor===c?'2.5px solid #1e2d7d':'1.5px solid #fff',cursor:'pointer',boxShadow:'0 0 0 0.5px #e2e8f0'}}/>
                                            ))}
                                            <input type="color" value={markColor} onChange={e=>setMarkColor(e.target.value)} style={{width:16,height:16,borderRadius:3,border:'1px solid #e2e8f0',cursor:'pointer',padding:0}}/>
                                        </div>
                                        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,marginBottom:2}}>
                                            {['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d=><div key={d} style={{fontSize:6,fontWeight:700,color:'#94a3b8',textAlign:'center'}}>{d}</div>)}
                                        </div>
                                        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1}}>
                                            {Array.from({length:startOffset}).map((_,i)=><div key={`e${i}`}/>)}
                                            {Array.from({length:daysInMonth},(_,i)=>{
                                                const day=i+1;
                                                const mark=monthMarks.find(m=>m.day===day);
                                                return (
                                                    <button key={day} onClick={()=>toggleMark(day)}
                                                        style={{aspectRatio:'1',borderRadius:mark?.shape==='heart'?2:'50%',border:mark?'none':'0.5px solid #e2e8f0',background:mark?mark.color:'#fff',color:mark?'#fff':'#374151',fontSize:7,fontWeight:mark?700:400,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',lineHeight:1}}>
                                                        {mark?.shape==='heart'&&<span style={{fontSize:8,position:'absolute'}}></span>}
                                                        <span style={{position:mark?.shape==='heart'?'absolute':'static',fontSize:6}}>{day}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {monthMarks.length>0&&<button onClick={()=>setMarkedDates(prev=>({...prev,[key]:[]}))} style={{marginTop:4,fontSize:8,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>{t('wallcal.clear_marks')}</button>}
                                    </div>
                                );
                            })()}

                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
