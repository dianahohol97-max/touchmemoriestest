'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { FONT_GROUPS, GOOGLE_FONTS_URL } from '@/lib/editor/constants';

// ── Locales ──────────────────────────────────────────────────────────────────

const LOCALES = {
  uk: {
    months: ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],
    days: ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'],
  },
  en: {
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    days: ['Mo','Tu','We','Th','Fr','Sa','Su'],
  },
  de: {
    months: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
    days: ['Mo','Di','Mi','Do','Fr','Sa','So'],
  },
  pl: {
    months: ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'],
    days: ['Pn','Wt','Śr','Cz','Pt','So','Nd'],
  },
  ro: {
    months: ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'],
    days: ['Lu','Ma','Mi','Jo','Vi','Sâ','Du'],
  },
};

type LangCode = keyof typeof LOCALES;

// ── Designs ──────────────────────────────────────────────────────────────────

interface Design {
  id: string;
  name: string;
  bg: string;
  headerBg: string;
  headerText: string;
  dayNameColor: string;
  dayColor: string;
  sundayColor: string;
  saturdayColor: string;
  todayBg: string;
  todayColor: string;
  gridLine: string;
  font: string;
  accentFont: string;
  coverBg: string;
  coverAccent: string;
}

const DESIGNS: Design[] = [
  {
    id: 'minimal',
    name: 'Мінімал',
    bg: '#ffffff',
    headerBg: '#1e2d7d',
    headerText: '#ffffff',
    dayNameColor: '#94a3b8',
    dayColor: '#1a1a2e',
    sundayColor: '#ef4444',
    saturdayColor: '#3b82f6',
    todayBg: '#1e2d7d',
    todayColor: '#ffffff',
    gridLine: '#f1f5f9',
    font: 'Montserrat',
    accentFont: 'Montserrat',
    coverBg: '#1e2d7d',
    coverAccent: '#ffffff',
  },
  {
    id: 'warm',
    name: 'Теплий',
    bg: '#faf7f2',
    headerBg: '#c8a96e',
    headerText: '#ffffff',
    dayNameColor: '#a0845c',
    dayColor: '#3d2c1e',
    sundayColor: '#c0392b',
    saturdayColor: '#7d6149',
    todayBg: '#c8a96e',
    todayColor: '#ffffff',
    gridLine: '#ede8df',
    font: 'Lora',
    accentFont: 'Playfair Display',
    coverBg: '#3d2c1e',
    coverAccent: '#c8a96e',
  },
  {
    id: 'fresh',
    name: 'Свіжий',
    bg: '#f0fdf4',
    headerBg: '#16a34a',
    headerText: '#ffffff',
    dayNameColor: '#4ade80',
    dayColor: '#14532d',
    sundayColor: '#dc2626',
    saturdayColor: '#2563eb',
    todayBg: '#16a34a',
    todayColor: '#ffffff',
    gridLine: '#dcfce7',
    font: 'Nunito',
    accentFont: 'Nunito',
    coverBg: '#14532d',
    coverAccent: '#4ade80',
  },
];

// ── Calendar math ─────────────────────────────────────────────────────────────

function getMonthDays(year: number, month: number) {
  // month: 1-12
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  // Convert Sunday=0 to Monday=0 format
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  return { startOffset, daysInMonth };
}

// ── Draw month page on canvas ─────────────────────────────────────────────────

