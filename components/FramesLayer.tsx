'use client';
import React from 'react';

export interface FrameConfig {
  frameId: string | null;
  color: string;
  opacity: number;
  scale: number;
  x: number;
  y: number;
  zIndex?: number;
}

export const DEFAULT_FRAME: FrameConfig = { frameId: null, color: '#1e2d7d', opacity: 100, scale: 0.6, x: 0, y: 0, zIndex: 35 };

// PNG frames — rendered as <img> overlay, black bg = transparent (mix-blend-mode: multiply not needed, these have real alpha)
export const PNG_FRAMES = [
  // ── Акварельні квіткові ──
  { id: 'png-pink-roses-watercolor',  label: 'Рожеві троянди',    group: 'Акварельні', src: '/frames/pink-roses-watercolor.png' },
  { id: 'png-pink-flower-corner',     label: 'Рожеві маки',        group: 'Акварельні', src: '/frames/pink-flower-corner.png' },
  { id: 'png-eucalyptus-gold-square', label: 'Евкаліпт квадрат',  group: 'Акварельні', src: '/frames/eucalyptus-gold-square.png' },
  { id: 'png-jasmine-corners',        label: 'Жасмин кутики',     group: 'Акварельні', src: '/frames/jasmine-corners.png' },
  { id: 'png-botanical-vines',        label: 'Ботанічні ліани',   group: 'Акварельні', src: '/frames/botanical-vines-square.png' },
  { id: 'png-lily-corner',            label: 'Лілії кутик',       group: 'Акварельні', src: '/frames/lily-corner.png' },
  // ── Золоті класичні ──
  { id: 'png-gold-baroque-simple',    label: 'Золото бароко',      group: 'Золоті',    src: '/frames/gold-baroque-simple.png' },
  { id: 'png-gold-baroque-ornate',    label: 'Золото розкішне',    group: 'Золоті',    src: '/frames/gold-baroque-ornate.png' },
  { id: 'png-gold-rococo-ornate',     label: 'Золото рококо',      group: 'Золоті',    src: '/frames/gold-rococo-ornate.png' },
  { id: 'png-gold-ornate-portrait',   label: 'Золото портрет',     group: 'Золоті',    src: '/frames/gold-ornate-portrait.png' },
  // ── Весільні (gold + florals) ──
  { id: 'png-boho-gold-floral',       label: 'Бохо золото',        group: 'Весільні PNG', src: '/frames/boho-gold-floral.png' },
  { id: 'png-roses-gold-circle',      label: 'Троянди коло',       group: 'Весільні PNG', src: '/frames/roses-gold-circle.png' },
  { id: 'png-eucalyptus-gold-circle', label: 'Евкаліпт коло',      group: 'Весільні PNG', src: '/frames/eucalyptus-gold-circle.png' },
  // ── Векторні декоративні ──
  { id: 'png-gdj-floral-wreath',      label: 'Квітковий вінок',    group: 'Векторні', src: '/frames/gdj-floral-wreath.png' },
  { id: 'png-gdj-leaves-circle',      label: 'Листя коло',         group: 'Векторні', src: '/frames/gdj-leaves-circle.png' },
  { id: 'png-gdj-botanical-square',   label: 'Ботаніка квадрат',   group: 'Векторні', src: '/frames/gdj-botanical-square.png' },
  { id: 'png-gdj-vintage',            label: 'Вінтаж',             group: 'Векторні', src: '/frames/gdj-vintage.png' },
  { id: 'png-black-floral-border',    label: 'Чорна флора',        group: 'Векторні', src: '/frames/black-floral-border.png' },
  { id: 'png-black-floral-2',         label: 'Чорна флора 2',      group: 'Векторні', src: '/frames/black-floral-2.png' },
  { id: 'png-silver-ornament-bands',  label: 'Срібний орнамент',   group: 'Векторні', src: '/frames/silver-ornament-bands.png' },
  { id: 'png-teal-monstera-square',   label: 'Монстера',           group: 'Векторні', src: '/frames/teal-monstera-square.png' },
  { id: 'png-jungle-vines-square',    label: 'Джунглі ліани',      group: 'Векторні', src: '/frames/jungle-vines-square.png' },
  // ── Акварельні 2 ──
  { id: 'png-blue-leaves-corners',    label: 'Сині листя',         group: 'Акварельні', src: '/frames/blue-leaves-corners.png' },
  { id: 'png-peach-roses-gold',       label: 'Персик троянди',     group: 'Акварельні', src: '/frames/peach-roses-gold.png' },
  { id: 'png-green-berries-wreath',   label: 'Зелений вінок',      group: 'Акварельні', src: '/frames/green-berries-wreath.png' },
  { id: 'png-eucalyptus-white-flowers', label: 'Евкаліпт+квіти',  group: 'Акварельні', src: '/frames/eucalyptus-white-flowers.png' },
  { id: 'png-sage-botanical-corner',  label: 'Сейдж кутик',        group: 'Акварельні', src: '/frames/sage-botanical-corner.png' },
  { id: 'png-white-roses-cascade',    label: 'Білі троянди',       group: 'Акварельні', src: '/frames/white-roses-cascade.png' },
  // ── Весільні PNG 2 ──
  { id: 'png-pink-hexagon-gold',      label: 'Рожевий шестикут',   group: 'Весільні PNG', src: '/frames/pink-hexagon-gold.png' },
  { id: 'png-pink-roses-gold-circle', label: 'Рожеве коло',        group: 'Весільні PNG', src: '/frames/pink-roses-gold-circle.png' },
  { id: 'png-gold-acanthus-corner',   label: 'Золотий аканф',      group: 'Весільні PNG', src: '/frames/gold-acanthus-corner.png' },
  { id: 'png-pink-cherry-gold-poly',  label: 'Сакура золото',      group: 'Весільні PNG', src: '/frames/pink-cherry-gold-poly.png' },
  // ── Спеціальні ──
  { id: 'png-polaroid-paperclip',     label: 'Поляроїд',           group: 'Спеціальні', src: '/frames/polaroid-paperclip.png' },
  { id: 'png-vyshyvanka-blue-top',     label: 'Вишиванка синя',     group: 'Спеціальні', src: '/frames/vyshyvanka-blue-top.png' },
];

