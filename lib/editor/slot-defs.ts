import * as React from 'react';

export interface SlotDef {
  i: number;
  s: React.CSSProperties;
}

// Slots can carry a manual resize override (free-resize handles in the editor).
// New overrides are stored as PERCENT of the slot's container (customPct === true)
// so they resolve to identical geometry at any resolution — the editor canvas,
// the preview modal, and the html2canvas print snapshot all agree. Legacy
// overrides (no customPct flag) were stored as raw px against the editor canvas
// size; we pass those through unchanged so existing drafts render exactly as
// before. resolveCustomSlot is the single place that interprets either form.
export interface CustomSlotGeom {
  customX?: number; customY?: number; customW?: number; customH?: number;
  customPct?: boolean;
}

export function resolveCustomSlot(
  slot: CustomSlotGeom | null | undefined,
  W: number,
  H: number,
): { left: number; top: number; width: number; height: number } | null {
  if (!slot || slot.customX === undefined || slot.customY === undefined
      || slot.customW === undefined || slot.customH === undefined) return null;
  if (slot.customPct) {
    return {
      left: (slot.customX / 100) * W,
      top: (slot.customY / 100) * H,
      width: (slot.customW / 100) * W,
      height: (slot.customH / 100) * H,
    };
  }
  // Legacy px override — render as authored (no reference dims to scale by).
  return { left: slot.customX, top: slot.customY, width: slot.customW, height: slot.customH };
}