function drawMonthPage(
  canvas: HTMLCanvasElement,
  month: number, // 1-12
  year: number,
  design: Design,
  lang: LangCode,
  photo: string | null,
  W: number,
  H: number,
) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = W;
  canvas.height = H;
  const locale = LOCALES[lang];

  // Background
  ctx.fillStyle = design.bg;
  ctx.fillRect(0, 0, W, H);

  const pad = Math.round(W * 0.05);
  const headerH = Math.round(H * 0.10);
  const photoH = photo ? Math.round(H * 0.42) : Math.round(H * 0.06);
  const calendarTop = pad + headerH + photoH + (photo ? pad * 0.5 : 0);
  const calendarH = H - calendarTop - pad;

  // Header bar
  ctx.fillStyle = design.headerBg;
  roundRect(ctx, pad, pad, W - 2 * pad, headerH, 8);
  ctx.fill();

  // Month name
  ctx.fillStyle = design.headerText;
  ctx.font = `800 ${Math.round(headerH * 0.45)}px '${design.accentFont}', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(locale.months[month - 1].toUpperCase(), W / 2, pad + headerH / 2);

  // Year small
  ctx.font = `400 ${Math.round(headerH * 0.28)}px '${design.font}', sans-serif`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(String(year), W / 2, pad + headerH * 0.8);
  ctx.globalAlpha = 1;

  // Photo area
  if (photo) {
    const photoY = pad + headerH + Math.round(pad * 0.5);
    const photoDrawH = photoH;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      roundRect(ctx, pad, photoY, W - 2 * pad, photoDrawH, 8);
      ctx.clip();
      // cover fit
      const aspect = img.width / img.height;
      const slotAspect = (W - 2 * pad) / photoDrawH;
      let dw, dh, dx, dy;
      if (aspect > slotAspect) { dh = photoDrawH; dw = dh * aspect; dx = pad - (dw - (W - 2 * pad)) / 2; dy = photoY; }
      else { dw = W - 2 * pad; dh = dw / aspect; dx = pad; dy = photoY - (dh - photoDrawH) / 2; }
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    };
    img.src = photo;
  }

  // Calendar grid
  const s = W / 360;
  const dayNameH = Math.round(22 * s);
  const cellH = Math.round((calendarH - dayNameH - pad * 0.3) / 6);
  const cellW = (W - 2 * pad) / 7;

  // Day names row
  locale.days.forEach((d, i) => {
    ctx.fillStyle = i >= 5 ? design.sundayColor : design.dayNameColor;
    ctx.font = `600 ${Math.round(11 * s)}px '${design.font}', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d, pad + i * cellW + cellW / 2, calendarTop + dayNameH / 2);
  });

  // Grid lines
  ctx.strokeStyle = design.gridLine;
  ctx.lineWidth = 1;
  for (let row = 0; row <= 6; row++) {
    ctx.beginPath();
    ctx.moveTo(pad, calendarTop + dayNameH + row * cellH);
    ctx.lineTo(W - pad, calendarTop + dayNameH + row * cellH);
    ctx.stroke();
  }

  // Days
  const { startOffset, daysInMonth } = getMonthDays(year, month);
  const today = new Date();
  const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year;

  for (let day = 1; day <= daysInMonth; day++) {
    const pos = startOffset + day - 1;
    const col = pos % 7;
    const row = Math.floor(pos / 7);
    const x = pad + col * cellW + cellW / 2;
    const y = calendarTop + dayNameH + row * cellH + cellH / 2;

    const isSunday = col === 6;
    const isSaturday = col === 5;
    const isToday = isCurrentMonth && today.getDate() === day;

    if (isToday) {
      ctx.fillStyle = design.todayBg;
      ctx.beginPath();
      ctx.arc(x, y, Math.round(cellH * 0.38), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isToday ? design.todayColor : isSunday ? design.sundayColor : isSaturday ? design.saturdayColor : design.dayColor;
    ctx.font = `${isToday ? 700 : 400} ${Math.round(13 * s)}px '${design.font}', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(day), x, y);
  }
}

// ── Draw cover ────────────────────────────────────────────────────────────────

function drawCoverPage(
  canvas: HTMLCanvasElement,
  design: Design,
  lang: LangCode,
  year: number,
  title: string,
  photo: string | null,
  W: number,
  H: number,
) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = W;
  canvas.height = H;

  // BG
  ctx.fillStyle = design.coverBg;
  ctx.fillRect(0, 0, W, H);

  // Photo background
  if (photo) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      // draw cover full
      const aspect = img.width / img.height;
      const slotAspect = W / H;
      let dw, dh, dx, dy;
      if (aspect > slotAspect) { dh = H; dw = dh * aspect; dx = -(dw - W) / 2; dy = 0; }
      else { dw = W; dh = dw / aspect; dx = 0; dy = -(dh - H) / 2; }
      ctx.globalAlpha = 0.65;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.globalAlpha = 1;
      ctx.restore();
      // Overlay gradient
      const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, design.coverBg + 'ee');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      drawCoverText(ctx, design, lang, year, title, W, H);
    };
    img.src = photo;
  } else {
    drawCoverText(ctx, design, lang, year, title, W, H);
  }
}

function drawCoverText(
  ctx: CanvasRenderingContext2D,
  design: Design,
  lang: LangCode,
  year: number,
  title: string,
  W: number,
  H: number,
) {
  const s = W / 300;
  // Big year
  ctx.fillStyle = design.coverAccent;
  ctx.font = `900 ${Math.round(72 * s)}px '${design.accentFont}', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.15;
  ctx.fillText(String(year), W / 2, H * 0.35);
  ctx.globalAlpha = 1;

  // Title
  ctx.fillStyle = design.coverAccent;
  ctx.font = `700 ${Math.round(22 * s)}px '${design.accentFont}', sans-serif`;
  ctx.fillText(title || String(year), W / 2, H * 0.62);

  // Subtitle — months range
  const locale = LOCALES[lang];
  ctx.font = `400 ${Math.round(10 * s)}px '${design.font}', sans-serif`;
  ctx.globalAlpha = 0.6;
  ctx.fillText(`${locale.months[0]} — ${locale.months[11]} ${year}`, W / 2, H * 0.72);
  ctx.globalAlpha = 1;

  // Decorative line
  ctx.strokeStyle = design.coverAccent;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(W * 0.25, H * 0.78);
  ctx.lineTo(W * 0.75, H * 0.78);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Helper
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

// ── Month Preview Component ───────────────────────────────────────────────────

function MonthCanvas({ month, year, design, lang, photo, W, H, isCover, coverTitle }: {
  month: number; year: number; design: Design; lang: LangCode;
  photo: string | null; W: number; H: number;
  isCover?: boolean; coverTitle?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    if (isCover) drawCoverPage(c, design, lang, year, coverTitle || String(year), photo, W, H);
    else drawMonthPage(c, month, year, design, lang, photo, W, H);
  }, [month, year, design, lang, photo, W, H, isCover, coverTitle]);

  return <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6 }} />;
}