// All frames combined (SVG + PNG) — used in picker
export const ALL_FRAMES_FLAT = [...PNG_FRAMES]; // SVG appended below

// SVG frame definitions
export const FRAMES = [
  // ── Simple frames ──
  {
    id: 'simple-thin',
    label: 'Тонка (1мм)',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(1, Math.round(w * 0.003)); // 1mm
      const g = sw * 3;
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'simple-medium',
    label: 'Середня (3мм)',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(2, Math.round(w * 0.007)); // 3mm
      const g = sw * 2;
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'simple-thick',
    label: 'Товста (6мм)',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(3, Math.round(w * 0.015)); // 6mm
      const g = sw * 1.5;
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'double',
    label: 'Подвійна',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw1 = Math.max(1, Math.round(w * 0.005));
      const sw2 = Math.max(1, Math.round(w * 0.008));
      const g1 = sw1 * 2, g2 = g1 + sw1 * 4;
      return `<rect x="${g1}" y="${g1}" width="${w-g1*2}" height="${h-g1*2}" fill="none" stroke="${color}" stroke-width="${sw1}" opacity="${op/100}"/>
       <rect x="${g2}" y="${g2}" width="${w-g2*2}" height="${h-g2*2}" fill="none" stroke="${color}" stroke-width="${sw2}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'rounded',
    label: 'Округла',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(2, Math.round(w * 0.012));
      const g = sw * 1.5;
      const rx = Math.round(w * 0.04);
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" rx="${rx}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op/100}"/>`;
    },
  },
  {
    id: 'dashed',
    label: 'Пунктирна',
    group: 'Прості',
    render: (w:number, h:number, color:string, op:number) => {
      const sw = Math.max(1, Math.round(w * 0.008));
      const g = sw * 2;
      const dash = Math.round(w * 0.03);
      const gap = Math.round(w * 0.015);
      return `<rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dash},${gap}" opacity="${op/100}"/>`;
    },
  },

  // REMOVED: Decorative and Floral frames — use SVG only simple
  // ── Decorative frames ──
  {
    id: 'corners',
    label: 'Кутики',
    group: 'Декоративні',
    render: (w:number, h:number, color:string, op:number) => {
      const s = 30, sw = 4;
      return `<g stroke="${color}" stroke-width="${sw}" fill="none" opacity="${op/100}">
        <path d="M${s},12 L12,12 L12,${s}"/>
        <path d="M${w-s},12 L${w-12},12 L${w-12},${s}"/>
        <path d="M12,${h-s} L12,${h-12} L${s},${h-12}"/>
        <path d="M${w-12},${h-s} L${w-12},${h-12} L${w-s},${h-12}"/>
      </g>`;
    },
  },
  {
    id: 'ornate-corners',
    label: 'Орнамент',
    group: 'Декоративні',
    render: (w:number, h:number, color:string, op:number) => {
      const s = 45, sw = 3;
      return `<g stroke="${color}" fill="${color}" opacity="${op/100}">
        <rect x="10" y="10" width="${w-20}" height="${h-20}" fill="none" stroke="${color}" stroke-width="1.5"/>
        <path d="M${s},10 L10,10 L10,${s}" fill="none" stroke-width="${sw}"/>
        <path d="M${w-s},10 L${w-10},10 L${w-10},${s}" fill="none" stroke-width="${sw}"/>
        <path d="M10,${h-s} L10,${h-10} L${s},${h-10}" fill="none" stroke-width="${sw}"/>
        <path d="M${w-10},${h-s} L${w-10},${h-10} L${w-s},${h-10}" fill="none" stroke-width="${sw}"/>
        <circle cx="10" cy="10" r="4"/>
        <circle cx="${w-10}" cy="10" r="4"/>
        <circle cx="10" cy="${h-10}" r="4"/>
        <circle cx="${w-10}" cy="${h-10}" r="4"/>
        <circle cx="${w/2}" cy="10" r="3"/>
        <circle cx="${w/2}" cy="${h-10}" r="3"/>
        <circle cx="10" cy="${h/2}" r="3"/>
        <circle cx="${w-10}" cy="${h/2}" r="3"/>
      </g>`;
    },
  },
];

