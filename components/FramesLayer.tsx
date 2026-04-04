'use client';

export interface FrameConfig {
  frameId: string | null;
  color: string;
  opacity: number;
}

export const DEFAULT_FRAME: FrameConfig = { frameId: null, color: '#1e2d7d', opacity: 100 };

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
      const leaves: string[] = [];
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

  // ── Ботанічні ──
  {
    id: 'botanical-vine',
    label: 'Ліани',
    group: 'Ботанічні',
    render: (w:number, h:number, color:string, op:number) => {
      const leaf = (x:number, y:number, a:number, s:number=1) =>
        `<path d="M${x},${y} Q${x+6*s},${y-10*s} ${x+12*s},${y} Q${x+6*s},${y+3*s} ${x},${y}" fill="${color}" opacity="0.6" transform="rotate(${a},${x},${y})"/>`;
      const leaves: string[] = [];
      const count = 16;
      for (let i=0;i<count;i++) {
        const t=i/count;
        if (t<0.25) { leaves.push(leaf(16+t*4*(w-32),12,90+Math.sin(i*2)*20)); }
        else if (t<0.5) { leaves.push(leaf(w-12,16+(t-0.25)*4*(h-32),Math.sin(i*2)*20)); }
        else if (t<0.75) { leaves.push(leaf(w-16-(t-0.5)*4*(w-32),h-12,270+Math.sin(i*2)*20)); }
        else { leaves.push(leaf(12,h-16-(t-0.75)*4*(h-32),180+Math.sin(i*2)*20)); }
      }
      return `<g opacity="${op/100}">
        <path d="M16,16 Q${w/2},10 ${w-16},16 Q${w-10},${h/2} ${w-16},${h-16} Q${w/2},${h-10} 16,${h-16} Q10,${h/2} 16,16" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>
        ${leaves.join('')}
      </g>`;
    },
  },
  {
    id: 'botanical-eucalyptus',
    label: 'Евкаліпт',
    group: 'Ботанічні',
    render: (w:number, h:number, color:string, op:number) => {
      const branch = (x1:number, y1:number, x2:number, y2:number, side:number) => {
        const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
        const leaves: string[] = [];
        const count = Math.floor(len/12);
        for (let i=1;i<count;i++) {
          const t=i/count;
          const px=x1+dx*t, py=y1+dy*t;
          const a=Math.atan2(dy,dx)*180/Math.PI+90*side;
          leaves.push(`<ellipse cx="${px}" cy="${py}" rx="5" ry="3" fill="${color}" opacity="0.5" transform="rotate(${a},${px},${py})"/>`);
        }
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.2" opacity="0.35"/>${leaves.join('')}`;
      };
      return `<g opacity="${op/100}">
        ${branch(10,10,w*0.35,10,1)}${branch(w*0.65,10,w-10,10,-1)}
        ${branch(10,h-10,w*0.35,h-10,-1)}${branch(w*0.65,h-10,w-10,h-10,1)}
        ${branch(10,10,10,h*0.35,1)}${branch(10,h*0.65,10,h-10,-1)}
        ${branch(w-10,10,w-10,h*0.35,-1)}${branch(w-10,h*0.65,w-10,h-10,1)}
      </g>`;
    },
  },
  {
    id: 'botanical-olive',
    label: 'Оливка',
    group: 'Ботанічні',
    render: (w:number, h:number, color:string, op:number) => {
      const branch = (x:number, y:number, angle:number, len:number) => {
        const r=angle*Math.PI/180;
        const ex=x+Math.cos(r)*len, ey=y+Math.sin(r)*len;
        const leaves: string[] = [];
        for (let i=1;i<6;i++) {
          const t=i/6;
          const px=x+(ex-x)*t, py=y+(ey-y)*t;
          leaves.push(`<ellipse cx="${px}" cy="${py}" rx="4" ry="2.5" fill="${color}" opacity="0.55" transform="rotate(${angle+45+i%2*90},${px},${py})"/>`);
          if (i%2===0) leaves.push(`<circle cx="${px+3}" cy="${py-3}" r="2" fill="${color}" opacity="0.7"/>`);
        }
        return `<line x1="${x}" y1="${y}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width="1" opacity="0.4"/>${leaves.join('')}`;
      };
      return `<g opacity="${op/100}">
        ${branch(8,8,30,w*0.3)}${branch(w-8,8,150,w*0.3)}
        ${branch(8,h-8,-30,w*0.3)}${branch(w-8,h-8,210,w*0.3)}
      </g>`;
    },
  },

  // ── Мінімалістичні ──
  {
    id: 'minimal-lines',
    label: 'Лінії',
    group: 'Мінімалістичні',
    render: (w:number, h:number, color:string, op:number) => {
      const g=18, sw=1.5;
      return `<g stroke="${color}" stroke-width="${sw}" opacity="${op/100}" fill="none">
        <line x1="${g}" y1="${g}" x2="${w*0.3}" y2="${g}"/><line x1="${w*0.7}" y1="${g}" x2="${w-g}" y2="${g}"/>
        <line x1="${w-g}" y1="${g}" x2="${w-g}" y2="${h*0.3}"/><line x1="${w-g}" y1="${h*0.7}" x2="${w-g}" y2="${h-g}"/>
        <line x1="${w-g}" y1="${h-g}" x2="${w*0.7}" y2="${h-g}"/><line x1="${w*0.3}" y1="${h-g}" x2="${g}" y2="${h-g}"/>
        <line x1="${g}" y1="${h-g}" x2="${g}" y2="${h*0.7}"/><line x1="${g}" y1="${h*0.3}" x2="${g}" y2="${g}"/>
      </g>`;
    },
  },
  {
    id: 'minimal-dots',
    label: 'Точки',
    group: 'Мінімалістичні',
    render: (w:number, h:number, color:string, op:number) => {
      const dots: string[] = [];
      const g=12, spacing=14, r=1.8;
      for (let x=g;x<=w-g;x+=spacing) { dots.push(`<circle cx="${x}" cy="${g}" r="${r}"/>`); dots.push(`<circle cx="${x}" cy="${h-g}" r="${r}"/>`); }
      for (let y=g+spacing;y<=h-g-spacing;y+=spacing) { dots.push(`<circle cx="${g}" cy="${y}" r="${r}"/>`); dots.push(`<circle cx="${w-g}" cy="${y}" r="${r}"/>`); }
      return `<g fill="${color}" opacity="${op/100}">${dots.join('')}</g>`;
    },
  },
  {
    id: 'minimal-geometric',
    label: 'Геометрія',
    group: 'Мінімалістичні',
    render: (w:number, h:number, color:string, op:number) => {
      const g=14;
      return `<g stroke="${color}" fill="none" stroke-width="1.5" opacity="${op/100}">
        <rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}"/>
        <line x1="${g}" y1="${g+8}" x2="${g+8}" y2="${g}"/>
        <line x1="${w-g}" y1="${g+8}" x2="${w-g-8}" y2="${g}"/>
        <line x1="${g}" y1="${h-g-8}" x2="${g+8}" y2="${h-g}"/>
        <line x1="${w-g}" y1="${h-g-8}" x2="${w-g-8}" y2="${h-g}"/>
      </g>`;
    },
  },
  {
    id: 'minimal-art-deco',
    label: 'Арт-деко',
    group: 'Мінімалістичні',
    render: (w:number, h:number, color:string, op:number) => {
      const g=16, c=25;
      return `<g stroke="${color}" fill="none" stroke-width="1.5" opacity="${op/100}">
        <rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}"/>
        <path d="M${g},${g+c} L${g+c},${g}"/><path d="M${w-g},${g+c} L${w-g-c},${g}"/>
        <path d="M${g},${h-g-c} L${g+c},${h-g}"/><path d="M${w-g},${h-g-c} L${w-g-c},${h-g}"/>
        <line x1="${w/2-20}" y1="${g}" x2="${w/2+20}" y2="${g}"/>
        <line x1="${w/2-20}" y1="${h-g}" x2="${w/2+20}" y2="${h-g}"/>
        <circle cx="${w/2}" cy="${g}" r="3" fill="${color}"/><circle cx="${w/2}" cy="${h-g}" r="3" fill="${color}"/>
      </g>`;
    },
  },
  {
    id: 'minimal-diamond',
    label: 'Ромб',
    group: 'Мінімалістичні',
    render: (w:number, h:number, color:string, op:number) => {
      const g=20;
      return `<g stroke="${color}" fill="none" stroke-width="1.8" opacity="${op/100}">
        <polygon points="${w/2},${g} ${w-g},${h/2} ${w/2},${h-g} ${g},${h/2}"/>
        <polygon points="${w/2},${g+8} ${w-g-8},${h/2} ${w/2},${h-g-8} ${g+8},${h/2}" stroke-width="0.8"/>
      </g>`;
    },
  },

  // ── Класичні/Вінтажні ──
  {
    id: 'vintage-ornate',
    label: 'Вінтаж',
    group: 'Класичні',
    render: (w:number, h:number, color:string, op:number) => {
      const g=12, sw=2;
      const scroll = (x:number, y:number, dx:number, dy:number) =>
        `<path d="M${x},${y} q${dx*0.3},${dy*0.5} ${dx*0.5},0 q${dx*0.2},${-dy*0.5} ${dx*0.5},0" fill="none" stroke="${color}" stroke-width="${sw*0.7}"/>`;
      return `<g opacity="${op/100}">
        <rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="${sw}"/>
        <rect x="${g+5}" y="${g+5}" width="${w-g*2-10}" height="${h-g*2-10}" fill="none" stroke="${color}" stroke-width="${sw*0.5}" opacity="0.5"/>
        ${scroll(g+10,g,30,-15)}${scroll(w-g-50,g,30,-15)}
        ${scroll(g+10,h-g,30,15)}${scroll(w-g-50,h-g,30,15)}
      </g>`;
    },
  },
  {
    id: 'classic-gold',
    label: 'Золото',
    group: 'Класичні',
    render: (w:number, h:number, color:string, op:number) => {
      const g=10, g2=16, g3=20;
      return `<g opacity="${op/100}">
        <rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="3"/>
        <rect x="${g2}" y="${g2}" width="${w-g2*2}" height="${h-g2*2}" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"/>
        <rect x="${g3}" y="${g3}" width="${w-g3*2}" height="${h-g3*2}" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.3"/>
        <circle cx="${g}" cy="${g}" r="4" fill="${color}"/><circle cx="${w-g}" cy="${g}" r="4" fill="${color}"/>
        <circle cx="${g}" cy="${h-g}" r="4" fill="${color}"/><circle cx="${w-g}" cy="${h-g}" r="4" fill="${color}"/>
      </g>`;
    },
  },
  {
    id: 'classic-filigree',
    label: 'Філігрань',
    group: 'Класичні',
    render: (w:number, h:number, color:string, op:number) => {
      const g=14;
      const curl = (cx:number, cy:number, r:number) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="1.2"/>
         <circle cx="${cx}" cy="${cy}" r="${r*0.5}" fill="none" stroke="${color}" stroke-width="0.8"/>`;
      return `<g opacity="${op/100}">
        <rect x="${g}" y="${g}" width="${w-g*2}" height="${h-g*2}" fill="none" stroke="${color}" stroke-width="1.5"/>
        ${curl(g,g,8)}${curl(w-g,g,8)}${curl(g,h-g,8)}${curl(w-g,h-g,8)}
        ${curl(w/2,g,6)}${curl(w/2,h-g,6)}${curl(g,h/2,6)}${curl(w-g,h/2,6)}
      </g>`;
    },
  },

  // ── Весільні ──
  {
    id: 'wedding-hearts',
    label: 'Серця',
    group: 'Весільні',
    render: (w:number, h:number, color:string, op:number) => {
      const heart = (x:number, y:number, s:number) =>
        `<path d="M${x},${y+s*0.3} C${x-s*0.5},${y-s*0.3} ${x-s},${y+s*0.1} ${x},${y+s} C${x+s},${y+s*0.1} ${x+s*0.5},${y-s*0.3} ${x},${y+s*0.3}Z" fill="${color}" opacity="0.5"/>`;
      return `<g opacity="${op/100}">
        <rect x="16" y="16" width="${w-32}" height="${h-32}" fill="none" stroke="${color}" stroke-width="1" opacity="0.3"/>
        ${heart(w/2,8,8)}${heart(w/2,h-18,8)}
        ${heart(10,h/2-4,7)}${heart(w-10,h/2-4,7)}
        ${heart(20,14,5)}${heart(w-20,14,5)}${heart(20,h-20,5)}${heart(w-20,h-20,5)}
      </g>`;
    },
  },
  {
    id: 'wedding-elegant',
    label: 'Елегант',
    group: 'Весільні',
    render: (w:number, h:number, color:string, op:number) => {
      const g=14;
      return `<g stroke="${color}" fill="none" opacity="${op/100}">
        <path d="M${g+20},${g} L${g},${g} L${g},${g+20}" stroke-width="2.5"/>
        <path d="M${w-g-20},${g} L${w-g},${g} L${w-g},${g+20}" stroke-width="2.5"/>
        <path d="M${g},${h-g-20} L${g},${h-g} L${g+20},${h-g}" stroke-width="2.5"/>
        <path d="M${w-g},${h-g-20} L${w-g},${h-g} L${w-g-20},${h-g}" stroke-width="2.5"/>
        <line x1="${w*0.3}" y1="${g}" x2="${w*0.7}" y2="${g}" stroke-width="1" opacity="0.4"/>
        <line x1="${w*0.3}" y1="${h-g}" x2="${w*0.7}" y2="${h-g}" stroke-width="1" opacity="0.4"/>
        <circle cx="${w/2}" cy="${g}" r="2" fill="${color}"/>
        <circle cx="${w/2}" cy="${h-g}" r="2" fill="${color}"/>
      </g>`;
    },
  },
  {
    id: 'wedding-ribbon',
    label: 'Стрічка',
    group: 'Весільні',
    render: (w:number, h:number, color:string, op:number) => {
      const g=10;
      return `<g stroke="${color}" fill="none" opacity="${op/100}">
        <path d="M${g},${g+6} Q${w*0.25},${g-2} ${w*0.5},${g+6} Q${w*0.75},${g+14} ${w-g},${g+6}" stroke-width="2"/>
        <path d="M${g},${h-g-6} Q${w*0.25},${h-g+2} ${w*0.5},${h-g-6} Q${w*0.75},${h-g-14} ${w-g},${h-g-6}" stroke-width="2"/>
        <line x1="${g}" y1="${g+6}" x2="${g}" y2="${h-g-6}" stroke-width="1" opacity="0.4"/>
        <line x1="${w-g}" y1="${g+6}" x2="${w-g}" y2="${h-g-6}" stroke-width="1" opacity="0.4"/>
      </g>`;
    },
  },

  // ── Дитячі ──
  {
    id: 'kids-stars',
    label: 'Зірки',
    group: 'Дитячі',
    render: (w:number, h:number, color:string, op:number) => {
      const star = (cx:number, cy:number, r:number) => {
        const pts: string[] = [];
        for (let i=0;i<10;i++) {
          const a=(i*36-90)*Math.PI/180;
          const ri=i%2===0?r:r*0.4;
          pts.push(`${cx+Math.cos(a)*ri},${cy+Math.sin(a)*ri}`);
        }
        return `<polygon points="${pts.join(' ')}" fill="${color}" opacity="0.5"/>`;
      };
      return `<g opacity="${op/100}">
        ${star(14,14,10)}${star(w-14,14,10)}${star(14,h-14,10)}${star(w-14,h-14,10)}
        ${star(w/2,10,7)}${star(w/2,h-10,7)}${star(10,h/2,7)}${star(w-10,h/2,7)}
        ${star(w*0.25,10,5)}${star(w*0.75,10,5)}${star(w*0.25,h-10,5)}${star(w*0.75,h-10,5)}
        <rect x="18" y="18" width="${w-36}" height="${h-36}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.3"/>
      </g>`;
    },
  },
  {
    id: 'kids-clouds',
    label: 'Хмаринки',
    group: 'Дитячі',
    render: (w:number, h:number, color:string, op:number) => {
      const cloud = (x:number, y:number, s:number) =>
        `<g fill="${color}" opacity="0.35"><circle cx="${x}" cy="${y}" r="${s*3}"/><circle cx="${x-s*2.5}" cy="${y+s*0.5}" r="${s*2}"/><circle cx="${x+s*2.5}" cy="${y+s*0.5}" r="${s*2.2}"/><circle cx="${x-s*1}" cy="${y-s*1.5}" r="${s*1.8}"/><circle cx="${x+s*1.5}" cy="${y-s*1.2}" r="${s*2}"/></g>`;
      return `<g opacity="${op/100}">
        ${cloud(w*0.2,14,3)}${cloud(w*0.7,14,3.5)}
        ${cloud(w*0.15,h-14,3)}${cloud(w*0.8,h-14,2.5)}
      </g>`;
    },
  },
  {
    id: 'kids-rainbow',
    label: 'Веселка',
    group: 'Дитячі',
    render: (w:number, h:number, color:string, op:number) => {
      const g=14;
      const arcs: string[] = [];
      const colors = [color]; // single color with varying opacity
      for (let i=0;i<5;i++) {
        const r=12+i*3;
        arcs.push(`<path d="M${g+r},${g} A${r},${r} 0 0,0 ${g},${g+r}" fill="none" stroke="${color}" stroke-width="2" opacity="${(0.8-i*0.12)*op/100}"/>`);
        arcs.push(`<path d="M${w-g-r},${g} A${r},${r} 0 0,1 ${w-g},${g+r}" fill="none" stroke="${color}" stroke-width="2" opacity="${(0.8-i*0.12)*op/100}"/>`);
        arcs.push(`<path d="M${g},${h-g-r} A${r},${r} 0 0,0 ${g+r},${h-g}" fill="none" stroke="${color}" stroke-width="2" opacity="${(0.8-i*0.12)*op/100}"/>`);
        arcs.push(`<path d="M${w-g},${h-g-r} A${r},${r} 0 0,1 ${w-g-r},${h-g}" fill="none" stroke="${color}" stroke-width="2" opacity="${(0.8-i*0.12)*op/100}"/>`);
      }
      return `<g>${arcs.join('')}</g>`;
    },
  },
  {
    id: 'kids-bubbles',
    label: 'Бульбашки',
    group: 'Дитячі',
    render: (w:number, h:number, color:string, op:number) => {
      const bubbles: string[] = [];
      const positions = [[12,12,6],[w-15,10,5],[10,h-12,7],[w-12,h-15,5],[w/2,8,4],[8,h/2,5],[w-8,h/3,4],[w/4,h-8,5],[w*0.7,h-10,6],[w-10,h/2,4],[w*0.4,10,3],[12,h*0.3,4]];
      positions.forEach(([x,y,r]) => {
        bubbles.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="1.5" opacity="${0.4*op/100}"/>`);
        bubbles.push(`<circle cx="${x-r*0.3}" cy="${y-r*0.3}" r="${r*0.2}" fill="${color}" opacity="${0.3*op/100}"/>`);
      });
      return `<g>${bubbles.join('')}</g>`;
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

  // PNG frame
  const pngDef = PNG_FRAMES.find(f => f.id === frame.frameId);
  if (pngDef) {
    return (
      <div style={{ position:'absolute', inset:0, zIndex:35, pointerEvents:'none' }}>
        <img
          src={pngDef.src}
          alt=""
          style={{
            position:'absolute', inset:0,
            width:'100%', height:'100%',
            objectFit:'cover',
            opacity: frame.opacity / 100,
          }}
        />
      </div>
    );
  }

  // SVG frame
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
      {/* Active frame controls — ALWAYS visible at top */}
      {frame.frameId && (
        <div style={{ background:'#f0f3ff', borderRadius:10, padding:10, border:'1px solid #c7d2fe' }}>
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
                <button key={f.id} onClick={() => onChange({ ...frame, frameId: active ? null : f.id })}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 4px', border: active?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background: active?'#f0f3ff':'#fff', cursor:'pointer' }}>
                  <div style={{ width:thumbW, height:thumbH, position:'relative', overflow:'hidden', borderRadius:4, background:'#f8fafc' }}>
                    <img src={f.src} alt={f.label}
                      style={{ width:'100%', height:'100%', objectFit:'cover' }} />
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
                <button key={f.id} onClick={() => onChange({ ...frame, frameId: active ? null : f.id })}
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
