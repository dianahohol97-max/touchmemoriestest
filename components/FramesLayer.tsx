'use client';

export interface FrameConfig {
  frameId: string | null;
  color: string;
  opacity: number;
}

export const DEFAULT_FRAME: FrameConfig = { frameId: null, color: '#1e2d7d', opacity: 100 };

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
  {
    id: 'floral-simple',
    label: 'Квіткова',
    group: 'Квіткові',
    render: (w:number, h:number, color:string, op:number) => {
      const petal = (cx:number, cy:number, r:number) =>
        `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r*0.5}" fill="${color}"/>`;
      const flower = (x:number, y:number, r:number) => {
        const petals = [0,60,120,180,240,300].map(a => {
          const rad = a*Math.PI/180;
          return `<ellipse cx="${x+Math.cos(rad)*r*0.8}" cy="${y+Math.sin(rad)*r*0.8}" rx="${r*0.6}" ry="${r*0.3}" fill="${color}" transform="rotate(${a},${x+Math.cos(rad)*r*0.8},${y+Math.sin(rad)*r*0.8})"/>`;
        }).join('');
        return petals + `<circle cx="${x}" cy="${y}" r="${r*0.4}" fill="${color}"/>`;
      };
      return `<g opacity="${op/100}">
        <rect x="14" y="14" width="${w-28}" height="${h-28}" fill="none" stroke="${color}" stroke-width="1.5"/>
        ${flower(12,12,10)} ${flower(w-12,12,10)} ${flower(12,h-12,10)} ${flower(w-12,h-12,10)}
        ${flower(w/2,12,8)} ${flower(w/2,h-12,8)} ${flower(12,h/2,8)} ${flower(w-12,h/2,8)}
      </g>`;
    },
  },
  {
    id: 'wreath',
    label: 'Вінок',
    group: 'Квіткові',
    render: (w:number, h:number, color:string, op:number) => {
      const leaves = [];
      const count = 24;
      for (let i=0; i<count; i++) {
        const t = i/count;
        let x,y,angle;
        if (t<0.25) { x=16+t*4*(w-32); y=10; angle=90; }
        else if (t<0.5) { x=w-10; y=10+(t-0.25)*4*(h-20); angle=0; }
        else if (t<0.75) { x=w-16-(t-0.5)*4*(w-32); y=h-10; angle=270; }
        else { x=10; y=h-10-(t-0.75)*4*(h-20); angle=180; }
        leaves.push(`<ellipse cx="${x}" cy="${y}" rx="8" ry="4" fill="${color}" opacity="0.7" transform="rotate(${angle},${x},${y})"/>`);
        if (i%4===0) leaves.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`);
      }
      return `<g opacity="${op/100}">${leaves.join('')}
        <rect x="20" y="20" width="${w-40}" height="${h-40}" fill="none" stroke="${color}" stroke-width="1" opacity="0.4"/>
      </g>`;
    },
  },
  {
    id: 'roses',
    label: 'Троянди',
    group: 'Квіткові',
    render: (w:number, h:number, color:string, op:number) => {
      const rose = (x:number, y:number, r:number) => {
        const rings = [1,0.7,0.45,0.25].map((scale,i) =>
          `<circle cx="${x}" cy="${y}" r="${r*scale}" fill="none" stroke="${color}" stroke-width="${1.5-i*0.3}" opacity="${0.9-i*0.15}"/>`
        ).join('');
        return rings + [0,90,180,270].map(a=>{
          const rad=a*Math.PI/180;
          return `<ellipse cx="${x+Math.cos(rad)*r*0.55}" cy="${y+Math.sin(rad)*r*0.55}" rx="${r*0.35}" ry="${r*0.2}" fill="${color}" opacity="0.6" transform="rotate(${a+45},${x+Math.cos(rad)*r*0.55},${y+Math.sin(rad)*r*0.55})"/>`;
        }).join('');
      };
      const stems = `<g stroke="${color}" stroke-width="1.5" opacity="0.5" fill="none">
        <path d="M22,22 Q18,${h/2} 22,${h-22}"/>
        <path d="M${w-22},22 Q${w-18},${h/2} ${w-22},${h-22}"/>
        <path d="M22,22 Q${w/2},18 ${w-22},22"/>
        <path d="M22,${h-22} Q${w/2},${h-18} ${w-22},${h-22}"/>
      </g>`;
      return `<g opacity="${op/100}">${stems}
        ${rose(18,18,14)} ${rose(w-18,18,14)} ${rose(18,h-18,14)} ${rose(w-18,h-18,14)}
        ${rose(w/2,14,10)} ${rose(w/2,h-14,10)} ${rose(14,h/2,10)} ${rose(w-14,h/2,10)}
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
  const def = FRAMES.find(f=>f.id===frame.frameId);
  if (!def) return null;
  const svgContent = def.render(canvasW, canvasH, frame.color, frame.opacity);
  return (
    <div style={{ position:'absolute', inset:0, zIndex:35, pointerEvents:'none' }}>
      <svg width={canvasW} height={canvasH} style={{ display:'block' }}
        dangerouslySetInnerHTML={{ __html: svgContent }} />
    </div>
  );
}

interface FrameControlsProps {
  frame: FrameConfig;
  onChange: (frame: FrameConfig) => void;
}

export function FrameControls({ frame, onChange }: FrameControlsProps) {
  const groups = ['Прості']; // Only simple frames
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {groups.map(group => (
        <div key={group}>
          <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>{group}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            {FRAMES.filter(f=>f.group===group).map(f => {
              const active = frame.frameId===f.id;
              return (
                <button key={f.id} onClick={() => onChange({ ...frame, frameId: active ? null : f.id })}
                  style={{ padding:'6px 4px', border: active?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:7, background: active?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:600, fontSize:10, color: active?'#1e2d7d':'#374151' }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {frame.frameId && (
        <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:8 }}>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'#94a3b8', marginBottom:3 }}>Колір рамки</div>
              <input type="color" value={frame.color} onChange={e=>onChange({...frame,color:e.target.value})}
                style={{ width:'100%', height:28, borderRadius:4, border:'1px solid #e2e8f0', cursor:'pointer', padding:2 }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:10, color:'#94a3b8' }}>Прозорість</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{frame.opacity}%</span>
              </div>
              <input type="range" min={10} max={100} value={frame.opacity}
                onChange={e=>onChange({...frame,opacity:+e.target.value})}
                style={{ width:'100%', marginTop:6 }}/>
            </div>
          </div>
          <button onClick={()=>onChange({...frame,frameId:null})}
            style={{ padding:'6px', border:'1px solid #fee2e2', borderRadius:7, background:'#fff7f7', cursor:'pointer', fontWeight:600, fontSize:11, color:'#ef4444', width:'100%' }}>
            ✕ Прибрати рамку
          </button>
        </div>
      )}
    </div>
  );
}