interface FrameLayerProps {
  frame: FrameConfig;
  canvasW: number;
  canvasH: number;
}

export function FrameLayer({ frame, canvasW, canvasH }: FrameLayerProps) {
  if (!frame.frameId) return null;

  const scale = frame.scale ?? 0.6;
  const xOff = frame.x ?? 0;
  const yOff = frame.y ?? 0;
  // Use the smaller dimension as base so frame doesn't stretch on spreads
  const baseDim = Math.min(canvasW, canvasH);
  const fw = baseDim * scale;
  const fh = baseDim * scale;
  const cx = (canvasW - fw) / 2 + xOff;
  const cy = (canvasH - fh) / 2 + yOff;

  const wrapStyle: React.CSSProperties = {
    position: 'absolute', left: cx, top: cy, width: fw, height: fh,
    zIndex: frame.zIndex ?? 35, pointerEvents: 'none', overflow: 'visible',
    opacity: frame.opacity / 100,
  };

  const pngDef = PNG_FRAMES.find(f => f.id === frame.frameId);
  if (pngDef) {
    return (
      <div style={wrapStyle}>
        <img src={pngDef.src} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
      </div>
    );
  }

  const def = FRAMES.find(f => f.id === frame.frameId);
  if (!def) return null;
  const svgContent = def.render(fw, fh, frame.color, 100);
  return (
    <div style={wrapStyle}>
      <svg width={fw} height={fh} style={{ display:'block' }}
        dangerouslySetInnerHTML={{ __html: svgContent }} />
    </div>
  );
}

interface FrameControlsProps {
  frame: FrameConfig;
  onChange: (frame: FrameConfig) => void;
}