// ── Main Constructor ──────────────────────────────────────────────────────────

export default function DeskCalendarConstructor() {
  const router = useRouter();
  const { addItem } = useCartStore();

  const [design, setDesign] = useState<Design>(DESIGNS[0]);
  const [lang, setLang] = useState<LangCode>('uk');
  const [year, setYear] = useState(2026);
  const [coverTitle, setCoverTitle] = useState('');
  const [activeMonth, setActiveMonth] = useState(0); // 0 = cover, 1-12 = months
  const [photos, setPhotos] = useState<(string | null)[]>(Array(13).fill(null)); // [cover, jan..dec]
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<number>(0);

  const PREVIEW_W = 320;
  const PREVIEW_H = Math.round(PREVIEW_W * (10 / 15)); // desk calendar ratio ~landscape

  // Load fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotos(prev => { const n = [...prev]; n[uploadTargetRef.current] = url; return n; });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openUpload = (idx: number) => {
    uploadTargetRef.current = idx;
    fileInputRef.current?.click();
  };

  const handleOrder = () => {
    addItem({
      id: `desk-calendar-${Date.now()}`,
      name: `Настільний календар ${year}`,
      price: 450,
      qty: 1,
      image: photos[0] || photos[1] || '',
      options: { 'Дизайн': design.name, 'Мова': lang, 'Рік': String(year) },
      personalization_note: `Дизайн: ${design.name}, Мова: ${lang}, Рік: ${year}, Назва: ${coverTitle}`,
    });
    toast.success('✅ Календар додано до кошика!');
    router.push('/cart');
  };

  const currentPhoto = photos[activeMonth];
  const locale = LOCALES[lang];

  const LANG_OPTIONS: { code: LangCode; label: string; flag: string }[] = [
    { code: 'uk', label: 'Українська', flag: '🇺🇦' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'pl', label: 'Polski', flag: '🇵🇱' },
    { code: 'ro', label: 'Română', flag: '🇷🇴' },
  ];

  return (
    <div style={{ display:'flex', minHeight:'80vh', fontFamily:'var(--font-primary,sans-serif)' }}>
      {/* ── LEFT PANEL ── */}
      <div style={{ width:340, flexShrink:0, background:'#fff', borderRight:'1px solid #e2e8f0', display:'flex', flexDirection:'column', overflowY:'auto' }}>
        <div style={{ padding:'20px 16px', borderBottom:'1px solid #f1f5f9' }}>
          <h2 style={{ fontSize:18, fontWeight:800, color:'#1e2d7d', margin:0 }}>Настільний календар</h2>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'4px 0 0' }}>12 місяців + обкладинка</p>
        </div>

        <div style={{ flex:1, padding:16, display:'flex', flexDirection:'column', gap:18 }}>

          {/* Design */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:8 }}>Дизайн</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {DESIGNS.map(d => (
                <button key={d.id} onClick={() => setDesign(d)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                    border: design.id===d.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                    borderRadius:10, background: design.id===d.id ? '#f0f3ff' : '#fff', cursor:'pointer' }}>
                  {/* Mini preview */}
                  <div style={{ width:40, height:28, borderRadius:4, background:d.headerBg, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                    <div style={{ height:'35%', background:d.headerBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ width:'60%', height:3, background:d.headerText, borderRadius:2, opacity:0.8 }}/>
                    </div>
                    <div style={{ flex:1, background:d.bg, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, padding:2 }}>
                      {Array.from({length:14}).map((_,i) => (
                        <div key={i} style={{ height:3, borderRadius:1, background: i<7 ? d.dayNameColor : d.dayColor, opacity: i<7?0.5:0.7 }}/>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color: design.id===d.id ? '#1e2d7d' : '#374151' }}>{d.name}</div>
                    <div style={{ fontSize:10, color:'#94a3b8', fontFamily: d.font }}>{d.font}</div>
                  </div>
                  {design.id===d.id && <span style={{ marginLeft:'auto', color:'#1e2d7d', fontSize:16 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:8 }}>Мова календаря</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {LANG_OPTIONS.map(l => (
                <button key={l.code} onClick={() => setLang(l.code)}
                  style={{ padding:'5px 10px', borderRadius:20, border: lang===l.code ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                    background: lang===l.code ? '#1e2d7d' : '#fff',
                    color: lang===l.code ? '#fff' : '#374151',
                    fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Year */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:8 }}>Рік</label>
            <div style={{ display:'flex', gap:6 }}>
              {[2025, 2026, 2027].map(y => (
                <button key={y} onClick={() => setYear(y)}
                  style={{ flex:1, padding:'8px', border: year===y ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                    borderRadius:8, background: year===y ? '#f0f3ff' : '#fff',
                    color: year===y ? '#1e2d7d' : '#374151', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Cover title */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:8 }}>Назва на обкладинці</label>
            <input type="text" value={coverTitle} onChange={e => setCoverTitle(e.target.value)}
              placeholder={`Наприклад: Наша сім'я ${year}`}
              style={{ width:'100%', padding:'9px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, boxSizing:'border-box' }}/>
          </div>

          {/* Photo for current page */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:8 }}>
              Фото для: {activeMonth === 0 ? 'Обкладинки' : locale.months[activeMonth - 1]}
            </label>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleUpload}/>
            {currentPhoto ? (
              <div style={{ position:'relative' }}>
                <img src={currentPhoto} style={{ width:'100%', height:100, objectFit:'cover', borderRadius:8, border:'2px solid #c7d2fe' }}/>
                <button onClick={() => setPhotos(prev => { const n=[...prev]; n[activeMonth]=null; return n; })}
                  style={{ position:'absolute', top:4, right:4, width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:13 }}>×</button>
              </div>
            ) : (
              <button onClick={() => openUpload(activeMonth)}
                style={{ width:'100%', padding:'14px', border:'2px dashed #c7d2fe', borderRadius:8, background:'#f8faff', color:'#1e2d7d', fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Upload size={14}/> Завантажити фото
              </button>
            )}
          </div>

          {/* Months nav */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:8 }}>Сторінки</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 }}>
              <button onClick={() => setActiveMonth(0)}
                style={{ padding:'6px 4px', border: activeMonth===0 ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                  borderRadius:6, background: activeMonth===0 ? '#f0f3ff' : '#fff',
                  fontSize:9, fontWeight:700, color: activeMonth===0 ? '#1e2d7d' : '#374151', cursor:'pointer', position:'relative' }}>
                Обкл.
                {photos[0] && <span style={{ position:'absolute', top:2, right:2, width:5, height:5, borderRadius:'50%', background:'#10b981' }}/>}
              </button>
              {Array.from({length:12}, (_,i) => {
                const m = i + 1;
                const hasPhoto = !!photos[m];
                return (
                  <button key={m} onClick={() => setActiveMonth(m)}
                    style={{ padding:'5px 2px', border: activeMonth===m ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                      borderRadius:6, background: activeMonth===m ? '#f0f3ff' : '#fff',
                      fontSize:9, fontWeight:600, color: activeMonth===m ? '#1e2d7d' : '#374151', cursor:'pointer', position:'relative' }}>
                    {locale.months[i].slice(0,3)}
                    {hasPhoto && <span style={{ position:'absolute', top:2, right:2, width:5, height:5, borderRadius:'50%', background:'#10b981' }}/>}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Order button */}
        <div style={{ padding:16, borderTop:'1px solid #f1f5f9' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:13, color:'#64748b' }}>Настільний календар {year}</span>
            <span style={{ fontSize:18, fontWeight:800, color:'#1e2d7d' }}>450 ₴</span>
          </div>
          <button onClick={handleOrder}
            style={{ width:'100%', padding:'13px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:10, fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 16px rgba(30,45,125,0.3)' }}>
            <ShoppingCart size={16}/> Замовити — 450 ₴
          </button>
        </div>
      </div>

      {/* ── RIGHT: Preview ── */}
      <div style={{ flex:1, background:'#f4f6fb', display:'flex', flexDirection:'column', alignItems:'center', padding:'28px 24px', gap:16, overflowY:'auto' }}>

        {/* Active page large preview */}
        <div style={{ width:'100%', maxWidth:PREVIEW_W + 40 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center', marginBottom:10 }}>
            {activeMonth === 0 ? 'Обкладинка' : locale.months[activeMonth-1] + ' ' + year}
          </div>
          <div style={{ boxShadow:'0 8px 40px rgba(0,0,0,0.15)', borderRadius:8, overflow:'hidden' }}>
            <MonthCanvas
              month={activeMonth || 1}
              year={year}
              design={design}
              lang={lang}
              photo={currentPhoto}
              W={PREVIEW_W}
              H={PREVIEW_H}
              isCover={activeMonth === 0}
              coverTitle={coverTitle}
            />
          </div>
          {/* Nav arrows */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:10 }}>
            <button onClick={() => setActiveMonth(m => Math.max(0, m-1))} disabled={activeMonth===0}
              style={{ padding:'6px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:activeMonth===0?'not-allowed':'pointer', color:activeMonth===0?'#cbd5e1':'#374151', fontWeight:700 }}>‹ Назад</button>
            <span style={{ fontSize:12, color:'#94a3b8', alignSelf:'center' }}>{activeMonth}/12</span>
            <button onClick={() => setActiveMonth(m => Math.min(12, m+1))} disabled={activeMonth===12}
              style={{ padding:'6px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:activeMonth===12?'not-allowed':'pointer', color:activeMonth===12?'#cbd5e1':'#374151', fontWeight:700 }}>Далі ›</button>
          </div>
        </div>

        {/* Mini strip of all months */}
        <div style={{ width:'100%', maxWidth:700 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>Всі сторінки</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
            {/* Cover */}
            <div onClick={() => setActiveMonth(0)} style={{ cursor:'pointer', borderRadius:6, overflow:'hidden', border: activeMonth===0 ? '2px solid #1e2d7d' : '1px solid #e2e8f0', boxSizing:'border-box' }}>
              <MonthCanvas month={1} year={year} design={design} lang={lang} photo={photos[0]} W={90} H={60} isCover coverTitle={coverTitle}/>
              <div style={{ fontSize:8, textAlign:'center', padding:'2px 0', background:'#fff', color:'#64748b', fontWeight:600 }}>Обкл.</div>
            </div>
            {/* Months */}
            {Array.from({length:12}, (_,i) => (
              <div key={i} onClick={() => setActiveMonth(i+1)} style={{ cursor:'pointer', borderRadius:6, overflow:'hidden', border: activeMonth===i+1 ? '2px solid #1e2d7d' : '1px solid #e2e8f0', boxSizing:'border-box' }}>
                <MonthCanvas month={i+1} year={year} design={design} lang={lang} photo={photos[i+1]} W={90} H={60}/>
                <div style={{ fontSize:8, textAlign:'center', padding:'2px 0', background:'#fff', color:'#64748b', fontWeight:600 }}>
                  {locale.months[i].slice(0,3)}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