// SINGLE SOURCE OF TRUTH for photo-slot geometry.
// This file is the SINGLE SOURCE OF TRUTH for photo-slot geometry. The editor
// canvas (BookLayoutEditor), the preview modal, LayoutSVG, and the print
// renderer all import getSlotDefs from here — so preview == editor == print by
// construction. Do NOT re-implement this math anywhere else; if a layout needs
// changing, change it here only.
export function getSlotDefs(layout: string, W: number, H: number, gap: number = 4): SlotDef[] {
  const g = gap;
  const w2 = (W - g) / 2, h2 = (H - g) / 2;
  const w3 = (W - 2 * g) / 3, h3 = (H - 2 * g) / 3;
  const w4 = (W - 3 * g) / 4, h4 = (H - 3 * g) / 4;
  // Rounded corners look good WITH a gap, but at gap=0 they leave tiny white
  // notches between touching photos — defeating "без білих ліній між фото".
  // Square the corners when the layout is gapless.
  const b: React.CSSProperties = { position: 'absolute', overflow: 'hidden', borderRadius: gap > 0 ? 3 : 0 };

  const S = (i: number, x: number, y: number, w: number, h: number, extra?: React.CSSProperties) =>
    ({ i, s: { ...b, left: x, top: y, width: w, height: h, ...extra } });

  if (layout === 'p-full')        return [S(0, 0, 0, W, H)];
  if (layout === 'p-center')      return [S(0, W*0.08, H*0.08, W*0.84, H*0.84)];
  if (layout === 'p-top')         return [S(0, 0, 0, W, H*0.65)];
  if (layout === 'p-bottom')      return [S(0, 0, H*0.35, W, H*0.65)];
  if (layout === 'p-left')        return [S(0, 0, 0, W*0.65, H)];
  if (layout === 'p-right')       return [S(0, W*0.35, 0, W*0.65, H)];

  if (layout === 'p-2-v')         return [S(0, 0, 0, w2, H), S(1, w2+g, 0, w2, H)];
  if (layout === 'p-2-h')         return [S(0, 0, 0, W, h2), S(1, 0, h2+g, W, h2)];
  if (layout === 'p-2-big-top')   return [S(0, 0, 0, W, H*0.65), S(1, 0, H*0.65+g, W, H*0.35-g)];
  if (layout === 'p-2-big-bottom') return [S(0, 0, 0, W, H*0.35), S(1, 0, H*0.35+g, W, H*0.65-g)];
  if (layout === 'p-2-big-left')  return [S(0, 0, 0, W*0.65, H), S(1, W*0.65+g, 0, W*0.35-g, H)];
  if (layout === 'p-2-big-right') return [S(0, 0, 0, W*0.35, H), S(1, W*0.35+g, 0, W*0.65-g, H)];
  if (layout === 'p-2-diag')      return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.4, H*0.4, W*0.6, H*0.6)];

  if (layout === 'p-3-row')       return [S(0,0,0,w3,H), S(1,w3+g,0,w3,H), S(2,(w3+g)*2,0,w3,H)];
  if (layout === 'p-3-col')       return [S(0,0,0,W,h3), S(1,0,h3+g,W,h3), S(2,0,(h3+g)*2,W,h3)];
  if (layout === 'p-3-top2')      return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,W,h2)];
  if (layout === 'p-3-bot2')      return [S(0,0,0,W,h2), S(1,0,h2+g,w2,h2), S(2,w2+g,h2+g,w2,h2)];
  if (layout === 'p-3-left2')     return [S(0,0,0,w2,h2), S(1,0,h2+g,w2,h2), S(2,w2+g,0,w2,H)];
  if (layout === 'p-3-right2')    return [S(0,0,0,w2,H), S(1,w2+g,0,w2,h2), S(2,w2+g,h2+g,w2,h2)];
  if (layout === 'p-3-hero-top')  return [S(0,0,0,W,H*0.55), S(1,0,H*0.55+g,w2,H*0.45-g), S(2,w2+g,H*0.55+g,w2,H*0.45-g)];
  if (layout === 'p-3-hero-left') return [S(0,0,0,W*0.55,H), S(1,W*0.55+g,0,W*0.45-g,h2), S(2,W*0.55+g,h2+g,W*0.45-g,h2)];

  if (layout === 'p-4-grid')      return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,w2,h2), S(3,w2+g,h2+g,w2,h2)];
  if (layout === 'p-4-hero-top')  { const bh=H*0.55, sh=H-bh-g; return [S(0,0,0,W,bh), S(1,0,bh+g,w3,sh), S(2,w3+g,bh+g,w3,sh), S(3,(w3+g)*2,bh+g,w3,sh)]; }
  if (layout === 'p-4-hero-left') { const bw=W*0.55, sw=W-bw-g; const sh=(H-2*g)/3; return [S(0,0,0,bw,H), S(1,bw+g,0,sw,sh), S(2,bw+g,sh+g,sw,sh), S(3,bw+g,(sh+g)*2,sw,sh)]; }
  if (layout === 'p-4-strip-h')   return [S(0,0,0,W,h4), S(1,0,h4+g,W,h4), S(2,0,(h4+g)*2,W,h4), S(3,0,(h4+g)*3,W,h4)];
  if (layout === 'p-4-strip-v')   return [S(0,0,0,w4,H), S(1,w4+g,0,w4,H), S(2,(w4+g)*2,0,w4,H), S(3,(w4+g)*3,0,w4,H)];
  if (layout === 'p-4-l-shape')   { const bw=W*0.6, sh=(H-g)/2; return [S(0,0,0,bw,H), S(1,bw+g,0,W-bw-g,sh), S(2,bw+g,sh+g,W-bw-g,sh), S(3,0,H-H*0.25,bw,H*0.25)]; }

  if (layout === 'p-5-hero')      { const bh=H*0.55; const sw=(W-2*g)/4; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3].map(i=>S(i+1,i*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'p-5-grid')      return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,w3,h2), S(3,w3+g,h2+g,w3,h2), S(4,(w3+g)*2,h2+g,w3,h2)];
  if (layout === 'p-5-strip')     { const bh=H*0.55; const sw=(W-3*g)/4; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3].map(i=>S(i+1,i*(sw+g),bh+g,sw,sh))]; }

  if (layout === 'p-6-grid')      return [[0,1].flatMap(col=>[0,1,2].map(row=>S(col*3+row, col*(w2+g), row*(h3+g), w2, h3)))].flat();
  if (layout === 'p-6-3x2')       return [[0,1,2].flatMap(col=>[0,1].map(row=>S(col*2+row, col*(w3+g), row*(h2+g), w3, h2)))].flat();
  if (layout === 'p-6-hero')      { const bh=H*0.5; const sw=(W-2*g)/3; const sh2=(H-bh-g-g)/2; return [S(0,0,0,W*0.5,bh), S(1,W*0.5+g,0,W*0.5-g,bh), ...[0,1,2].map(i=>S(i+2,i*(sw+g),bh+g,sw,sh2)), ...[0,1,2].map(i=>S(i+5,i*(sw+g),bh+g+sh2+g,sw,sh2))]; }

  if (layout === 'p-7-grid')      { const sw=(W-2*g)/3, sh=(H-2*g)/3; return [[0,1,2].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(sw+g),row*(sh+g),sw,sh))).concat(S(6,0,(sh+g)*2,W,sh))].flat(); }
  if (layout === 'p-8-grid')      return [[0,1,2,3].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(w4+g),row*(h2+g),w4,h2)))].flat();
  if (layout === 'p-9-grid')      return [[0,1,2].flatMap(col=>[0,1,2].map(row=>S(col*3+row,col*(w3+g),row*(h3+g),w3,h3)))].flat();

  if (layout === 'p-text')        return [];
  if (layout === 'p-text-top')    return [S(0, 0, 0, W, H*0.65)];
  if (layout === 'p-text-bottom') return [S(0, 0, H*0.35, W, H*0.65)];

  // SPREAD layouts (W = full spread width = 2 pages)
  if (layout === 'sp-full')        return [S(0, 0, 0, W, H)];
  if (layout === 'sp-1-left')      return [S(0, 0, 0, W*0.5, H)];
  if (layout === 'sp-1-right')     return [S(0, W*0.5, 0, W*0.5, H)];
  if (layout === 'sp-1-center')    return [S(0, W*0.15, H*0.1, W*0.7, H*0.8)];
  if (layout === 'sp-1-left-wide') return [S(0, 0, 0, W*0.65, H)];
  if (layout === 'sp-1-right-wide')return [S(0, W*0.35, 0, W*0.65, H)];
  if (layout === 'sp-2-v')         return [S(0, 0, 0, w2, H), S(1, w2+g, 0, w2, H)];
  if (layout === 'sp-2-h')         return [S(0, 0, 0, W, h2), S(1, 0, h2+g, W, h2)];
  if (layout === 'sp-2-big-left')  return [S(0, 0, 0, W*0.65, H), S(1, W*0.65+g, 0, W*0.35-g, H)];
  if (layout === 'sp-2-big-right') return [S(0, 0, 0, W*0.35, H), S(1, W*0.35+g, 0, W*0.65-g, H)];
  if (layout === 'sp-2-big-top')   return [S(0, 0, 0, W, H*0.65), S(1, 0, H*0.65+g, W, H*0.35-g)];
  if (layout === 'sp-2-big-bottom')return [S(0, 0, 0, W, H*0.35), S(1, 0, H*0.35+g, W, H*0.65-g)];
  if (layout === 'sp-2-left-pair') return [S(0, 0, 0, w2, h2), S(1, 0, h2+g, w2, h2)];
  if (layout === 'sp-2-right-pair')return [S(0, w2+g, 0, w2, h2), S(1, w2+g, h2+g, w2, h2)];
  if (layout === 'sp-2-diag')      return [S(0, 0, 0, W*0.55, H*0.55), S(1, W*0.45+g, H*0.45+g, W*0.55-g, H*0.55-g)];
  if (layout === 'sp-3-row')       return [S(0, 0, 0, w3, H), S(1, w3+g, 0, w3, H), S(2, 2*(w3+g), 0, w3, H)];
  if (layout === 'sp-3-hero-left') return [S(0, 0, 0, W*0.55, H), S(1, W*0.55+g, 0, W*0.45-g, h2), S(2, W*0.55+g, h2+g, W*0.45-g, h2)];
  if (layout === 'sp-3-hero-right')return [S(0, 0, 0, W*0.45, h2), S(1, 0, h2+g, W*0.45, h2), S(2, W*0.45+g, 0, W*0.55-g, H)];
  if (layout === 'sp-3-col')       return [S(0, 0, 0, W, h3), S(1, 0, h3+g, W, h3), S(2, 0, 2*(h3+g), W, h3)];
  if (layout === 'sp-3-hero-top')  return [S(0, 0, 0, W, H*0.55), S(1, 0, H*0.55+g, w2, H*0.45-g), S(2, w2+g, H*0.55+g, w2, H*0.45-g)];
  if (layout === 'sp-3-hero-bottom')return [S(0, 0, 0, w2, H*0.45), S(1, w2+g, 0, w2, H*0.45), S(2, 0, H*0.45+g, W, H*0.55-g)];
  if (layout === 'sp-3-l-shape')   return [S(0, 0, 0, W*0.55, h2), S(1, 0, h2+g, W*0.55, h2), S(2, W*0.55+g, 0, W*0.45-g, H)];
  if (layout === 'sp-3-t-shape')   return [S(0, 0, 0, w2, H*0.45), S(1, w2+g, 0, w2, H*0.45), S(2, W*0.25, H*0.45+g, W*0.5, H*0.55-g)];
  if (layout === 'sp-3-center')    return [S(0, 0, 0, W*0.3, H), S(1, W*0.3+g, 0, W*0.4-2*g, H), S(2, W*0.7, 0, W*0.3, H)];
  if (layout === 'sp-4-grid')      return [S(0, 0, 0, w2, h2), S(1, w2+g, 0, w2, h2), S(2, 0, h2+g, w2, h2), S(3, w2+g, h2+g, w2, h2)];
  if (layout === 'sp-4-hero')      return [S(0, 0, 0, W*0.55, H), S(1, W*0.55+g, 0, W*0.45-g, h3), S(2, W*0.55+g, h3+g, W*0.45-g, h3), S(3, W*0.55+g, 2*(h3+g), W*0.45-g, h3)];
  if (layout === 'sp-4-hero-right')return [S(0, 0, 0, W*0.45-g, h3), S(1, 0, h3+g, W*0.45-g, h3), S(2, 0, 2*(h3+g), W*0.45-g, h3), S(3, W*0.45, 0, W*0.55, H)];
  if (layout === 'sp-4-top-bottom')return [S(0, 0, 0, w2, h2), S(1, w2+g, 0, w2, h2), S(2, 0, h2+g, w2, h2), S(3, w2+g, h2+g, w2, h2)];
  if (layout === 'sp-4-strip-h')   return [S(0, 0, 0, W, h4), S(1, 0, h4+g, W, h4), S(2, 0, 2*(h4+g), W, h4), S(3, 0, 3*(h4+g), W, h4)];
  if (layout === 'sp-4-strip-v')   { const w4=(W-3*g)/4; return [S(0, 0, 0, w4, H), S(1, w4+g, 0, w4, H), S(2, 2*(w4+g), 0, w4, H), S(3, 3*(w4+g), 0, w4, H)]; }
  if (layout === 'sp-4-mosaic')    return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.6+g, 0, W*0.4-g, H*0.4), S(2, W*0.6+g, H*0.4+g, W*0.4-g, H*0.6-g), S(3, 0, H*0.6+g, W*0.6, H*0.4-g)];
  if (layout === 'sp-4-hero-top')  return [S(0, 0, 0, W, H*0.55), S(1, 0, H*0.55+g, w3, H*0.45-g), S(2, w3+g, H*0.55+g, w3, H*0.45-g), S(3, 2*(w3+g), H*0.55+g, w3, H*0.45-g)];
  if (layout === 'sp-4-hero-bottom')return [S(0, 0, 0, w3, H*0.45), S(1, w3+g, 0, w3, H*0.45), S(2, 2*(w3+g), 0, w3, H*0.45), S(3, 0, H*0.45+g, W, H*0.55-g)];
  if (layout === 'sp-5-grid')      return [S(0, 0, 0, w3, h2), S(1, w3+g, 0, w3, h2), S(2, 2*(w3+g), 0, w3, h2), S(3, 0, h2+g, w2, h2), S(4, w2+g, h2+g, w2, h2)];
  if (layout === 'sp-5-hero')      { const bh=H*0.55; const sw=(W-3*g)/4; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3].map(ii=>S(ii+1,ii*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'sp-5-quilt')     return [S(0, 0, 0, w2, h2), S(1, w2+g, 0, w2, h2), S(2, 0, h2+g, w3, h2), S(3, w3+g, h2+g, w3, h2), S(4, 2*(w3+g), h2+g, w3, h2)];
  if (layout === 'sp-5-strip')     { const w5=(W-4*g)/5; return [S(0,0,0,w5,H),S(1,w5+g,0,w5,H),S(2,2*(w5+g),0,w5,H),S(3,3*(w5+g),0,w5,H),S(4,4*(w5+g),0,w5,H)]; }
  if (layout === 'sp-6-grid')      return [S(0, 0, 0, w3, h2), S(1, w3+g, 0, w3, h2), S(2, 2*(w3+g), 0, w3, h2), S(3, 0, h2+g, w3, h2), S(4, w3+g, h2+g, w3, h2), S(5, 2*(w3+g), h2+g, w3, h2)];
  if (layout === 'sp-6-hero')      { const bh=H*0.55; const sw=(W-4*g)/5; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3,4].map(ii=>S(ii+1,ii*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'sp-6-mosaic')    return [S(0,0,0,W*0.4,h3), S(1,0,h3+g,W*0.4,h3), S(2,0,2*(h3+g),W*0.4,h3), S(3,W*0.4+g,0,W*0.6-g,h3), S(4,W*0.4+g,h3+g,W*0.3-g,2*h3+g), S(5,W*0.7,h3+g,W*0.3,2*h3+g)];
  if (layout === 'sp-7-grid')      { const w47=(W-3*g)/4; return [S(0,0,0,w47,h2),S(1,w47+g,0,w47,h2),S(2,2*(w47+g),0,w47,h2),S(3,3*(w47+g),0,w47,h2),S(4,0,h2+g,w3,h2),S(5,w3+g,h2+g,w3,h2),S(6,2*(w3+g),h2+g,w3,h2)]; }
  if (layout === 'sp-7-hero')      { const bh=H*0.45; const sw=(W-5*g)/6; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3,4,5].map(ii=>S(ii+1,ii*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'sp-8-grid')      { const w48=(W-3*g)/4; return [S(0,0,0,w48,h2),S(1,w48+g,0,w48,h2),S(2,2*(w48+g),0,w48,h2),S(3,3*(w48+g),0,w48,h2),S(4,0,h2+g,w48,h2),S(5,w48+g,h2+g,w48,h2),S(6,2*(w48+g),h2+g,w48,h2),S(7,3*(w48+g),h2+g,w48,h2)]; }
  if (layout === 'sp-8-mosaic')    { const w6=(W-2*g)/3; return [S(0,0,0,w6,h2),S(1,w6+g,0,w6,h2),S(2,2*(w6+g),0,w6,h2), S(3,0,h2+g,w2,h2),S(4,w2+g,h2+g,(W-4*g)/5,h2),S(5,w2+g+(W-4*g)/5+g,h2+g,(W-4*g)/5,h2),S(6,w2+g+2*((W-4*g)/5+g),h2+g,(W-4*g)/5,h2),S(7,w2+g+3*((W-4*g)/5+g),h2+g,(W-4*g)/5,h2)]; }
  if (layout === 'sp-9-grid')      { const w39=(W-2*g)/3; const h39=(H-2*g)/3; return Array.from({length:9},(_, ii)=>S(ii, (ii%3)*(w39+g), Math.floor(ii/3)*(h39+g), w39, h39)); }
  if (layout === 'sp-10-grid')     { const w510=(W-4*g)/5; return Array.from({length:10},(_, ii)=>S(ii, (ii%5)*(w510+g), Math.floor(ii/5)*(h2+g), w510, h2)); }
  if (layout === 'sp-10-hero')     { const bh=H*0.45; const sw=(W-8*g)/9; const sh=H-bh-g; return [S(0,0,0,W,bh), ...Array.from({length:9},(_,ii)=>S(ii+1,ii*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'sp-12-grid')     { const w412=(W-3*g)/4; const h312=(H-2*g)/3; return Array.from({length:12},(_, ii)=>S(ii, (ii%4)*(w412+g), Math.floor(ii/4)*(h312+g), w412, h312)); }
  if (layout === 'sp-1-top-strip') return [S(0, 0, 0, W, H*0.4)];
  if (layout === 'sp-1-bottom-strip')return [S(0, 0, H*0.6, W, H*0.4)];
  if (layout === 'sp-2-75-25')     return [S(0, 0, 0, W*0.75, H), S(1, W*0.75+g, 0, W*0.25-g, H)];
  if (layout === 'sp-2-25-75')     return [S(0, 0, 0, W*0.25, H), S(1, W*0.25+g, 0, W*0.75-g, H)];
  if (layout === 'sp-2-cross')     return [S(0, 0, H*0.15, W*0.55, H*0.7), S(1, W*0.45+g, 0, W*0.55-g, H*0.7)];
  if (layout === 'sp-3-uneven')    return [S(0, 0, 0, W*0.6, H), S(1, W*0.6+g, 0, W*0.4-g, H*0.5-g/2), S(2, W*0.6+g, H*0.5+g/2, W*0.4-g, H*0.5-g/2)];
  if (layout === 'sp-3-steps')     return [S(0, 0, 0, w3, H*0.7), S(1, w3+g, H*0.15, w3, H*0.7), S(2, 2*(w3+g), H*0.3, w3, H*0.7)];
  if (layout === 'sp-3-panorama')  return [S(0, 0, 0, W, H*0.55), S(1, 0, H*0.55+g, w2, H*0.45-g), S(2, w2+g, H*0.55+g, w2, H*0.45-g)];
  if (layout === 'sp-4-focus')     return [S(0, 0, 0, W*0.65, H*0.65), S(1, W*0.65+g, 0, W*0.35-g, H*0.45), S(2, W*0.65+g, H*0.45+g, W*0.35-g, H*0.55-g), S(3, 0, H*0.65+g, W*0.65, H*0.35-g)];
  if (layout === 'sp-4-corner')    return [S(0, 0, 0, W*0.48, H*0.48), S(1, W*0.52, 0, W*0.48, H*0.48), S(2, 0, H*0.52, W*0.48, H*0.48), S(3, W*0.52, H*0.52, W*0.48, H*0.48)];
  if (layout === 'sp-4-cinema')    { const ch=H*0.5; const cw=(W-3*g)/4; return [S(0,0,(H-ch)/2,cw,ch),S(1,cw+g,(H-ch)/2,cw,ch),S(2,2*(cw+g),(H-ch)/2,cw,ch),S(3,3*(cw+g),(H-ch)/2,cw,ch)]; }
  if (layout === 'sp-5-focus')     return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.6+g, 0, W*0.4-g, H*0.3-g/2), S(2, W*0.6+g, H*0.3+g/2, W*0.4-g, H*0.3-g/2), S(3, 0, H*0.6+g, W*0.3-g/2, H*0.4-g), S(4, W*0.3+g/2, H*0.6+g, W*0.7-g/2, H*0.4-g)];
  if (layout === 'sp-6-cols')      { const cw=(W-g)/2; const ch=(H-2*g)/3; return [S(0,0,0,cw,ch),S(1,cw+g,0,cw,ch),S(2,0,ch+g,cw,ch),S(3,cw+g,ch+g,cw,ch),S(4,0,2*(ch+g),cw,ch),S(5,cw+g,2*(ch+g),cw,ch)]; }
  if (layout === 'sp-9-hero')      { const bh=H*0.4; const sw=(W-3*g)/4; const sh=(H-bh-2*g)/2; return [S(0,0,0,W,bh), ...Array.from({length:8},(_,ii)=>S(ii+1,(ii%4)*(sw+g),bh+g+Math.floor(ii/4)*(sh+g),sw,sh))]; }
  if (layout === 'sp-15-grid')     { const cw=(W-4*g)/5; const ch=(H-2*g)/3; return Array.from({length:15},(_,ii)=>S(ii,(ii%5)*(cw+g),Math.floor(ii/5)*(ch+g),cw,ch)); }
  if (layout === 'sp-16-grid')     { const cw=(W-3*g)/4; const ch=(H-3*g)/4; return Array.from({length:16},(_,ii)=>S(ii,(ii%4)*(cw+g),Math.floor(ii/4)*(ch+g),cw,ch)); }

  //  PAGE: 1 фото додаткові 
  if (layout === 'p-1-top-strip')    return [S(0, 0, 0, W, H*0.45)];
  if (layout === 'p-1-bottom-strip') return [S(0, 0, H*0.55, W, H*0.45)];
  if (layout === 'p-1-left-wide')    return [S(0, 0, 0, W*0.75, H)];
  if (layout === 'p-1-right-wide')   return [S(0, W*0.25, 0, W*0.75, H)];
  if (layout === 'p-1-polaroid')     return [S(0, W*0.06, H*0.06, W*0.88, H*0.75)];
  if (layout === 'p-1-portrait')     return [S(0, W*0.15, H*0.05, W*0.7, H*0.9)];
  if (layout === 'p-1-landscape')    return [S(0, W*0.03, H*0.15, W*0.94, H*0.7)];
  if (layout === 'p-1-corner-tl')    return [S(0, 0, 0, W*0.75, H*0.75)];
  if (layout === 'p-1-corner-br')    return [S(0, W*0.25, H*0.25, W*0.75, H*0.75)];

  //  PAGE: 2 фото додаткові 
  if (layout === 'p-2-overlap')      return [S(0, 0, 0, W*0.75, H*0.75), S(1, W*0.25, H*0.25, W*0.75, H*0.75)];
  if (layout === 'p-2-top-strip')    return [S(0, 0, 0, W, H*0.3), S(1, 0, H*0.3+g, W, H*0.7-g)];
  if (layout === 'p-2-bottom-strip') return [S(0, 0, 0, W, H*0.7), S(1, 0, H*0.7+g, W, H*0.3-g)];
  if (layout === 'p-2-75-25')        return [S(0, 0, 0, W*0.75, H), S(1, W*0.75+g, 0, W*0.25-g, H)];
  if (layout === 'p-2-25-75')        return [S(0, 0, 0, W*0.25, H), S(1, W*0.25+g, 0, W*0.75-g, H)];
  if (layout === 'p-2-center-pair')  return [S(0, W*0.05, H*0.05, W*0.9, h2*0.9), S(1, W*0.05, H*0.5+g, W*0.9, h2*0.9)];
  if (layout === 'p-2-cinema')       { const ch=H*0.42; return [S(0, 0, (H-2*ch-g)/2, W, ch), S(1, 0, (H-2*ch-g)/2+ch+g, W, ch)]; }
  if (layout === 'p-2-frame')        return [S(0, W*0.04, H*0.04, W*0.92, h2-H*0.02), S(1, W*0.04, H*0.5+H*0.02, W*0.92, h2-H*0.04)];

  //  PAGE: 3 фото додаткові 
  if (layout === 'p-3-hero-right')   return [S(0, W*0.45+g, 0, W*0.55-g, H), S(1, 0, 0, W*0.45, h2), S(2, 0, h2+g, W*0.45, h2)];
  if (layout === 'p-3-strip-top')    return [S(0, 0, 0, W, H*0.35), S(1, 0, H*0.35+g, w2, H*0.65-g), S(2, w2+g, H*0.35+g, w2, H*0.65-g)];
  if (layout === 'p-3-strip-bot')    return [S(0, 0, 0, w2, H*0.65), S(1, w2+g, 0, w2, H*0.65), S(2, 0, H*0.65+g, W, H*0.35-g)];
  if (layout === 'p-3-diagonal')     return [S(0, 0, 0, W*0.6, H*0.5), S(1, W*0.4, H*0.25, W*0.6, H*0.5), S(2, 0, H*0.5+g, W*0.6, H*0.5-g)];
  if (layout === 'p-3-mosaic')       return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.6+g, 0, W*0.4-g, H*0.4-g/2), S(2, 0, H*0.6+g, W, H*0.4-g)];
  if (layout === 'p-3-featured')     return [S(0, W*0.1, H*0.05, W*0.8, H*0.55), S(1, 0, H*0.6+g, w2, H*0.4-g), S(2, w2+g, H*0.6+g, w2, H*0.4-g)];
  if (layout === 'p-3-panorama')     return [S(0, 0, 0, W, H*0.5), S(1, 0, H*0.5+g, w2, H*0.5-g), S(2, w2+g, H*0.5+g, w2, H*0.5-g)];

  //  PAGE: 4 фото додаткові 
  if (layout === 'p-4-mosaic')       return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.6+g, 0, W*0.4-g, H*0.4-g/2), S(2, W*0.6+g, H*0.4+g/2, W*0.4-g, H*0.6-g/2), S(3, 0, H*0.6+g, W*0.6, H*0.4-g)];
  if (layout === 'p-4-top-bottom')   return [S(0, 0, 0, w2, h2), S(1, w2+g, 0, w2, h2), S(2, 0, h2+g, w2, h2), S(3, w2+g, h2+g, w2, h2)];
  if (layout === 'p-4-corner')       return [S(0, 0, 0, W*0.48, H*0.48), S(1, W*0.52, 0, W*0.48, H*0.48), S(2, 0, H*0.52, W*0.48, H*0.48), S(3, W*0.52, H*0.52, W*0.48, H*0.48)];
  if (layout === 'p-4-cinema')       { const ch=H*0.45; const cw=(W-3*g)/4; return [S(0,0,(H-ch)/2,cw,ch),S(1,cw+g,(H-ch)/2,cw,ch),S(2,2*(cw+g),(H-ch)/2,cw,ch),S(3,3*(cw+g),(H-ch)/2,cw,ch)]; }
  if (layout === 'p-4-focus')        return [S(0, 0, 0, W*0.65, H*0.65), S(1, W*0.65+g, 0, W*0.35-g, H*0.42), S(2, W*0.65+g, H*0.42+g, W*0.35-g, H*0.58-g), S(3, 0, H*0.65+g, W*0.65, H*0.35-g)];
  if (layout === 'p-4-row-top')      return [S(0, 0, 0, w3, H*0.4), S(1, w3+g, 0, w3, H*0.4), S(2, 2*(w3+g), 0, w3, H*0.4), S(3, 0, H*0.4+g, W, H*0.6-g)];
  if (layout === 'p-4-hero-bottom')  return [S(0, 0, 0, w3, H*0.4), S(1, w3+g, 0, w3, H*0.4), S(2, 2*(w3+g), 0, w3, H*0.4), S(3, 0, H*0.4+g, W, H*0.6-g)];
  if (layout === 'p-4-cross')        return [S(0, 0, 0, w2, H*0.45), S(1, w2+g, 0, w2, H*0.45), S(2, 0, H*0.55, w2, H*0.45), S(3, w2+g, H*0.55, w2, H*0.45)];
  if (layout === 'p-4-uneven')       return [S(0, 0, 0, W*0.55, H), S(1, W*0.55+g, 0, W*0.45-g, h3), S(2, W*0.55+g, h3+g, W*0.45-g, h3), S(3, W*0.55+g, 2*(h3+g), W*0.45-g, h3)];

  //  PAGE: 5 фото 
  if (layout === 'p-5-col')         { const h5=(H-4*g)/5; return Array.from({length:5},(_,i)=>S(i,0,i*(h5+g),W,h5)); }
  if (layout === 'p-5-row')         { const w5=(W-4*g)/5; return Array.from({length:5},(_,i)=>S(i,i*(w5+g),0,w5,H)); }
  if (layout === 'p-5-2-3')        return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,w3,h2), S(3,w3+g,h2+g,w3,h2), S(4,2*(w3+g),h2+g,w3,h2)];
  if (layout === 'p-5-3-2')        return [S(0,0,0,w3,h2), S(1,w3+g,0,w3,h2), S(2,2*(w3+g),0,w3,h2), S(3,0,h2+g,w2,h2), S(4,w2+g,h2+g,w2,h2)];
  if (layout === 'p-5-mosaic')     return [S(0,0,0,W*0.55,H*0.55), S(1,W*0.55+g,0,W*0.45-g,H*0.3), S(2,W*0.55+g,H*0.3+g,W*0.45-g,H*0.25), S(3,0,H*0.55+g,W*0.3,H*0.45-g), S(4,W*0.3+g,H*0.55+g,W*0.7-g,H*0.45-g)];
  if (layout === 'p-5-focus')      return [S(0,0,0,W*0.6,H*0.6), S(1,W*0.6+g,0,W*0.4-g,h2), S(2,W*0.6+g,h2+g,W*0.4-g,h2), S(3,0,H*0.6+g,w2,H*0.4-g), S(4,w2+g,H*0.6+g,w2,H*0.4-g)];
  if (layout === 'p-5-big-left')   return [S(0,0,0,W*0.55,H), S(1,W*0.55+g,0,W*0.45-g,h2-g/2), S(2,W*0.55+g,h2+g/2,W*0.45-g,h2-g/2), S(3,0,H*0.55+g,W*0.25,H*0.45-g), S(4,W*0.25+g,H*0.55+g,W*0.3-g,H*0.45-g)];
  if (layout === 'p-5-big-right')  return [S(0,0,0,W*0.45-g,h2-g/2), S(1,0,h2+g/2,W*0.45-g,h2-g/2), S(2,W*0.45,0,W*0.55,H), S(3,0,H*0.55+g,W*0.25,H*0.45-g), S(4,W*0.25+g,H*0.55+g,W*0.2-g,H*0.45-g)];
  if (layout === 'p-5-cross')      return [S(0,W*0.3,0,W*0.4,H*0.3), S(1,0,H*0.35,W*0.3,H*0.3), S(2,W*0.35,H*0.35,W*0.3,H*0.3), S(3,W*0.7,H*0.35,W*0.3,H*0.3), S(4,W*0.3,H*0.7,W*0.4,H*0.3)];
  if (layout === 'p-5-panorama')   { const bh=H*0.35; const sw=(W-3*g)/4; return [S(0,0,0,W,bh), ...[0,1,2,3].map(i=>S(i+1,i*(sw+g),bh+g,sw,H-bh-g))]; }
  if (layout === 'p-5-diagonal')   return [S(0,0,0,W*0.5,H*0.5), S(1,W*0.5+g,0,W*0.5-g,H*0.35), S(2,W*0.5+g,H*0.35+g,W*0.5-g,H*0.65-g), S(3,0,H*0.5+g,W*0.35,H*0.5-g), S(4,W*0.35+g,H*0.5+g,W*0.65-g,H*0.5-g)];
  if (layout === 'p-5-corner')     return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,W*0.25,H*0.25,W*0.5,H*0.5), S(3,0,h2+g,w2,h2), S(4,w2+g,h2+g,w2,h2)];

  //  PAGE: 6 фото 
  if (layout === 'p-6-strip-h')    { const h6=(H-5*g)/6; return Array.from({length:6},(_,i)=>S(i,0,i*(h6+g),W,h6)); }
  if (layout === 'p-6-strip-v')    { const w6=(W-5*g)/6; return Array.from({length:6},(_,i)=>S(i,i*(w6+g),0,w6,H)); }
  if (layout === 'p-6-mosaic')     return [S(0,0,0,W*0.5,H*0.5), S(1,W*0.5+g,0,W*0.25-g/2,H*0.35), S(2,W*0.75+g/2,0,W*0.25-g/2,H*0.35), S(3,W*0.5+g,H*0.35+g,W*0.5-g,H*0.65-g), S(4,0,H*0.5+g,W*0.25-g/2,H*0.5-g), S(5,W*0.25+g/2,H*0.5+g,W*0.25-g/2,H*0.5-g)];
  if (layout === 'p-6-hero-top')   { const bh=H*0.45; const sw=(W-4*g)/5; return [S(0,0,0,W,bh), ...[0,1,2,3,4].map(i=>S(i+1,i*(sw+g),bh+g,sw,H-bh-g))]; }
  if (layout === 'p-6-hero-left')  return [S(0,0,0,W*0.5,H), S(1,W*0.5+g,0,W*0.5-g,h3-g/2), S(2,W*0.5+g,h3+g/2,W*0.5-g,h3-g/2), S(3,W*0.5+g,2*(h3+g/2),W*0.5-g,h3-g/2), S(4,0,H*0.5+g,(W*0.5-g/2)/2,H*0.5-g), S(5,(W*0.5+g/2)/2,H*0.5+g,(W*0.5-g/2)/2,H*0.5-g)];
  if (layout === 'p-6-cols')       { const cw=(W-g)/2; const ch=(H-2*g)/3; return Array.from({length:6},(_,i)=>S(i,(i%2)*(cw+g),Math.floor(i/2)*(ch+g),cw,ch)); }
  if (layout === 'p-6-focus')      { const sw=(W-2*g)/3; const sh=(H-g)/2; return [S(0,0,0,W*0.6,H*0.6), S(1,W*0.6+g,0,W*0.4-g,H*0.3-g/2), S(2,W*0.6+g,H*0.3+g/2,W*0.4-g,H*0.3-g/2), S(3,W*0.6+g,H*0.6+g,W*0.4-g,H*0.4-g), S(4,0,H*0.6+g,sw,H*0.4-g), S(5,sw+g,H*0.6+g,sw,H*0.4-g)]; }
  if (layout === 'p-6-2-4')        return [S(0,0,0,w2,H*0.35), S(1,w2+g,0,w2,H*0.35), S(2,0,H*0.35+g,w2,H*0.65-g), S(3,w2+g,H*0.35+g,w2,(H*0.65-g-g)/3), S(4,w2+g,H*0.35+g+(H*0.65-g-g)/3+g,w2,(H*0.65-g-g)/3), S(5,w2+g,H*0.35+g+2*((H*0.65-g-g)/3+g),w2,(H*0.65-g-g)/3)];
  if (layout === 'p-6-4-2')        return [S(0,0,0,w2,H*0.65-g), S(1,w2+g,0,w2,(H*0.65-g-g)/3), S(2,w2+g,(H*0.65-g-g)/3+g,w2,(H*0.65-g-g)/3), S(3,w2+g,2*((H*0.65-g-g)/3+g),w2,(H*0.65-g-g)/3), S(4,0,H*0.65,w2,H*0.35), S(5,w2+g,H*0.65,w2,H*0.35)];
  if (layout === 'p-6-diagonal')   return [S(0,0,0,W*0.45,H*0.45), S(1,W*0.55,0,W*0.45,H*0.45), S(2,0,H*0.27,W*0.45,H*0.45), S(3,W*0.55,H*0.27,W*0.45,H*0.45), S(4,0,H*0.55,W*0.45,H*0.45), S(5,W*0.55,H*0.55,W*0.45,H*0.45)];
  if (layout === 'p-6-magazine')   return [S(0,0,0,W*0.65,H*0.5-g/2), S(1,W*0.65+g,0,W*0.35-g,H*0.25-g/2), S(2,W*0.65+g,H*0.25+g/2,W*0.35-g,H*0.25-g/2), S(3,0,H*0.5+g/2,w3,H*0.5-g/2), S(4,w3+g,H*0.5+g/2,w3,H*0.5-g/2), S(5,2*(w3+g),H*0.5+g/2,w3,H*0.5-g/2)];
  if (layout === 'p-6-uneven')     return [S(0,0,0,W*0.4,H*0.6), S(1,W*0.4+g,0,W*0.6-g,H*0.4-g/2), S(2,W*0.4+g,H*0.4+g/2,W*0.6-g,H*0.6-g/2), S(3,0,H*0.6+g,w3,H*0.4-g), S(4,w3+g,H*0.6+g,w3,H*0.4-g), S(5,2*(w3+g),H*0.6+g,w3,H*0.4-g)];

  //  PAGE: 7 фото 
  // (removed: dead duplicate of the earlier same-id definition — the if-chain
  //  above returns first, so edits here never had any effect)
  if (layout === 'p-7-hero')       { const bh=H*0.5; const sw=(W-5*g)/6; return [S(0,0,0,W,bh), ...Array.from({length:6},(_,i)=>S(i+1,i*(sw+g),bh+g,sw,H-bh-g))]; }
  if (layout === 'p-7-3-4')        { const sw3=(W-2*g)/3; const sw4=(W-3*g)/4; return [S(0,0,0,sw3,h2), S(1,sw3+g,0,sw3,h2), S(2,2*(sw3+g),0,sw3,h2), S(3,0,h2+g,sw4,h2), S(4,sw4+g,h2+g,sw4,h2), S(5,2*(sw4+g),h2+g,sw4,h2), S(6,3*(sw4+g),h2+g,sw4,h2)]; }
  if (layout === 'p-7-4-3')        { const sw4=(W-3*g)/4; const sw3=(W-2*g)/3; const sh=h2; return [...Array.from({length:4},(_,i)=>S(i,i*(sw4+g),0,sw4,sh)), ...Array.from({length:3},(_,i)=>S(i+4,i*(sw3+g),sh+g,sw3,sh))]; }
  if (layout === 'p-7-mosaic')     return [S(0,0,0,W*0.55,H*0.55), S(1,W*0.55+g,0,W*0.45-g,H*0.28-g/2), S(2,W*0.55+g,H*0.28+g/2,W*0.45-g,H*0.28-g/2), S(3,0,H*0.55+g,w3,H*0.45-g), S(4,w3+g,H*0.55+g,w3,H*0.45-g), S(5,2*(w3+g),H*0.55+g,w3,H*0.45-g), S(6,W*0.55+g,H*0.55+g,W*0.45-g,H*0.45-g)];
  if (layout === 'p-7-col')        { const h7=(H-6*g)/7; return Array.from({length:7},(_,i)=>S(i,0,i*(h7+g),W,h7)); }
  if (layout === 'p-7-big-top')    { const sw=(W-5*g)/6; const sh=h2; return [S(0,0,0,W,sh), ...Array.from({length:6},(_,i)=>S(i+1,i*(sw+g),sh+g,sw,sh))]; }
  if (layout === 'p-7-cols')       { const sw4=(W-3*g)/4; const sw3=(W-2*g)/3; const sh=h2; return [...Array.from({length:4},(_,i)=>S(i,i*(sw4+g),0,sw4,sh)), ...Array.from({length:3},(_,i)=>S(i+4,i*(sw3+g),sh+g,sw3,sh))]; }
  if (layout === 'p-7-strip')      { const w7=(W-6*g)/7; return Array.from({length:7},(_,i)=>S(i,i*(w7+g),0,w7,H)); }
  if (layout === 'p-7-focus')      return [S(0,0,0,W*0.6,H*0.6), ...Array.from({length:6},(_,i)=>{ const cols=3; const sw=(W-2*g)/3; const sh=H*0.4-g; return i<3 ? S(i+1,i*(sw+g),H*0.6+g,sw,sh) : S(i+1,(i-3)*(sw+g)+(i<3?0:W*0.6+g),0,W*0.4-g,H*0.6/3-g/2); }).slice(0,6)];

  //  PAGE: 8 фото 
  // (removed: dead duplicate of the earlier same-id definition — the if-chain
  //  above returns first, so edits here never had any effect)
  if (layout === 'p-8-hero')       { const sw=(W-6*g)/7; const sh=h2; return [S(0,0,0,W,sh), ...Array.from({length:7},(_,i)=>S(i+1,i*(sw+g),sh+g,sw,sh))]; }
  if (layout === 'p-8-2x4')        return Array.from({length:8},(_,i)=>S(i,(i%4)*(w4+g),Math.floor(i/4)*(h2+g),w4,h2));
  if (layout === 'p-8-mosaic')     { const sw3=(W-2*g)/3; return [S(0,0,0,W*0.5,h2-g/2), S(1,W*0.5+g,0,W*0.25-g/2,h2-g/2), S(2,W*0.75+g/2,0,W*0.25-g/2,h2-g/2), ...Array.from({length:5},(_,i)=>S(i+3,i*(W/5+g),h2+g/2,W/5-g,h2-g/2))]; }
  if (layout === 'p-8-strip-v')    { const w8=(W-7*g)/8; return Array.from({length:8},(_,i)=>S(i,i*(w8+g),0,w8,H)); }
  if (layout === 'p-8-focus')      { const sw=(W-3*g)/4; const sh=(H-g)/2; return [S(0,0,0,W*0.5,H*0.5-g/2), ...Array.from({length:7},(_,i)=>{ if(i<3) return S(i+1,i*(sw+g),H*0.5+g/2,sw,sh); return S(i+1,(i===3?W*0.5+g:((i-4)*(sw+g))),(i===3?0:(i<4?0:H*0.5+g/2)),i===3?W*0.5-g:sw,i===3?H*0.5-g/2:sh); })].slice(0,8); }
  if (layout === 'p-8-cols')       { const sw=(W-3*g)/4; const sh=(H-g)/2; return Array.from({length:8},(_,i)=>S(i,(i%4)*(sw+g),Math.floor(i/4)*(sh+g),sw,sh)); }

  //  PAGE: 9 фото 
  // (removed: dead duplicate of the earlier same-id definition — the if-chain
  //  above returns first, so edits here never had any effect)
  if (layout === 'p-9-hero')       { const sw=(W-7*g)/8; const sh=h2; return [S(0,0,0,W,sh), ...Array.from({length:8},(_,i)=>S(i+1,i*(sw+g),sh+g,sw,sh))]; }
  if (layout === 'p-9-mosaic')     return [S(0,0,0,W*0.55,H*0.55), ...Array.from({length:8},(_,i)=>{ const cols=4; const sw=(W-3*g)/4; const sh=H*0.45-g; return i<4 ? S(i+1,i*(sw+g),H*0.55+g,sw,sh) : S(i+1,(i-4)*((W*0.45-g)/4+g)+W*0.55+g,0,(W*0.45-g)/4,(H*0.55-g)/4); })];
  if (layout === 'p-9-strip')      { const w9=(W-8*g)/9; return Array.from({length:9},(_,i)=>S(i,i*(w9+g),0,w9,H)); }
  if (layout === 'p-9-focus')      { const sw=(W-2*g)/3; const sh=(H-2*g)/3; return [S(0,sw+g,sh+g,sw,sh), ...[ [0,0],[sw+sw+g+g,0],[0,sh+g+sh+g],[sw+sw+g+g,sh+g+sh+g],[0,sh+g],[sw+sw+g+g,sh+g],[sw+g,0],[sw+g,sh+g+sh+g] ].map(([x,y],i)=>S(i+1,x,y,sw,sh))].slice(0,9); }

  //  SPREAD: 1 фото додаткові 
  if (layout === 'sp-1-polaroid')     return [S(0, W*0.1, H*0.08, W*0.8, H*0.72)];
  if (layout === 'sp-1-portrait')     return [S(0, W*0.25, H*0.05, W*0.5, H*0.9)];
  if (layout === 'sp-1-landscape')    return [S(0, W*0.04, H*0.15, W*0.92, H*0.7)];
  if (layout === 'sp-1-corner-tl')    return [S(0, 0, 0, W*0.65, H*0.75)];
  if (layout === 'sp-1-corner-br')    return [S(0, W*0.35, H*0.25, W*0.65, H*0.75)];
  if (layout === 'sp-1-left-strip')   return [S(0, 0, 0, W*0.4, H)];
  if (layout === 'sp-1-right-strip')  return [S(0, W*0.6, 0, W*0.4, H)];

  //  SPREAD: 2 фото додаткові 
  if (layout === 'sp-2-triptych')     return [S(0, W*0.05, H*0.1, W*0.42, H*0.8), S(1, W*0.53, H*0.1, W*0.42, H*0.8)];
  if (layout === 'sp-2-overlap')      return [S(0, 0, 0, W*0.65, H*0.75), S(1, W*0.35, H*0.25, W*0.65, H*0.75)];
  if (layout === 'sp-2-frame')        return [S(0, W*0.03, H*0.05, W*0.46, H*0.9), S(1, W*0.51, H*0.05, W*0.46, H*0.9)];

  //  SPREAD: 3 фото додаткові 
  if (layout === 'sp-3-magazine')     return [S(0, 0, 0, W*0.55, H), S(1, W*0.55+g, 0, W*0.45-g, h2-g/2), S(2, W*0.55+g, h2+g/2, W*0.45-g, h2-g/2)];
  if (layout === 'sp-3-focus')        return [S(0, 0, 0, W*0.6, H*0.65), S(1, 0, H*0.65+g, W, H*0.2-g/2), S(2, 0, H*0.85+g/2, W, H*0.15-g/2)];
  if (layout === 'sp-3-diagonal')     return [S(0, 0, 0, W*0.5, H*0.55), S(1, W*0.5+g, 0, W*0.5-g, H*0.45-g/2), S(2, 0, H*0.55+g, W, H*0.45-g)];

  //  SPREAD: 4 фото додаткові 
  if (layout === 'sp-4-magazine')     return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.6+g, 0, W*0.4-g, H*0.4-g/2), S(2, W*0.6+g, H*0.4+g/2, W*0.4-g, H*0.6-g/2), S(3, 0, H*0.6+g, W*0.6, H*0.4-g)];
  if (layout === 'sp-4-diagonal')     return [S(0, 0, 0, W*0.5, H*0.5-g/2), S(1, W*0.5+g, 0, W*0.5-g, H*0.5-g/2), S(2, 0, H*0.5+g/2, W*0.5-g/2, H*0.5-g/2), S(3, W*0.5+g/2, H*0.5+g/2, W*0.5-g/2, H*0.5-g/2)];
  if (layout === 'sp-4-uneven')       return [S(0, 0, 0, W*0.55, H), S(1, W*0.55+g, 0, W*0.45-g, h3-g/3), S(2, W*0.55+g, h3+g*2/3, W*0.45-g, h3-g/3), S(3, W*0.55+g, 2*h3+g*4/3, W*0.45-g, h3-g/3)];

  //  PAGE: 8 фото додаткові 
  if (layout === 'p-8-3-5')        { const sw3=(W-2*g)/3; const sw5=(W-4*g)/5; const sh=h2; return [...Array.from({length:3},(_,i)=>S(i,i*(sw3+g),0,sw3,sh)), ...Array.from({length:5},(_,i)=>S(i+3,i*(sw5+g),sh+g,sw5,sh))]; }
  if (layout === 'p-8-5-3')        { const sw5=(W-4*g)/5; const sw3=(W-2*g)/3; const sh=h2; return [...Array.from({length:5},(_,i)=>S(i,i*(sw5+g),0,sw5,sh)), ...Array.from({length:3},(_,i)=>S(i+5,i*(sw3+g),sh+g,sw3,sh))]; }
  if (layout === 'p-8-corner')     return [S(0,W*0.2,H*0.2,W*0.6,H*0.6), S(1,0,0,W*0.18,H*0.18), S(2,W*0.41,0,W*0.18,H*0.18), S(3,W*0.82,0,W*0.18,H*0.18), S(4,0,H*0.41,W*0.18,H*0.18), S(5,W*0.82,H*0.41,W*0.18,H*0.18), S(6,0,H*0.82,W*0.18,H*0.18), S(7,W*0.82,H*0.82,W*0.18,H*0.18)];
  if (layout === 'p-8-strip-h')    { const h8=(H-7*g)/8; return Array.from({length:8},(_,i)=>S(i,0,i*(h8+g),W,h8)); }
  if (layout === 'p-8-diagonal')   { const sz=W*0.35; return Array.from({length:8},(_,i)=>S(i,(i%2)*((W-sz-g)/1+g+sz/2-(i%2)*(sz/2+g)),(Math.floor(i/2))*(H/4),sz,H/4-g/2)); }
  if (layout === 'p-8-magazine')   return [S(0,0,0,W*0.6,H*0.55-g/2), S(1,W*0.6+g,0,W*0.4-g,H*0.27-g/2), S(2,W*0.6+g,H*0.27+g/2,W*0.4-g,H*0.27-g/2), S(3,0,H*0.55+g/2,w4,H*0.45-g), S(4,w4+g,H*0.55+g/2,w4,H*0.45-g), S(5,2*(w4+g),H*0.55+g/2,w4,H*0.45-g), S(6,3*(w4+g),H*0.55+g/2,w4,H*0.45-g), S(7,W*0.6+g,H*0.55+g/2,W*0.4-g,H*0.45-g)];

  //  PAGE: 9 фото додаткові 
  if (layout === 'p-9-cols')       { const sw=(W-2*g)/3; const sh=(H-2*g)/3; return Array.from({length:9},(_,i)=>S(i,(i%3)*(sw+g),Math.floor(i/3)*(sh+g),sw,sh)); }
  if (layout === 'p-9-3-3-3')     { const sh=(H-2*g)/3; const sw3=(W-2*g)/3; return Array.from({length:9},(_,i)=>S(i,(i%3)*(sw3+g),Math.floor(i/3)*(sh+g),sw3,sh)); }
  if (layout === 'p-9-hero-top')  { const sw=(W-7*g)/8; const bh=H*0.35; return [S(0,0,0,W,bh), ...Array.from({length:8},(_,i)=>S(i+1,i*(sw+g),bh+g,sw,H-bh-g))]; }
  if (layout === 'p-9-big-left')  { const sw=(W-4*g)/5; const sh=(H-1*g)/2; return [S(0,0,0,W*0.4,H), ...Array.from({length:8},(_,i)=>S(i+1,W*0.4+g+(i%4)*(sw*0.6+g),Math.floor(i/4)*(sh+g),sw*0.6,sh))]; }
  if (layout === 'p-9-magazine')  return [S(0,0,0,W*0.55,H*0.5-g/2), S(1,W*0.55+g,0,W*0.45-g,H*0.25-g/2), S(2,W*0.55+g,H*0.25+g/2,W*0.45-g,H*0.25-g/2), S(3,0,H*0.5+g/2,W*0.55,H*0.5-g/2), S(4,W*0.55+g,H*0.5+g/2,W*0.45-g,H*0.5-g/2), ...Array.from({length:4},(_,i)=>S(i+5,(i%2)*(w2+g),(i<2?0:h2+g)+H*0.5+g/2,w2,h2)).slice(0,4)].slice(0,9);
  if (layout === 'p-9-diagonal')  { const sz=H*0.33; return Array.from({length:9},(_,i)=>S(i,(i%3)*(W/3),Math.floor(i/3)*(sz),W/3-g,sz-g)); }
  if (layout === 'p-9-4-5')       { const sw4=(W-3*g)/4; const sw5=(W-4*g)/5; const sh=h2; return [...Array.from({length:4},(_,i)=>S(i,i*(sw4+g),0,sw4,sh)), ...Array.from({length:5},(_,i)=>S(i+4,i*(sw5+g),sh+g,sw5,sh))]; }
  if (layout === 'p-9-5-4')       { const sw5=(W-4*g)/5; const sw4=(W-3*g)/4; const sh=h2; return [...Array.from({length:5},(_,i)=>S(i,i*(sw5+g),0,sw5,sh)), ...Array.from({length:4},(_,i)=>S(i+5,i*(sw4+g),sh+g,sw4,sh))]; }
  if (layout === 'p-9-strip-h')   { const h9=(H-8*g)/9; return Array.from({length:9},(_,i)=>S(i,0,i*(h9+g),W,h9)); }

  //  PAGE: 7 фото додаткові 
  if (layout === 'p-7-row')        { const w7=(W-6*g)/7; return Array.from({length:7},(_,i)=>S(i,i*(w7+g),0,w7,H)); }
  if (layout === 'p-7-col-full')   { const h7=(H-6*g)/7; return Array.from({length:7},(_,i)=>S(i,0,i*(h7+g),W,h7)); }
  if (layout === 'p-7-panorama')   { const sw=(W-5*g)/6; return [S(0,0,0,W,H*0.38), ...Array.from({length:6},(_,i)=>S(i+1,i*(sw+g),H*0.38+g,sw,H*0.62-g))]; }
  if (layout === 'p-7-magazine')   return [S(0,0,0,W*0.6,H*0.5-g/2), S(1,W*0.6+g,0,W*0.4-g,H*0.25-g/2), S(2,W*0.6+g,H*0.25+g/2,W*0.4-g,H*0.25-g/2), S(3,0,H*0.5+g/2,w3,H*0.5-g/2), S(4,w3+g,H*0.5+g/2,w3,H*0.5-g/2), S(5,2*(w3+g),H*0.5+g/2,w2,H*0.25-g/2), S(6,2*(w3+g),H*0.75+g/2,w2,H*0.25-g/2)];
  if (layout === 'p-7-diagonal')   return Array.from({length:7},(_,i)=>S(i,(i%3)*(W/3+g),(Math.floor(i/3))*(H/3),W/3-g,H/3-g));

  //  PAGE: 8 фото додаткові 
  if (layout === 'p-8-row')        { const w8=(W-7*g)/8; return Array.from({length:8},(_,i)=>S(i,i*(w8+g),0,w8,H)); }
  if (layout === 'p-8-col')        { const h8=(H-7*g)/8; return Array.from({length:8},(_,i)=>S(i,0,i*(h8+g),W,h8)); }
  if (layout === 'p-8-4-4')        { const sw=(W-3*g)/4; const sh=(H-g)/2; return Array.from({length:8},(_,i)=>S(i,(i%4)*(sw+g),Math.floor(i/4)*(sh+g),sw,sh)); }
  if (layout === 'p-8-big-top')    { const sw=(W-6*g)/7; return [S(0,0,0,W,H*0.4), ...Array.from({length:7},(_,i)=>S(i+1,i*(sw+g),H*0.4+g,sw,H*0.6-g))]; }
  if (layout === 'p-8-big-left')   { const sh=(H-6*g)/7; return [S(0,0,0,W*0.45,H), ...Array.from({length:7},(_,i)=>S(i+1,W*0.45+g,i*(sh+g),W*0.55-g,sh))]; }
  if (layout === 'p-8-panorama')   { const sw=(W-6*g)/7; return [S(0,0,0,W,H*0.35), ...Array.from({length:7},(_,i)=>S(i+1,i*(sw+g),H*0.35+g,sw,H*0.65-g))]; }
  if (layout === 'p-8-uneven')     return [S(0,0,0,W*0.5,H*0.5-g/2), S(1,W*0.5+g,0,W*0.25-g/2,H*0.25-g/2), S(2,W*0.75+g/2,0,W*0.25-g/2,H*0.25-g/2), S(3,W*0.5+g,H*0.25+g/2,W*0.5-g,H*0.25-g/2), S(4,0,H*0.5+g/2,w4,H*0.5-g/2), S(5,w4+g,H*0.5+g/2,w4,H*0.5-g/2), S(6,2*(w4+g),H*0.5+g/2,w4,H*0.5-g/2), S(7,3*(w4+g),H*0.5+g/2,w4,H*0.5-g/2)];
  if (layout === 'p-8-cross')      return [S(0,W*0.33,0,W*0.34,H*0.33), S(1,0,W*0.33,W*0.33,H*0.34), S(2,W*0.67,W*0.33,W*0.33,H*0.34), S(3,W*0.33,H*0.67,W*0.34,H*0.33), S(4,0,0,W*0.3,H*0.3), S(5,W*0.7,0,W*0.3,H*0.3), S(6,0,H*0.7,W*0.3,H*0.3), S(7,W*0.7,H*0.7,W*0.3,H*0.3)];

  //  PAGE: 1 фото додаткові 
  if (layout === 'p-1-oval')           return [S(0, W*0.1, H*0.05, W*0.8, H*0.9)];
  if (layout === 'p-1-inset-tl')       return [S(0, W*0.04, H*0.04, W*0.7, H*0.7)];
  if (layout === 'p-1-inset-br')       return [S(0, W*0.26, H*0.26, W*0.7, H*0.7)];
  if (layout === 'p-1-wide-center')    return [S(0, W*0.02, H*0.12, W*0.96, H*0.76)];
  if (layout === 'p-1-tall-center')    return [S(0, W*0.2, H*0.02, W*0.6, H*0.96)];

  //  PAGE: 2 фото додаткові 
  if (layout === 'p-2-triptych')       return [S(0, W*0.04, H*0.08, W*0.42, H*0.84), S(1, W*0.54, H*0.08, W*0.42, H*0.84)];
  if (layout === 'p-2-asymm-left')     return [S(0, 0, 0, W/3, H), S(1, W/3+g, 0, W*2/3-g, H)];
  if (layout === 'p-2-asymm-right')    return [S(0, 0, 0, W*2/3, H), S(1, W*2/3+g, 0, W/3-g, H)];
  if (layout === 'p-2-stacked-center') return [S(0, W*0.08, H*0.04, W*0.84, H*0.44), S(1, W*0.08, H*0.52, W*0.84, H*0.44)];
  if (layout === 'p-2-wide-top')       return [S(0, 0, 0, W, H*0.55), S(1, W*0.1, H*0.58, W*0.8, H*0.38)];

  //  PAGE: 3 фото додаткові 
  if (layout === 'p-3-fan')            return [S(0, 0, 0, W*0.55, H*0.55), S(1, W*0.22, H*0.22, W*0.55, H*0.55), S(2, W*0.44, H*0.44, W*0.56, H*0.56)];
  if (layout === 'p-3-asymm')          return [S(0, 0, 0, W*0.6, H*0.45), S(1, W*0.6+g, 0, W*0.4-g, H*0.45), S(2, 0, H*0.45+g, W, H*0.55-g)];
  if (layout === 'p-3-stacked')        { const h3s=(H-2*g)/3; return [S(0,W*0.05,0,W*0.9,h3s), S(1,0,h3s+g,W*0.9,h3s), S(2,W*0.1,(h3s+g)*2,W*0.9,h3s)]; }
  if (layout === 'p-3-wide-mid')       return [S(0, W*0.1, 0, W*0.8, H*0.3-g/2), S(1, 0, H*0.3+g/2, W, H*0.4-g), S(2, W*0.1, H*0.7+g/2, W*0.8, H*0.3-g/2)];
  if (layout === 'p-3-2col')           return [S(0, 0, 0, w2, h2), S(1, 0, h2+g, w2, h2), S(2, w2+g, 0, w2, H)];

  //  PAGE: 4 фото додаткові 
  if (layout === 'p-4-diamond')        return [S(0,W*0.25,0,w2,h2-g/2), S(1,0,h2+g/2,w2,h2-g/2), S(2,w2+g,h2+g/2,w2,h2-g/2), S(3,W*0.25,H*0.5+g/2,w2,h2-g/2)];
  if (layout === 'p-4-t-shape')        return [S(0,0,0,w3,H*0.5-g/2), S(1,w3+g,0,w3,H*0.5-g/2), S(2,(w3+g)*2,0,w3,H*0.5-g/2), S(3,W*0.15,H*0.5+g/2,W*0.7,H*0.5-g/2)];
  if (layout === 'p-4-asymm-col')      return [S(0,0,0,W*0.4,h2-g/2), S(1,0,h2+g/2,W*0.4,h2-g/2), S(2,W*0.4+g,0,W*0.6-g,H*0.6), S(3,W*0.4+g,H*0.6+g,W*0.6-g,H*0.4-g)];
  if (layout === 'p-4-wide-bot')       return [S(0,0,0,w3,H*0.45), S(1,w3+g,0,w3,H*0.45), S(2,(w3+g)*2,0,w3,H*0.45), S(3,0,H*0.45+g,W,H*0.55-g)];
  if (layout === 'p-4-center-focus')   return [S(0,0,0,W*0.22,H), S(1,W*0.22+g,0,W*0.56-2*g,H*0.65), S(2,W*0.22+g,H*0.65+g,W*0.56-2*g,H*0.35-g), S(3,W*0.78,0,W*0.22,H)];

  //  PAGE: 5 фото додаткові 
  if (layout === 'p-5-scattered')      return [S(0,0,0,W*0.55,H*0.5), S(1,W*0.6,0,W*0.4,H*0.38), S(2,W*0.6,H*0.4,W*0.4,H*0.28), S(3,0,H*0.52,W*0.38,H*0.48), S(4,W*0.4,H*0.6,W*0.6,H*0.4)];
  if (layout === 'p-5-pyramid')        { const tw=(W-2*g)/3; return [S(0,0,0,w2,H*0.38), S(1,w2+g,0,w2,H*0.38), S(2,0,H*0.38+g,tw,H*0.62-g), S(3,tw+g,H*0.38+g,tw,H*0.62-g), S(4,(tw+g)*2,H*0.38+g,tw,H*0.62-g)]; }
  if (layout === 'p-5-2-1-2')         { const sw=(W-g)/2; const sh=(H-2*g)/3; return [S(0,0,0,sw,sh), S(1,sw+g,0,sw,sh), S(2,W*0.1,sh+g,W*0.8,sh), S(3,0,(sh+g)*2,sw,sh), S(4,sw+g,(sh+g)*2,sw,sh)]; }
  if (layout === 'p-5-wide-center')    { const sw=(W-3*g)/4; return [S(0,0,0,sw,H*0.45), S(1,sw+g,0,sw,H*0.45), S(2,W*0.1,H*0.45+g,W*0.8,H*0.25), S(3,0,H*0.7+g,sw+g/2,H*0.3-g), S(4,sw+g+g/2,H*0.7+g,W-sw-g-g/2,H*0.3-g)]; }
  if (layout === 'p-5-editorial')      return [S(0,0,0,W*0.55,H*0.6), S(1,W*0.55+g,0,W*0.45-g,H*0.3-g/2), S(2,W*0.55+g,H*0.3+g/2,W*0.45-g,H*0.3-g/2), S(3,0,H*0.6+g,W*0.28,H*0.4-g), S(4,W*0.28+g,H*0.6+g,W*0.72-g,H*0.4-g)];

  //  PAGE: 6 фото додаткові 
  if (layout === 'p-6-editorial')      return [S(0,0,0,W*0.65,H*0.5-g/2), S(1,W*0.65+g,0,W*0.35-g,H*0.25-g/2), S(2,W*0.65+g,H*0.25+g/2,W*0.35-g,H*0.25-g/2), S(3,0,H*0.5+g/2,w3,H*0.5-g/2), S(4,w3+g,H*0.5+g/2,w3,H*0.5-g/2), S(5,2*(w3+g),H*0.5+g/2,w3,H*0.5-g/2)];
  if (layout === 'p-6-3rows')          { const rh=(H-2*g)/3; return Array.from({length:6},(_,i)=>S(i,(i%2)*(w2+g),Math.floor(i/2)*(rh+g),w2,rh)); }
  if (layout === 'p-6-asymm')          return [S(0,0,0,W*0.55,H*0.55), S(1,W*0.55+g,0,W*0.45-g,H*0.28-g/2), S(2,W*0.55+g,H*0.28+g/2,W*0.45-g,H*0.27-g/2), S(3,0,H*0.55+g,W*0.28,H*0.45-g), S(4,W*0.28+g,H*0.55+g,W*0.27,H*0.45-g), S(5,W*0.55+g,H*0.55+g,W*0.45-g,H*0.45-g)];
  if (layout === 'p-6-pyramid')        { const sw=(W-2*g)/3; return [S(0,W*0.15,0,W*0.7,H*0.35), S(1,0,H*0.35+g,w2,H*0.3-g/2), S(2,w2+g,H*0.35+g,w2,H*0.3-g/2), S(3,0,H*0.65+g/2,sw,H*0.35-g/2), S(4,sw+g,H*0.65+g/2,sw,H*0.35-g/2), S(5,2*(sw+g),H*0.65+g/2,sw,H*0.35-g/2)]; }
  if (layout === 'p-6-center-hero')    return [S(0,W*0.15,H*0.1,W*0.7,H*0.5), S(1,0,0,W*0.14,H*0.45), S(2,W*0.86,0,W*0.14,H*0.45), S(3,0,H*0.6,W*0.14,H*0.4), S(4,W*0.86,H*0.6,W*0.14,H*0.4), S(5,W*0.15,H*0.62,W*0.7,H*0.38)];

  //  PAGE: 9 фото додаткові 
  if (layout === 'p-9-4-rows')         { const sw4=(W-3*g)/4; const sw3=(W-2*g)/3; const sw2=(W-g)/2; const sh=(H-3*g)/4; return [...Array.from({length:4},(_,i)=>S(i,i*(sw4+g),0,sw4,sh)), ...Array.from({length:3},(_,i)=>S(i+4,i*(sw3+g),sh+g,sw3,sh)), ...Array.from({length:2},(_,i)=>S(i+7,i*(sw2+g),(sh+g)*2,sw2,sh))]; }
  if (layout === 'p-9-big-center')     { const sw=(W-2*g)/3; const sh=(H-2*g)/3; return [S(0,0,0,sw,sh), S(1,sw+g,0,sw,sh), S(2,2*(sw+g),0,sw,sh), S(3,0,sh+g,sw,sh), S(4,sw+g,sh+g,sw,sh), S(5,2*(sw+g),sh+g,sw,sh), S(6,0,2*(sh+g),sw,sh), S(7,sw+g,2*(sh+g),sw,sh), S(8,2*(sw+g),2*(sh+g),sw,sh)]; }
  if (layout === 'p-9-2col-asym')      { const sh=(H-4*g)/5; return [...Array.from({length:5},(_,i)=>S(i,0,i*(sh+g),W*0.55-g/2,sh)), ...Array.from({length:4},(_,i)=>S(i+5,W*0.55+g/2,i*((H-3*g)/4+g),(W*0.45-g/2),(H-3*g)/4))]; }
  if (layout === 'p-9-cross')          { const c=W*0.33; return [S(0,0,0,c,c), S(1,c+g,0,c,c), S(2,2*(c+g),0,c,c), S(3,0,c+g,c,c), S(4,c+g,c+g,c,c), S(5,2*(c+g),c+g,c,c), S(6,0,2*(c+g),c,c), S(7,c+g,2*(c+g),c,c), S(8,2*(c+g),2*(c+g),c,c)]; }
  if (layout === 'p-9-editorial')      return [S(0,0,0,W*0.6,H*0.5), S(1,W*0.6+g,0,W*0.4-g,H*0.25-g/2), S(2,W*0.6+g,H*0.25+g/2,W*0.4-g,H*0.25-g/2), ...Array.from({length:5},(_,i)=>S(i+3,i*((W-4*g)/5+g),H*0.5+g,(W-4*g)/5,H*0.5-g)), S(8,W*0.6+g,H*0.5+g,W*0.4-g,H*0.5-g)];
  if (layout === 'p-9-zigzag')         { const cw=(W-2*g)/3; const ch=(H-2*g)/3; return Array.from({length:9},(_,i)=>S(i,(i%3)*(cw+g),Math.floor(i/3)*(ch+g),cw,ch)); }

  //  PAGE: Текстові 
  if (layout === 'p-text-center')      return [];
  if (layout === 'p-text-left')        return [];
  if (layout === 'p-text-right')       return [];
  if (layout === 'p-text-photo-left')  return [S(0, 0, 0, W*0.45, H)];
  if (layout === 'p-text-photo-right') return [S(0, W*0.55, 0, W*0.45, H)];

  //  SPREAD: 1 фото додаткові 
  if (layout === 'sp-1-tilt-left')     return [S(0, W*0.02, H*0.05, W*0.55, H*0.9)];
  if (layout === 'sp-1-tilt-right')    return [S(0, W*0.43, H*0.05, W*0.55, H*0.9)];
  if (layout === 'sp-1-wide-strip')    return [S(0, 0, H*0.2, W, H*0.6)];
  if (layout === 'sp-1-panorama')      return [S(0, W*0.02, H*0.08, W*0.96, H*0.84)];
  if (layout === 'sp-1-inset')         return [S(0, W*0.08, H*0.08, W*0.84, H*0.84)];

  //  SPREAD: 2 фото додаткові 
  if (layout === 'sp-2-stacked-left')  return [S(0, 0, 0, W*0.48-g/2, h2-g/2), S(1, 0, h2+g/2, W*0.48-g/2, h2-g/2)];
  if (layout === 'sp-2-stacked-right') return [S(0, W*0.52+g/2, 0, W*0.48-g/2, h2-g/2), S(1, W*0.52+g/2, h2+g/2, W*0.48-g/2, h2-g/2)];
  if (layout === 'sp-2-panorama-pair') return [S(0, 0, H*0.1, W*0.5-g/2, H*0.8), S(1, W*0.5+g/2, H*0.1, W*0.5-g/2, H*0.8)];
  if (layout === 'sp-2-asymm-top')     return [S(0, 0, 0, W, H*0.4-g/2), S(1, W*0.1, H*0.4+g/2, W*0.8, H*0.6-g/2)];
  if (layout === 'sp-2-inset-small')   return [S(0, 0, 0, W, H), S(1, W*0.6, H*0.6, W*0.35, H*0.35)];

  //  SPREAD: 3 фото додаткові 
  if (layout === 'sp-3-editorial')     return [S(0,0,0,W*0.55,H), S(1,W*0.55+g,0,W*0.45-g,h2-g/2), S(2,W*0.55+g,h2+g/2,W*0.45-g,h2-g/2)];
  if (layout === 'sp-3-scattered')     return [S(0,0,H*0.05,W*0.5,H*0.6), S(1,W*0.45,H*0.35,W*0.55,H*0.6), S(2,W*0.1,H*0.65,W*0.45,H*0.35)];
  if (layout === 'sp-3-asymm-wide')    return [S(0,0,0,W*0.7,H*0.6), S(1,W*0.7+g,0,W*0.3-g,H*0.6), S(2,0,H*0.6+g,W,H*0.4-g)];
  if (layout === 'sp-3-two-col')       return [S(0,0,0,W*0.5-g/2,h2-g/2), S(1,0,h2+g/2,W*0.5-g/2,h2-g/2), S(2,W*0.5+g/2,0,W*0.5-g/2,H)];
  if (layout === 'sp-3-one-two')       return [S(0,0,0,W*0.5-g/2,H), S(1,W*0.5+g/2,0,W*0.5-g/2,h2-g/2), S(2,W*0.5+g/2,h2+g/2,W*0.5-g/2,h2-g/2)];

  //  SPREAD: 4 фото додаткові 
  if (layout === 'sp-4-editorial')     return [S(0,0,0,W*0.6,H*0.6), S(1,W*0.6+g,0,W*0.4-g,H*0.3-g/2), S(2,W*0.6+g,H*0.3+g/2,W*0.4-g,H*0.3-g/2), S(3,0,H*0.6+g,W*0.6,H*0.4-g)];
  if (layout === 'sp-4-pyramid')       return [S(0,W*0.15,0,W*0.7,H*0.45), S(1,0,H*0.45+g,W*0.33-g/2,H*0.55-g), S(2,W*0.33+g/2,H*0.45+g,W*0.34-g,H*0.55-g), S(3,W*0.67+g/2,H*0.45+g,W*0.33-g/2,H*0.55-g)];
  if (layout === 'sp-4-scattered')     return [S(0,0,0,W*0.52,H*0.52), S(1,W*0.52+g,0,W*0.48-g,H*0.45), S(2,W*0.52+g,H*0.48,W*0.48-g,H*0.52), S(3,0,H*0.55,W*0.52,H*0.45)];
  if (layout === 'sp-4-2-2')          return [S(0,0,0,W*0.5-g/2,h2-g/2), S(1,0,h2+g/2,W*0.5-g/2,h2-g/2), S(2,W*0.5+g/2,0,W*0.5-g/2,h2-g/2), S(3,W*0.5+g/2,h2+g/2,W*0.5-g/2,h2-g/2)];
  if (layout === 'sp-4-asymm-wide')    return [S(0,0,0,W*0.55,H), S(1,W*0.55+g,0,W*0.45-g,H*0.33-g/3), S(2,W*0.55+g,H*0.33+g/3,W*0.45-g,H*0.34-g/3), S(3,W*0.55+g,H*0.67+g/3,W*0.45-g,H*0.33-g/3)];

  //  SPREAD: 5+ фото додаткові 
  if (layout === 'sp-5-editorial')     return [S(0,0,0,W*0.55,H*0.6), S(1,W*0.55+g,0,W*0.45-g,H*0.3-g/2), S(2,W*0.55+g,H*0.3+g/2,W*0.45-g,H*0.3-g/2), S(3,0,H*0.6+g,W*0.28,H*0.4-g), S(4,W*0.28+g,H*0.6+g,W*0.72-g,H*0.4-g)];
  if (layout === 'sp-6-editorial')     return [S(0,0,0,W*0.5,H*0.55), S(1,W*0.5+g,0,W*0.25-g/2,H*0.28-g/2), S(2,W*0.75+g/2,0,W*0.25-g/2,H*0.28-g/2), S(3,W*0.5+g,H*0.28+g/2,W*0.5-g,H*0.27-g/2), S(4,0,H*0.55+g,W*0.33-g/2,H*0.45-g), S(5,W*0.33+g/2,H*0.55+g,W*0.67-g/2,H*0.45-g)];
  if (layout === 'sp-8-editorial')     { const sw=(W-3*g)/4; const sh=(H-g)/2; return Array.from({length:8},(_,i)=>S(i,(i%4)*(sw+g),Math.floor(i/4)*(sh+g),sw,sh)); }
  if (layout === 'sp-11-grid')         { const cw=(W-4*g)/5; const ch=(H-1*g)/2; const cw2=(W-3*g)/4; return [...Array.from({length:5},(_,i)=>S(i,i*(cw+g),0,cw,ch)), ...Array.from({length:6},(_,i)=>S(i+5,i<4?i*(cw2+g):0,i<4?ch+g:ch+g+(ch-g/6),i<4?cw2:W,(i<4?ch-g:ch/6)))].slice(0,11); }
  if (layout === 'sp-14-grid')         { const cw=(W-6*g)/7; const ch=(H-g)/2; return Array.from({length:14},(_,i)=>S(i,(i%7)*(cw+g),Math.floor(i/7)*(ch+g),cw,ch)); }

  //  Вертикальні слоти на сторінку (1/2/3) 
  if (layout === 'p-vert-1')           { const mx=W*0.28, vt=H*0.06; return [S(0, mx, vt, W-2*mx, H-2*vt)]; }
  if (layout === 'p-vert-2')           { const mx=W*0.06, vt=H*0.08, cw=(W-2*mx-g)/2, hh=H-2*vt; return [S(0, mx, vt, cw, hh), S(1, mx+cw+g, vt, cw, hh)]; }
  if (layout === 'p-vert-3')           { const mx=W*0.04, vt=H*0.08, cw=(W-2*mx-2*g)/3, hh=H-2*vt; return [S(0, mx, vt, cw, hh), S(1, mx+cw+g, vt, cw, hh), S(2, mx+2*(cw+g), vt, cw, hh)]; }
  //  Дзеркальні пари на розворот — поза лінією згину (відступ біля корінця) 
  if (layout === 'sp-mirror-1')        { const outer=W*0.05, spine=W*0.035, vt=H*0.08, ha=W*0.5-spine-outer, hh=H-2*vt, rx=W*0.5+spine; return [S(0, outer, vt, ha, hh), S(1, rx, vt, ha, hh)]; }
  if (layout === 'sp-mirror-2')        { const outer=W*0.05, spine=W*0.035, vt=H*0.08, ha=W*0.5-spine-outer, cw=(ha-g)/2, hh=H-2*vt, rx=W*0.5+spine; return [S(0, outer, vt, cw, hh), S(1, outer+cw+g, vt, cw, hh), S(2, rx, vt, cw, hh), S(3, rx+cw+g, vt, cw, hh)]; }
  if (layout === 'sp-mirror-3')        { const outer=W*0.05, spine=W*0.035, vt=H*0.08, ha=W*0.5-spine-outer, cw=(ha-2*g)/3, hh=H-2*vt, rx=W*0.5+spine; return [S(0, outer, vt, cw, hh), S(1, outer+cw+g, vt, cw, hh), S(2, outer+2*(cw+g), vt, cw, hh), S(3, rx, vt, cw, hh), S(4, rx+cw+g, vt, cw, hh), S(5, rx+2*(cw+g), vt, cw, hh)]; }
  // Колаж: велике фото + стовпець із 2 фото стопкою, край-до-краю
  if (layout === 'sp-4-pairs-center') { const a=W-2*g, wA=a*0.30, wS=a*0.17, wD=a*0.53, hh=(H-g)/2, xS=wA+g, xD=xS+wS+g; return [S(0,0,0,wA,H), S(1,xS,0,wS,hh), S(2,xS,hh+g,wS,hh), S(3,xD,0,wD,H)]; }
  if (layout === 'sp-6-pairs')        { const a=W-3*g, wA=a*0.26, wS1=a*0.14, wD=a*0.37, wS2=a*0.23, hh=(H-g)/2, xB=wA+g, xD=xB+wS1+g, xE=xD+wD+g; return [S(0,0,0,wA,H), S(1,xB,0,wS1,hh), S(2,xB,hh+g,wS1,hh), S(3,xD,0,wD,H), S(4,xE,0,wS2,hh), S(5,xE,hh+g,wS2,hh)]; }

  return [S(0, 0, 0, W, H)];
}