export function FrameControls({ frame, onChange }: FrameControlsProps) {
  const allGroups = [...new Set(FRAMES.map(f => f.group))];
  const allPngGroups = [...new Set(PNG_FRAMES.map(f => f.group))];
  const thumbW = 72, thumbH = 52;

  // Find label from either SVG or PNG frames
  const activeLabel =
    PNG_FRAMES.find(f => f.id === frame.frameId)?.label ||
    FRAMES.find(f => f.id === frame.frameId)?.label ||
    'Рамка';

  // Is active frame a PNG?
  const isPng = !!PNG_FRAMES.find(f => f.id === frame.frameId);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {/* Active frame controls — STICKY at top */}
      {frame.frameId && (
        <div style={{ background:'#f0f3ff', borderRadius:10, padding:10, border:'1px solid #c7d2fe', position:'sticky', top:0, zIndex:5 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#1e2d7d' }}>{activeLabel}</span>
            <button onClick={()=>onChange({...frame,frameId:null})}
              style={{ padding:'3px 10px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff7f7', cursor:'pointer', fontWeight:600, fontSize:10, color:'#ef4444' }}>
              ✕ Прибрати
            </button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {!isPng && (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Колір</div>
                <input type="color" value={frame.color} onChange={e=>onChange({...frame,color:e.target.value})}
                  style={{ width:'100%', height:26, borderRadius:4, border:'1px solid #e2e8f0', cursor:'pointer', padding:1 }}/>
              </div>
            )}
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:10, color:'#64748b' }}>Прозорість</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{frame.opacity}%</span>
              </div>
              <input type="range" min={10} max={100} value={frame.opacity}
                onChange={e=>onChange({...frame,opacity:+e.target.value})}
                style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
            </div>
          </div>
          {/* Scale */}
          <div style={{ marginTop:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, color:'#64748b' }}>Розмір</span>
              <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{Math.round((frame.scale??0.6)*100)}%</span>
            </div>
            <input type="range" min={10} max={200} value={Math.round((frame.scale??0.6)*100)}
              onChange={e=>onChange({...frame, scale: +e.target.value/100})}
              style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
          </div>
          {/* Position */}
          <div style={{ display:'flex', gap:8, marginTop:6 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:10, color:'#64748b' }}>← →</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{frame.x??0}px</span>
              </div>
              <input type="range" min={-500} max={500} value={frame.x??0}
                onChange={e=>onChange({...frame, x: +e.target.value})}
                style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:10, color:'#64748b' }}>↑ ↓</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{frame.y??0}px</span>
              </div>
              <input type="range" min={-500} max={500} value={frame.y??0}
                onChange={e=>onChange({...frame, y: +e.target.value})}
                style={{ width:'100%', marginTop:4, accentColor:'#1e2d7d' }}/>
            </div>
          </div>
          <button onClick={()=>onChange({...frame, scale:0.6, x:0, y:0, zIndex:35})}
            style={{ marginTop:6, width:'100%', padding:'4px 0', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', cursor:'pointer', fontSize:10, color:'#64748b' }}>
            ↺ Скинути позицію
          </button>
          {/* Z-index layer control */}
          <div style={{ display:'flex', gap:4, marginTop:6 }}>
            <button onClick={()=>onChange({...frame, zIndex: Math.max(1, (frame.zIndex??35)-5)})}
              style={{ flex:1, padding:'4px 0', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', cursor:'pointer', fontSize:10, color:'#64748b', fontWeight:600 }}>
              ↓ Назад
            </button>
            <span style={{ display:'flex', alignItems:'center', fontSize:10, fontWeight:700, color:'#1e2d7d', minWidth:30, justifyContent:'center' }}>{frame.zIndex??35}</span>
            <button onClick={()=>onChange({...frame, zIndex: Math.min(99, (frame.zIndex??35)+5)})}
              style={{ flex:1, padding:'4px 0', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', cursor:'pointer', fontSize:10, color:'#64748b', fontWeight:600 }}>
              ↑ Вперед
            </button>
          </div>
        </div>
      )}

      {/* PNG frames — grouped */}
      {allPngGroups.map(group => (
        <div key={group}>
          <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>{group}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            {PNG_FRAMES.filter(f=>f.group===group).map(f => {
              const active = frame.frameId===f.id;
              return (
                <button key={f.id} onClick={() => onChange(active ? { ...frame, frameId: null } : { ...DEFAULT_FRAME, frameId: f.id, color: frame.color })}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 4px', border: active?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background: active?'#f0f3ff':'#fff', cursor:'pointer' }}>
                  <div style={{ width:thumbW, height:thumbH, position:'relative', overflow:'hidden', borderRadius:4, background:'#f8fafc' }}>
                    <img src={f.src} alt={f.label}
                      style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                  </div>
                  <span style={{ fontSize:9, fontWeight:600, color: active?'#1e2d7d':'#64748b', lineHeight:1.2, textAlign:'center' }}>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* SVG frames — grouped */}
      {allGroups.map(group => (
        <div key={group}>
          <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>{group}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            {FRAMES.filter(f=>f.group===group).map(f => {
              const active = frame.frameId===f.id;
              const previewColor = active ? '#1e2d7d' : '#64748b';
              const svgContent = f.render(thumbW, thumbH, previewColor, active ? 100 : 60);
              return (
                <button key={f.id} onClick={() => onChange(active ? { ...frame, frameId: null } : { ...DEFAULT_FRAME, frameId: f.id, color: frame.color })}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 4px', border: active?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background: active?'#f0f3ff':'#fff', cursor:'pointer' }}>
                  <svg viewBox={`0 0 ${thumbW} ${thumbH}`} width={thumbW} height={thumbH} dangerouslySetInnerHTML={{ __html: svgContent }}/>
                  <span style={{ fontSize:9, fontWeight:600, color: active?'#1e2d7d':'#64748b', lineHeight:1.2 }}>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
