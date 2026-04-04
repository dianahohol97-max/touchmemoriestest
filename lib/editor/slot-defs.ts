import * as React from 'react';
import type { LayoutType } from './types';

export interface SlotDef {
  i: number;
  s: React.CSSProperties;
}

export function getSlotDefs(layout: LayoutType, W: number, H: number): SlotDef[] {
  const g = 4;
  const w2 = (W - g) / 2, h2 = (H - g) / 2;
  const w3 = (W - 2 * g) / 3, h3 = (H - 2 * g) / 3;
  const w4 = (W - 3 * g) / 4, h4 = (H - 3 * g) / 4;
  const b: React.CSSProperties = { position: 'absolute', overflow: 'hidden', borderRadius: 3 };

  const S = (i: number, x: number, y: number, w: number, h: number, extra?: React.CSSProperties): SlotDef =>
    ({ i, s: { ...b, left: x, top: y, width: w, height: h, ...extra } });

  // 1 photo
  if (layout === 'p-full')        return [S(0, 0, 0, W, H)];
  if (layout === 'p-center')      return [S(0, W*0.08, H*0.08, W*0.84, H*0.84)];
  if (layout === 'p-top')         return [S(0, 0, 0, W, H*0.65)];
  if (layout === 'p-bottom')      return [S(0, 0, H*0.35, W, H*0.65)];
  if (layout === 'p-left')        return [S(0, 0, 0, W*0.65, H)];
  if (layout === 'p-right')       return [S(0, W*0.35, 0, W*0.65, H)];

  // 2 photos
  if (layout === 'p-2-v')         return [S(0, 0, 0, w2, H), S(1, w2+g, 0, w2, H)];
  if (layout === 'p-2-h')         return [S(0, 0, 0, W, h2), S(1, 0, h2+g, W, h2)];
  if (layout === 'p-2-big-top')   return [S(0, 0, 0, W, H*0.65), S(1, 0, H*0.65+g, W, H*0.35-g)];
  if (layout === 'p-2-big-bottom') return [S(0, 0, 0, W, H*0.35), S(1, 0, H*0.35+g, W, H*0.65-g)];
  if (layout === 'p-2-big-left')  return [S(0, 0, 0, W*0.65, H), S(1, W*0.65+g, 0, W*0.35-g, H)];
  if (layout === 'p-2-big-right') return [S(0, 0, 0, W*0.35, H), S(1, W*0.35+g, 0, W*0.65-g, H)];
  if (layout === 'p-2-diag')      return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.4, H*0.4, W*0.6, H*0.6)];

  // 3 photos
  if (layout === 'p-3-row')       return [S(0,0,0,w3,H), S(1,w3+g,0,w3,H), S(2,(w3+g)*2,0,w3,H)];
  if (layout === 'p-3-col')       return [S(0,0,0,W,h3), S(1,0,h3+g,W,h3), S(2,0,(h3+g)*2,W,h3)];
  if (layout === 'p-3-top2')      return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,W,h2)];
  if (layout === 'p-3-bot2')      return [S(0,0,0,W,h2), S(1,0,h2+g,w2,h2), S(2,w2+g,h2+g,w2,h2)];
  if (layout === 'p-3-left2')     return [S(0,0,0,w2,h2), S(1,0,h2+g,w2,h2), S(2,w2+g,0,w2,H)];
  if (layout === 'p-3-right2')    return [S(0,0,0,w2,H), S(1,w2+g,0,w2,h2), S(2,w2+g,h2+g,w2,h2)];
  if (layout === 'p-3-hero-top')  return [S(0,0,0,W,H*0.55), S(1,0,H*0.55+g,w2,H*0.45-g), S(2,w2+g,H*0.55+g,w2,H*0.45-g)];
  if (layout === 'p-3-hero-left') return [S(0,0,0,W*0.55,H), S(1,W*0.55+g,0,W*0.45-g,h2), S(2,W*0.55+g,h2+g,W*0.45-g,h2)];

  // 4 photos
  if (layout === 'p-4-grid')      return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,w2,h2), S(3,w2+g,h2+g,w2,h2)];
  if (layout === 'p-4-hero-top')  { const bh=H*0.55, sh=H-bh-g; return [S(0,0,0,W,bh), S(1,0,bh+g,w3,sh), S(2,w3+g,bh+g,w3,sh), S(3,(w3+g)*2,bh+g,w3,sh)]; }
  if (layout === 'p-4-hero-left') { const bw=W*0.55, sw=W-bw-g; const sh=(H-2*g)/3; return [S(0,0,0,bw,H), S(1,bw+g,0,sw,sh), S(2,bw+g,sh+g,sw,sh), S(3,bw+g,(sh+g)*2,sw,sh)]; }
  if (layout === 'p-4-strip-h')   return [S(0,0,0,W,h4), S(1,0,h4+g,W,h4), S(2,0,(h4+g)*2,W,h4), S(3,0,(h4+g)*3,W,h4)];
  if (layout === 'p-4-strip-v')   return [S(0,0,0,w4,H), S(1,w4+g,0,w4,H), S(2,(w4+g)*2,0,w4,H), S(3,(w4+g)*3,0,w4,H)];
  if (layout === 'p-4-l-shape')   { const bw=W*0.6, sh=(H-g)/2; return [S(0,0,0,bw,H), S(1,bw+g,0,W-bw-g,sh), S(2,bw+g,sh+g,W-bw-g,sh), S(3,0,H-H*0.25,bw,H*0.25)]; }

  // 5 photos
  if (layout === 'p-5-hero')      { const bh=H*0.55; const sw=(W-2*g)/4; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3].map(i=>S(i+1,i*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'p-5-grid')      return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,w3,h2), S(3,w3+g,h2+g,w3,h2), S(4,(w3+g)*2,h2+g,w3,h2)];
  if (layout === 'p-5-strip')     { const bh=H*0.55; const sw=(W-3*g)/4; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3].map(i=>S(i+1,i*(sw+g),bh+g,sw,sh))]; }

  // 6 photos
  if (layout === 'p-6-grid')      return [0,1].flatMap(col=>[0,1,2].map(row=>S(col*3+row, col*(w2+g), row*(h3+g), w2, h3)));
  if (layout === 'p-6-3x2')       return [0,1,2].flatMap(col=>[0,1].map(row=>S(col*2+row, col*(w3+g), row*(h2+g), w3, h2)));
  if (layout === 'p-6-hero')      { const bh=H*0.5; const sw=(W-2*g)/3; const sh2=(H-bh-g-g)/2; return [S(0,0,0,W*0.5,bh), S(1,W*0.5+g,0,W*0.5-g,bh), ...[0,1,2].map(i=>S(i+2,i*(sw+g),bh+g,sw,sh2)), ...[0,1,2].map(i=>S(i+5,i*(sw+g),bh+g+sh2+g,sw,sh2))]; }

  // 7-9 photos
  if (layout === 'p-7-grid')      { const sw=(W-2*g)/3, sh=(H-2*g)/3; return [0,1,2].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(sw+g),row*(sh+g),sw,sh))).concat(S(6,0,(sh+g)*2,W,sh)); }
  if (layout === 'p-8-grid')      return [0,1,2,3].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(w4+g),row*(h2+g),w4,h2)));
  if (layout === 'p-9-grid')      return [0,1,2].flatMap(col=>[0,1,2].map(row=>S(col*3+row,col*(w3+g),row*(h3+g),w3,h3)));

  // Text
  if (layout === 'p-text')        return [];
  if (layout === 'p-text-top')    return [S(0, 0, 0, W, H*0.65)];
  if (layout === 'p-text-bottom') return [S(0, 0, H*0.35, W, H*0.65)];

  // SPREAD layouts (W = full spread width = 2 pages)
  if (layout === 'sp-full')        return [S(0, 0, 0, W, H)];
  if (layout === 'sp-1-left')      return [S(0, 0, 0, W*0.5, H)];
  if (layout === 'sp-1-right')     return [S(0, W*0.5, 0, W*0.5, H)];
  if (layout === 'sp-1-center')    return [S(0, W*0.15, H*0.1, W*0.7, H*0.8)];
  if (layout === 'sp-2-v')         return [S(0, 0, 0, w2, H), S(1, w2+g, 0, w2, H)];
  if (layout === 'sp-2-h')         return [S(0, 0, 0, W, h2), S(1, 0, h2+g, W, h2)];
  if (layout === 'sp-2-big-left')  return [S(0, 0, 0, W*0.65, H), S(1, W*0.65+g, 0, W*0.35-g, H)];
  if (layout === 'sp-2-big-right') return [S(0, 0, 0, W*0.35, H), S(1, W*0.35+g, 0, W*0.65-g, H)];
  if (layout === 'sp-2-big-top')   return [S(0, 0, 0, W, H*0.65), S(1, 0, H*0.65+g, W, H*0.35-g)];
  if (layout === 'sp-2-big-bottom')return [S(0, 0, 0, W, H*0.35), S(1, 0, H*0.35+g, W, H*0.65-g)];
  if (layout === 'sp-3-row')       return [S(0, 0, 0, w3, H), S(1, w3+g, 0, w3, H), S(2, 2*(w3+g), 0, w3, H)];
  if (layout === 'sp-3-col')       return [S(0, 0, 0, W, h3), S(1, 0, h3+g, W, h3), S(2, 0, 2*(h3+g), W, h3)];
  if (layout === 'sp-3-hero-left') return [S(0, 0, 0, W*0.55, H), S(1, W*0.55+g, 0, W*0.45-g, h2), S(2, W*0.55+g, h2+g, W*0.45-g, h2)];
  if (layout === 'sp-3-hero-right')return [S(0, 0, 0, W*0.45, h2), S(1, 0, h2+g, W*0.45, h2), S(2, W*0.45+g, 0, W*0.55-g, H)];
  if (layout === 'sp-3-hero-top')  return [S(0, 0, 0, W, H*0.55), S(1, 0, H*0.55+g, w2, H*0.45-g), S(2, w2+g, H*0.55+g, w2, H*0.45-g)];
  if (layout === 'sp-3-hero-bottom')return [S(0, 0, 0, w2, H*0.45), S(1, w2+g, 0, w2, H*0.45), S(2, 0, H*0.45+g, W, H*0.55-g)];
  if (layout === 'sp-4-grid')      return [S(0, 0, 0, w2, h2), S(1, w2+g, 0, w2, h2), S(2, 0, h2+g, w2, h2), S(3, w2+g, h2+g, w2, h2)];
  if (layout === 'sp-4-hero')      return [S(0, 0, 0, W*0.55, H), S(1, W*0.55+g, 0, W*0.45-g, h3), S(2, W*0.55+g, h3+g, W*0.45-g, h3), S(3, W*0.55+g, 2*(h3+g), W*0.45-g, h3)];
  if (layout === 'sp-4-hero-right')return [S(0, 0, 0, W*0.45-g, h3), S(1, 0, h3+g, W*0.45-g, h3), S(2, 0, 2*(h3+g), W*0.45-g, h3), S(3, W*0.45, 0, W*0.55, H)];
  if (layout === 'sp-4-top-bottom')return [S(0, 0, 0, w2, h2), S(1, w2+g, 0, w2, h2), S(2, 0, h2+g, w2, h2), S(3, w2+g, h2+g, w2, h2)];
  if (layout === 'sp-4-strip-h')   return [S(0, 0, 0, W, h4), S(1, 0, h4+g, W, h4), S(2, 0, 2*(h4+g), W, h4), S(3, 0, 3*(h4+g), W, h4)];
  if (layout === 'sp-5-grid')      return [S(0, 0, 0, w3, h2), S(1, w3+g, 0, w3, h2), S(2, 2*(w3+g), 0, w3, h2), S(3, 0, h2+g, w2, h2), S(4, w2+g, h2+g, w2, h2)];
  if (layout === 'sp-5-hero')      { const bh=H*0.55; const sw=(W-3*g)/4; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3].map(ii=>S(ii+1,ii*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'sp-6-grid')      return [S(0, 0, 0, w3, h2), S(1, w3+g, 0, w3, h2), S(2, 2*(w3+g), 0, w3, h2), S(3, 0, h2+g, w3, h2), S(4, w3+g, h2+g, w3, h2), S(5, 2*(w3+g), h2+g, w3, h2)];
  if (layout === 'sp-1-left-wide') return [S(0, 0, 0, W*0.65, H)];
  if (layout === 'sp-1-right-wide')return [S(0, W*0.35, 0, W*0.65, H)];
  if (layout === 'sp-2-left-pair') return [S(0, 0, 0, w2, h2), S(1, 0, h2+g, w2, h2)];
  if (layout === 'sp-2-right-pair')return [S(0, w2+g, 0, w2, h2), S(1, w2+g, h2+g, w2, h2)];
  if (layout === 'sp-2-diag')      return [S(0, 0, 0, W*0.55, H*0.55), S(1, W*0.45+g, H*0.45+g, W*0.55-g, H*0.55-g)];
  if (layout === 'sp-3-l-shape')   return [S(0, 0, 0, W*0.55, h2), S(1, 0, h2+g, W*0.55, h2), S(2, W*0.55+g, 0, W*0.45-g, H)];
  if (layout === 'sp-3-t-shape')   return [S(0, 0, 0, w2, H*0.45), S(1, w2+g, 0, w2, H*0.45), S(2, W*0.25, H*0.45+g, W*0.5, H*0.55-g)];
  if (layout === 'sp-3-center')    return [S(0, 0, 0, W*0.3, H), S(1, W*0.3+g, 0, W*0.4-2*g, H), S(2, W*0.7, 0, W*0.3, H)];
  if (layout === 'sp-4-strip-v')   { const w4=(W-3*g)/4; return [S(0, 0, 0, w4, H), S(1, w4+g, 0, w4, H), S(2, 2*(w4+g), 0, w4, H), S(3, 3*(w4+g), 0, w4, H)]; }
  if (layout === 'sp-4-mosaic')    return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.6+g, 0, W*0.4-g, H*0.4), S(2, W*0.6+g, H*0.4+g, W*0.4-g, H*0.6-g), S(3, 0, H*0.6+g, W*0.6, H*0.4-g)];
  if (layout === 'sp-4-hero-top')  return [S(0, 0, 0, W, H*0.55), S(1, 0, H*0.55+g, w3, H*0.45-g), S(2, w3+g, H*0.55+g, w3, H*0.45-g), S(3, 2*(w3+g), H*0.55+g, w3, H*0.45-g)];
  if (layout === 'sp-4-hero-bottom')return [S(0, 0, 0, w3, H*0.45), S(1, w3+g, 0, w3, H*0.45), S(2, 2*(w3+g), 0, w3, H*0.45), S(3, 0, H*0.45+g, W, H*0.55-g)];
  if (layout === 'sp-5-quilt')     return [S(0, 0, 0, w2, h2), S(1, w2+g, 0, w2, h2), S(2, 0, h2+g, w3, h2), S(3, w3+g, h2+g, w3, h2), S(4, 2*(w3+g), h2+g, w3, h2)];
  if (layout === 'sp-6-hero')      { const bh=H*0.55; const sw=(W-4*g)/5; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3,4].map(ii=>S(ii+1,ii*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'sp-7-grid')      { const w47=(W-3*g)/4; return [S(0,0,0,w47,h2),S(1,w47+g,0,w47,h2),S(2,2*(w47+g),0,w47,h2),S(3,3*(w47+g),0,w47,h2),S(4,0,h2+g,w3,h2),S(5,w3+g,h2+g,w3,h2),S(6,2*(w3+g),h2+g,w3,h2)]; }
  if (layout === 'sp-8-grid')      { const w48=(W-3*g)/4; return [S(0,0,0,w48,h2),S(1,w48+g,0,w48,h2),S(2,2*(w48+g),0,w48,h2),S(3,3*(w48+g),0,w48,h2),S(4,0,h2+g,w48,h2),S(5,w48+g,h2+g,w48,h2),S(6,2*(w48+g),h2+g,w48,h2),S(7,3*(w48+g),h2+g,w48,h2)]; }

  return [S(0, 0, 0, W, H)];
}
