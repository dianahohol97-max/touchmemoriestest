import * as React from 'react';

export interface SlotDef {
  i: number;
  s: React.CSSProperties;
}

export function getSlotDefs(layout: string, W: number, H: number): SlotDef[] {
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
  if (layout === 'p-5-col-hero')  { const bh=H*0.4; const sw=(W-3*g)/4; return [S(0,0,0,W,bh),...[0,1,2,3].map(i=>S(i+1,i*(sw+g),bh+g,sw,H-bh-g))]; }
  if (layout === 'p-5-2-3')      { const sh=(H-g)/2; const sw2=(W-g)/2; const sw3=(W-2*g)/3; return [S(0,0,0,sw2,sh),S(1,sw2+g,0,sw2,sh),...[0,1,2].map(i=>S(i+2,i*(sw3+g),sh+g,sw3,sh))]; }
  if (layout === 'p-5-3-2')      { const sh=(H-g)/2; const sw3=(W-2*g)/3; const sw2=(W-g)/2; return [...[0,1,2].map(i=>S(i,i*(sw3+g),0,sw3,sh)),S(3,0,sh+g,sw2,sh),S(4,sw2+g,sh+g,sw2,sh)]; }
  if (layout === 'p-5-cross')     { const cw=W*0.4; const ch=H*0.4; const sx=(W-cw)/2; const sy=(H-ch)/2; const sw2=(W-cw-g*2)/2; const sh2=(H-ch-g*2)/2; return [S(0,0,0,sw2,sh2),S(1,W-sw2,0,sw2,sh2),S(2,sx,0,cw,H),S(3,0,H-sh2,sw2,sh2),S(4,W-sw2,H-sh2,sw2,sh2)]; }
  if (layout === 'p-5-l-hero')    { const bw=W*0.55; const sw=(W-bw-g)/2; const sh=(H-g)/2; return [S(0,0,0,bw,H),S(1,bw+g,0,sw,sh),S(2,bw+g+sw+g,0,sw,sh),S(3,bw+g,sh+g,sw,sh),S(4,bw+g+sw+g,sh+g,sw,sh)]; }
  if (layout === 'p-5-r-hero')    { const bw=W*0.55; const sw=(W-bw-g)/2; const sh=(H-g)/2; return [S(0,W-bw,0,bw,H),S(1,0,0,sw,sh),S(2,sw+g,0,sw,sh),S(3,0,sh+g,sw,sh),S(4,sw+g,sh+g,sw,sh)]; }

  // 6 photos
  if (layout === 'p-6-grid')      return [0,1].flatMap(col=>[0,1,2].map(row=>S(col*3+row, col*(w2+g), row*(h3+g), w2, h3)));
  if (layout === 'p-6-3x2')       return [0,1,2].flatMap(col=>[0,1].map(row=>S(col*2+row, col*(w3+g), row*(h2+g), w3, h2)));
  if (layout === 'p-6-hero')      { const bh=H*0.5; const sw=(W-2*g)/3; const sh2=(H-bh-g-g)/2; return [S(0,0,0,W*0.5,bh), S(1,W*0.5+g,0,W*0.5-g,bh), ...[0,1,2].map(i=>S(i+2,i*(sw+g),bh+g,sw,sh2)), ...[0,1,2].map(i=>S(i+5,i*(sw+g),bh+g+sh2+g,sw,sh2))]; }
  if (layout === 'p-6-2col')      { const sw=(W-g)/2; const sh=(H-2*g)/3; return [0,1].flatMap(col=>[0,1,2].map(row=>S(col*3+row,col*(sw+g),row*(sh+g),sw,sh))); }
  if (layout === 'p-6-hero-bot')  { const bh=H*0.5; const sw=(W-2*g)/3; return [...[0,1,2].map(i=>S(i,i*(sw+g),0,sw,bh)), ...[0,1,2].map(i=>S(i+3,i*(sw+g),bh+g,sw,H-bh-g))]; }
  if (layout === 'p-6-strip-h')   { const sw=(W-5*g)/6; return [0,1,2,3,4,5].map(i=>S(i,i*(sw+g),0,sw,H)); }

  // 7 photos
  if (layout === 'p-7-grid')      { const sw=(W-2*g)/3, sh=(H-2*g)/3; return [0,1,2].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(sw+g),row*(sh+g),sw,sh))).concat(S(6,0,(sh+g)*2,W,sh)); }
  if (layout === 'p-7-hero')      { const bh=H*0.5; const sw=(W-2*g)/3; const shs=(H-bh-g)/2-g/2; return [S(0,0,0,W,bh),...[0,1,2].map(i=>S(i+1,i*(sw+g),bh+g,sw,shs)),...[0,1,2].map(i=>S(i+4,i*(sw+g),bh+g+shs+g,sw,shs))]; }

  // 8 photos
  if (layout === 'p-8-grid')      return [0,1,2,3].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(w4+g),row*(h2+g),w4,h2)));
  if (layout === 'p-8-2x4')       { const sw=(W-3*g)/4; const sh=(H-g)/2; return [0,1,2,3].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(sw+g),row*(sh+g),sw,sh))); }

  // 9 photos
  if (layout === 'p-9-grid')      return [0,1,2].flatMap(col=>[0,1,2].map(row=>S(col*3+row,col*(w3+g),row*(h3+g),w3,h3)));
  if (layout === 'p-9-hero')      { const bh=H*0.45; const sw=(W-3*g)/4; const sh=(H-bh-g)/2-g/2; return [S(0,0,0,W*0.5,bh),S(1,W*0.5+g,0,W*0.5-g,bh),...[0,1,2,3].map(i=>S(i+2,i*(sw+g),bh+g,sw,sh)),...[0,1,2,3].map(i=>S(i+6,i*(sw+g),bh+g+sh+g,sw,sh))]; }

  // 10-16 photos (grid layouts)
  if (layout === 'p-10-grid')     { const sw=(W-4*g)/5; const sh=(H-g)/2; return [0,1,2,3,4].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(sw+g),row*(sh+g),sw,sh))); }
  if (layout === 'p-12-grid')     { const sw=(W-3*g)/4; const sh=(H-2*g)/3; return [0,1,2,3].flatMap(col=>[0,1,2].map(row=>S(col*3+row,col*(sw+g),row*(sh+g),sw,sh))); }
  if (layout === 'p-12-3x4')     { const sw=(W-2*g)/3; const sh=(H-3*g)/4; return [0,1,2].flatMap(col=>[0,1,2,3].map(row=>S(col*4+row,col*(sw+g),row*(sh+g),sw,sh))); }
  if (layout === 'p-15-grid')     { const sw=(W-4*g)/5; const sh=(H-2*g)/3; return [0,1,2,3,4].flatMap(col=>[0,1,2].map(row=>S(col*3+row,col*(sw+g),row*(sh+g),sw,sh))); }
  if (layout === 'p-16-grid')     return [0,1,2,3].flatMap(col=>[0,1,2,3].map(row=>S(col*4+row,col*(w4+g),row*((H-3*g)/4+g),w4,(H-3*g)/4)));

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
  if (layout === 'sp-5-strip')     { const w5=(W-4*g)/5; return [S(0,0,0,w5,H),S(1,w5+g,0,w5,H),S(2,2*(w5+g),0,w5,H),S(3,3*(w5+g),0,w5,H),S(4,4*(w5+g),0,w5,H)]; }
  if (layout === 'sp-6-mosaic')    return [S(0,0,0,W*0.4,h3), S(1,0,h3+g,W*0.4,h3), S(2,0,2*(h3+g),W*0.4,h3), S(3,W*0.4+g,0,W*0.6-g,h3), S(4,W*0.4+g,h3+g,W*0.3-g,2*h3+g), S(5,W*0.7,h3+g,W*0.3,2*h3+g)];
  if (layout === 'sp-7-hero')      { const bh=H*0.45; const sw=(W-5*g)/6; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3,4,5].map(ii=>S(ii+1,ii*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'sp-8-mosaic')    { const w6=(W-2*g)/3; return [S(0,0,0,w6,h2),S(1,w6+g,0,w6,h2),S(2,2*(w6+g),0,w6,h2), S(3,0,h2+g,w2,h2),S(4,w2+g,h2+g,(W-4*g)/5,h2),S(5,w2+g+(W-4*g)/5+g,h2+g,(W-4*g)/5,h2),S(6,w2+g+2*((W-4*g)/5+g),h2+g,(W-4*g)/5,h2),S(7,w2+g+3*((W-4*g)/5+g),h2+g,(W-4*g)/5,h2)]; }
  if (layout === 'sp-9-grid')      { const w39=(W-2*g)/3; const h39=(H-2*g)/3; return Array.from({length:9},(_, ii)=>S(ii, (ii%3)*(w39+g), Math.floor(ii/3)*(h39+g), w39, h39)); }
  if (layout === 'sp-10-grid')     { const w510=(W-4*g)/5; return Array.from({length:10},(_, ii)=>S(ii, (ii%5)*(w510+g), Math.floor(ii/5)*(h2+g), w510, h2)); }
  if (layout === 'sp-10-hero')     { const bh=H*0.45; const sw=(W-8*g)/9; const sh=H-bh-g; return [S(0,0,0,W,bh), ...Array.from({length:9},(_,ii)=>S(ii+1,ii*(sw+g),bh+g,sw,sh))]; }
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
  if (layout === 'sp-12-grid')     { const w412=(W-3*g)/4; const h312=(H-2*g)/3; return Array.from({length:12},(_, ii)=>S(ii, (ii%4)*(w412+g), Math.floor(ii/4)*(h312+g), w412, h312)); }

  //  EXTRA PAGE LAYOUTS — fill in the gaps where layouts were declared but had no slot-def. 
  //  Each block here intentionally varies geometry slightly so the cycle through
  //  template arrows actually produces distinct layouts, not 15 visually-identical
  //  grids in a row.

  // 1 photo extras
  if (layout === 'p-1-top-strip')    return [S(0, 0, 0, W, H*0.4)];
  if (layout === 'p-1-bottom-strip') return [S(0, 0, H*0.6, W, H*0.4)];
  if (layout === 'p-1-left-wide')    return [S(0, 0, 0, W*0.7, H)];
  if (layout === 'p-1-right-wide')   return [S(0, W*0.3, 0, W*0.7, H)];
  if (layout === 'p-1-polaroid')     return [S(0, W*0.12, H*0.05, W*0.76, H*0.78)];
  if (layout === 'p-1-portrait')     return [S(0, W*0.18, H*0.06, W*0.64, H*0.88)];
  if (layout === 'p-1-landscape')    return [S(0, W*0.06, H*0.22, W*0.88, H*0.56)];
  if (layout === 'p-1-corner-tl')    return [S(0, 0, 0, W*0.7, H*0.7)];
  if (layout === 'p-1-corner-br')    return [S(0, W*0.3, H*0.3, W*0.7, H*0.7)];
  if (layout === 'p-1-oval')         return [S(0, W*0.1, H*0.1, W*0.8, H*0.8, { borderRadius: '50%' })];
  if (layout === 'p-1-inset-tl')     return [S(0, W*0.05, H*0.05, W*0.9, H*0.9)];
  if (layout === 'p-1-inset-br')     return [S(0, W*0.05, H*0.05, W*0.9, H*0.9)];
  if (layout === 'p-1-wide-center')  return [S(0, 0, H*0.18, W, H*0.64)];
  if (layout === 'p-1-tall-center')  return [S(0, W*0.18, 0, W*0.64, H)];

  // 2 photos extras
  if (layout === 'p-2-overlap')      return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.4, H*0.4, W*0.6, H*0.6)];
  if (layout === 'p-2-top-strip')    return [S(0, 0, 0, W, H*0.3), S(1, 0, H*0.3+g, W, H*0.7-g)];
  if (layout === 'p-2-bottom-strip') return [S(0, 0, 0, W, H*0.7), S(1, 0, H*0.7+g, W, H*0.3-g)];
  if (layout === 'p-2-75-25')        return [S(0, 0, 0, W*0.75, H), S(1, W*0.75+g, 0, W*0.25-g, H)];
  if (layout === 'p-2-25-75')        return [S(0, 0, 0, W*0.25, H), S(1, W*0.25+g, 0, W*0.75-g, H)];
  if (layout === 'p-2-center-pair')  return [S(0, W*0.05, H*0.15, W*0.45-g/2, H*0.7), S(1, W*0.5+g/2, H*0.15, W*0.45-g/2, H*0.7)];
  if (layout === 'p-2-cinema')       { const ch=H*0.4; return [S(0, 0, H*0.08, W, ch), S(1, 0, H*0.52, W, ch)]; }
  if (layout === 'p-2-frame')        return [S(0, 0, 0, W, H*0.7), S(1, W*0.6, H*0.5, W*0.35, H*0.45)];
  if (layout === 'p-2-triptych')     return [S(0, 0, H*0.15, w2, H*0.7), S(1, w2+g, H*0.15, w2, H*0.7)];
  if (layout === 'p-2-asymm-left')   return [S(0, 0, 0, W*0.33, H), S(1, W*0.33+g, 0, W*0.67-g, H)];
  if (layout === 'p-2-asymm-right')  return [S(0, 0, 0, W*0.67, H), S(1, W*0.67+g, 0, W*0.33-g, H)];
  if (layout === 'p-2-stacked-center') return [S(0, W*0.1, 0, W*0.8, h2), S(1, W*0.1, h2+g, W*0.8, h2)];
  if (layout === 'p-2-wide-top')     return [S(0, 0, 0, W, H*0.6), S(1, W*0.25, H*0.62, W*0.5, H*0.36)];

  // 3 photos extras
  if (layout === 'p-3-hero-right')   return [S(0, 0, 0, w2, h2), S(1, 0, h2+g, w2, h2), S(2, w2+g, 0, w2, H)];
  if (layout === 'p-3-strip-top')    return [S(0, 0, 0, W, H*0.3), S(1, 0, H*0.3+g, w2, H*0.7-g), S(2, w2+g, H*0.3+g, w2, H*0.7-g)];
  if (layout === 'p-3-strip-bot')    return [S(0, 0, 0, w2, H*0.7), S(1, w2+g, 0, w2, H*0.7), S(2, 0, H*0.7+g, W, H*0.3-g)];
  if (layout === 'p-3-diagonal')     { const sw=W*0.55; const sh=H*0.4; return [S(0, 0, 0, sw, sh), S(1, W*0.225, H*0.3, sw, sh), S(2, W-sw, H-sh, sw, sh)]; }
  if (layout === 'p-3-mosaic')       return [S(0, 0, 0, W*0.6, H*0.55), S(1, W*0.6+g, 0, W*0.4-g, H*0.55), S(2, 0, H*0.55+g, W, H*0.45-g)];
  if (layout === 'p-3-featured')     return [S(0, 0, H*0.18, W*0.3-g, H*0.64), S(1, W*0.3, 0, W*0.4, H), S(2, W*0.7+g, H*0.18, W*0.3-g, H*0.64)];
  if (layout === 'p-3-panorama')     return [S(0, 0, 0, W, H*0.55), S(1, 0, H*0.55+g, w2, H*0.45-g), S(2, w2+g, H*0.55+g, w2, H*0.45-g)];
  if (layout === 'p-3-fan')          { const sw=W*0.4; const sh=H*0.6; return [S(0, 0, H*0.2, sw, sh), S(1, W*0.3, 0, sw, sh), S(2, W-sw, H*0.2, sw, sh)]; }
  if (layout === 'p-3-asymm')        return [S(0, 0, 0, W*0.55, H*0.45), S(1, W*0.55+g, 0, W*0.45-g, H), S(2, 0, H*0.45+g, W*0.55, H*0.55-g)];
  if (layout === 'p-3-stacked')      return [S(0, 0, 0, W, h3), S(1, W*0.05, h3+g, W*0.9, h3), S(2, W*0.1, 2*(h3+g), W*0.8, h3)];
  if (layout === 'p-3-wide-mid')     return [S(0, 0, 0, W, H*0.27), S(1, 0, H*0.27+g, W, H*0.46), S(2, 0, H*0.73+g, W, H*0.27-g)];
  if (layout === 'p-3-2col')         return [S(0, 0, 0, W*0.55, h2), S(1, 0, h2+g, W*0.55, h2), S(2, W*0.55+g, 0, W*0.45-g, H)];

  // 4 photos extras
  if (layout === 'p-4-mosaic')       return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.6+g, 0, W*0.4-g, H*0.4), S(2, W*0.6+g, H*0.4+g, W*0.4-g, H*0.6-g), S(3, 0, H*0.6+g, W*0.6, H*0.4-g)];
  if (layout === 'p-4-top-bottom')   return [S(0, 0, 0, w2, h2), S(1, w2+g, 0, w2, h2), S(2, 0, h2+g, w2, h2), S(3, w2+g, h2+g, w2, h2)];
  if (layout === 'p-4-corner')       { const cw=W*0.48; const ch=H*0.48; return [S(0, 0, 0, cw, ch), S(1, W-cw, 0, cw, ch), S(2, 0, H-ch, cw, ch), S(3, W-cw, H-ch, cw, ch)]; }
  if (layout === 'p-4-cinema')       { const sh=(H-3*g)/4; return [S(0, 0, 0, W, sh), S(1, 0, sh+g, W, sh), S(2, 0, 2*(sh+g), W, sh), S(3, 0, 3*(sh+g), W, sh)]; }
  if (layout === 'p-4-focus')        return [S(0, 0, 0, W*0.65, H*0.65), S(1, W*0.65+g, 0, W*0.35-g, H*0.32), S(2, W*0.65+g, H*0.34, W*0.35-g, H*0.66-g), S(3, 0, H*0.65+g, W*0.65, H*0.35-g)];
  if (layout === 'p-4-row-top')      { const sw=(W-2*g)/3; return [S(0, 0, 0, sw, h2), S(1, sw+g, 0, sw, h2), S(2, 2*(sw+g), 0, sw, h2), S(3, 0, h2+g, W, h2)]; }
  if (layout === 'p-4-hero-bottom')  { const sw=(W-2*g)/3; return [S(0, 0, 0, sw, h2), S(1, sw+g, 0, sw, h2), S(2, 2*(sw+g), 0, sw, h2), S(3, 0, h2+g, W, h2)]; }
  if (layout === 'p-4-cross')        return [S(0, W*0.2, 0, W*0.6, H*0.4), S(1, 0, H*0.3, W*0.4, H*0.4), S(2, W*0.6, H*0.3, W*0.4, H*0.4), S(3, W*0.2, H*0.6, W*0.6, H*0.4)];
  if (layout === 'p-4-uneven')       return [S(0, 0, 0, W*0.55, H*0.6), S(1, W*0.55+g, 0, W*0.45-g, H*0.4), S(2, W*0.55+g, H*0.4+g, W*0.45-g, H*0.6-g), S(3, 0, H*0.6+g, W*0.55, H*0.4-g)];
  if (layout === 'p-4-diamond')      { const sw=W*0.42; const sh=H*0.42; return [S(0, (W-sw)/2, 0, sw, sh), S(1, 0, (H-sh)/2, sw, sh), S(2, W-sw, (H-sh)/2, sw, sh), S(3, (W-sw)/2, H-sh, sw, sh)]; }
  if (layout === 'p-4-t-shape')      { const sw=(W-2*g)/3; return [S(0, 0, 0, sw, h2), S(1, sw+g, 0, sw, h2), S(2, 2*(sw+g), 0, sw, h2), S(3, W*0.2, h2+g, W*0.6, h2)]; }
  if (layout === 'p-4-asymm-col')    return [S(0, 0, 0, W*0.4, H*0.5), S(1, 0, H*0.5+g, W*0.4, H*0.5-g), S(2, W*0.4+g, 0, W*0.6-g, H*0.65), S(3, W*0.4+g, H*0.65+g, W*0.6-g, H*0.35-g)];
  if (layout === 'p-4-wide-bot')     { const sw=(W-2*g)/3; return [S(0, 0, 0, sw, h2), S(1, sw+g, 0, sw, h2), S(2, 2*(sw+g), 0, sw, h2), S(3, 0, h2+g, W, h2)]; }
  if (layout === 'p-4-center-focus') { const cw=W*0.6; const ch=H*0.6; const sw=(W-cw)/2-g; return [S(0, 0, H*0.2, sw, ch), S(1, (W-cw)/2, 0, cw, H*0.2-g), S(2, W-sw, H*0.2, sw, ch), S(3, (W-cw)/2, H*0.8+g, cw, H*0.2-g)]; }

  // 5 photos extras
  if (layout === 'p-5-col')          { const sh=(H-4*g)/5; return Array.from({length:5}, (_,ii)=>S(ii, 0, ii*(sh+g), W, sh)); }
  if (layout === 'p-5-row')          { const sw=(W-4*g)/5; return Array.from({length:5}, (_,ii)=>S(ii, ii*(sw+g), 0, sw, H)); }
  if (layout === 'p-5-mosaic')       return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.6+g, 0, W*0.4-g, H*0.3-g/2), S(2, W*0.6+g, H*0.3+g/2, W*0.4-g, H*0.3-g/2), S(3, 0, H*0.6+g, W*0.3-g/2, H*0.4-g), S(4, W*0.3+g/2, H*0.6+g, W*0.7-g/2, H*0.4-g)];
  if (layout === 'p-5-focus')        return [S(0, W*0.15, H*0.15, W*0.7, H*0.7), S(1, 0, 0, W*0.15-g, H*0.5), S(2, 0, H*0.5+g, W*0.15-g, H*0.5-g), S(3, W*0.85+g, 0, W*0.15-g, H*0.5), S(4, W*0.85+g, H*0.5+g, W*0.15-g, H*0.5-g)];
  if (layout === 'p-5-big-left')     { const sh=(H-3*g)/4; return [S(0, 0, 0, W*0.55, H), S(1, W*0.55+g, 0, W*0.45-g, sh), S(2, W*0.55+g, sh+g, W*0.45-g, sh), S(3, W*0.55+g, 2*(sh+g), W*0.45-g, sh), S(4, W*0.55+g, 3*(sh+g), W*0.45-g, sh)]; }
  if (layout === 'p-5-big-right')    { const sh=(H-3*g)/4; return [S(0, W*0.45+g, 0, W*0.55-g, H), S(1, 0, 0, W*0.45-g, sh), S(2, 0, sh+g, W*0.45-g, sh), S(3, 0, 2*(sh+g), W*0.45-g, sh), S(4, 0, 3*(sh+g), W*0.45-g, sh)]; }
  if (layout === 'p-5-panorama')     { const sw=(W-3*g)/4; return [S(0, 0, 0, W, H*0.5), S(1, 0, H*0.5+g, sw, H*0.5-g), S(2, sw+g, H*0.5+g, sw, H*0.5-g), S(3, 2*(sw+g), H*0.5+g, sw, H*0.5-g), S(4, 3*(sw+g), H*0.5+g, sw, H*0.5-g)]; }
  if (layout === 'p-5-diagonal')     { const sw=W*0.4; const sh=H*0.3; return [S(0, 0, 0, sw, sh), S(1, W*0.15, H*0.2, sw, sh), S(2, W*0.3, H*0.4, sw, sh), S(3, W*0.45, H*0.6, sw, sh), S(4, W*0.6, H*0.7, sw, sh)]; }
  if (layout === 'p-5-corner')       { const cs=W*0.4; const ch=H*0.4; const cc=W*0.36; return [S(0, 0, 0, cs, ch), S(1, W-cs, 0, cs, ch), S(2, (W-cc)/2, (H-cc)/2, cc, cc), S(3, 0, H-ch, cs, ch), S(4, W-cs, H-ch, cs, ch)]; }
  if (layout === 'p-5-scattered')    { const sw=W*0.35; const sh=H*0.35; return [S(0, W*0.05, H*0.05, sw, sh), S(1, W*0.6, H*0.1, sw, sh), S(2, W*0.32, H*0.35, sw, sh), S(3, 0, H*0.6, sw, sh), S(4, W*0.55, H*0.6, sw, sh)]; }
  if (layout === 'p-5-pyramid')      { const sw=W*0.32; const sh=H*0.45; return [S(0, (W-sw)/2, 0, sw, sh), S(1, 0, sh+g, sw, sh), S(2, (W-sw)/2, sh+g, sw, sh), S(3, W-sw, sh+g, sw, sh), S(4, (W-sw)/2, 0, 0, 0)].slice(0,5).map((x,i)=>i===4?S(4, W*0.34, H*0.55, W*0.32, H*0.4):x); }
  if (layout === 'p-5-2-1-2')        { const sw=(W-g)/2; const ssh=(H-2*g)/3; return [S(0, 0, 0, sw, ssh), S(1, sw+g, 0, sw, ssh), S(2, 0, ssh+g, W, ssh), S(3, 0, 2*(ssh+g), sw, ssh), S(4, sw+g, 2*(ssh+g), sw, ssh)]; }
  if (layout === 'p-5-wide-center')  { const sw=(W-3*g)/4; return [S(0, 0, 0, sw, H*0.3), S(1, sw+g, 0, sw, H*0.3), S(2, 2*(sw+g), 0, sw, H*0.3), S(3, 3*(sw+g), 0, sw, H*0.3), S(4, 0, H*0.3+g, W, H*0.7-g)]; }
  if (layout === 'p-5-editorial')    return [S(0, 0, 0, W*0.6, H*0.55), S(1, W*0.6+g, 0, W*0.4-g, H*0.3), S(2, W*0.6+g, H*0.3+g, W*0.4-g, H*0.55-g), S(3, 0, H*0.55+g, W*0.4-g/2, H*0.45-g), S(4, W*0.4+g/2, H*0.55+g, W*0.6-g/2, H*0.45-g)];

  // 6 photos extras
  if (layout === 'p-6-strip-v')      { const sw=(W-5*g)/6; return Array.from({length:6}, (_,ii)=>S(ii, ii*(sw+g), 0, sw, H)); }
  if (layout === 'p-6-mosaic')       return [S(0, 0, 0, W*0.55, H*0.55), S(1, W*0.55+g, 0, W*0.45-g, H*0.3), S(2, W*0.55+g, H*0.3+g, W*0.45-g, H*0.25-g), S(3, 0, H*0.55+g, W*0.3, H*0.45-g), S(4, W*0.3+g, H*0.55+g, W*0.3, H*0.45-g), S(5, W*0.6+g, H*0.55+g, W*0.4-g, H*0.45-g)];
  if (layout === 'p-6-hero-top')     { const sw=(W-4*g)/5; return [S(0, 0, 0, W, H*0.55), ...Array.from({length:5}, (_,ii)=>S(ii+1, ii*(sw+g), H*0.55+g, sw, H*0.45-g))]; }
  if (layout === 'p-6-hero-left')    { const sh=(H-4*g)/5; return [S(0, 0, 0, W*0.55, H), ...Array.from({length:5}, (_,ii)=>S(ii+1, W*0.55+g, ii*(sh+g), W*0.45-g, sh))]; }
  if (layout === 'p-6-cols')         { const sw=(W-2*g)/3; const sh=(H-g)/2; return [0,1,2].flatMap(col=>[0,1].map(row=>S(col*2+row, col*(sw+g), row*(sh+g), sw, sh))); }
  if (layout === 'p-6-focus')        { const ssw=(W-2*g)/3; const ssh=(H-2*g)/3; return [S(0, ssw+g, ssh+g, ssw, ssh), S(1, 0, 0, ssw, ssh), S(2, ssw+g, 0, ssw, ssh), S(3, 2*(ssw+g), 0, ssw, ssh), S(4, 0, ssh+g, ssw, ssh), S(5, 2*(ssw+g), ssh+g, ssw, ssh)]; }
  if (layout === 'p-6-2-4')          { const sw=(W-3*g)/4; return [S(0, 0, 0, w2, H*0.5), S(1, w2+g, 0, w2, H*0.5), S(2, 0, H*0.5+g, sw, H*0.5-g), S(3, sw+g, H*0.5+g, sw, H*0.5-g), S(4, 2*(sw+g), H*0.5+g, sw, H*0.5-g), S(5, 3*(sw+g), H*0.5+g, sw, H*0.5-g)]; }
  if (layout === 'p-6-4-2')          { const sw=(W-3*g)/4; return [S(0, 0, 0, sw, H*0.5), S(1, sw+g, 0, sw, H*0.5), S(2, 2*(sw+g), 0, sw, H*0.5), S(3, 3*(sw+g), 0, sw, H*0.5), S(4, 0, H*0.5+g, w2, H*0.5-g), S(5, w2+g, H*0.5+g, w2, H*0.5-g)]; }
  if (layout === 'p-6-diagonal')     { const sw=W*0.32; const sh=H*0.25; return Array.from({length:6}, (_,ii)=>S(ii, ii*W*0.12, ii*H*0.13, sw, sh)); }
  if (layout === 'p-6-magazine')     return [S(0, 0, 0, W*0.6, H*0.5), S(1, W*0.6+g, 0, W*0.4-g, H*0.25), S(2, W*0.6+g, H*0.25+g, W*0.4-g, H*0.25-g), S(3, 0, H*0.5+g, W*0.3, H*0.5-g), S(4, W*0.3+g, H*0.5+g, W*0.3, H*0.5-g), S(5, W*0.6+g, H*0.5+g, W*0.4-g, H*0.5-g)];
  if (layout === 'p-6-uneven')       return [S(0, 0, 0, W*0.5, H*0.6), S(1, W*0.5+g, 0, W*0.5-g, H*0.35), S(2, W*0.5+g, H*0.35+g, W*0.25-g/2, H*0.25), S(3, W*0.75+g/2, H*0.35+g, W*0.25-g/2, H*0.25), S(4, 0, H*0.6+g, W*0.5, H*0.4-g), S(5, W*0.5+g, H*0.6+g, W*0.5-g, H*0.4-g)];
  if (layout === 'p-6-editorial')    return [S(0, 0, 0, W, H*0.4), S(1, 0, H*0.4+g, W*0.4, H*0.6-g), S(2, W*0.4+g, H*0.4+g, W*0.3-g, H*0.3), S(3, W*0.7, H*0.4+g, W*0.3, H*0.3), S(4, W*0.4+g, H*0.7+g, W*0.3-g, H*0.3-g), S(5, W*0.7, H*0.7+g, W*0.3, H*0.3-g)];
  if (layout === 'p-6-3rows')        { const sw=(W-g)/2; const sh=(H-2*g)/3; return [0,1,2].flatMap(row=>[0,1].map(col=>S(row*2+col, col*(sw+g), row*(sh+g), sw, sh))); }
  if (layout === 'p-6-asymm')        return [S(0, 0, 0, W*0.4, H*0.6), S(1, W*0.4+g, 0, W*0.6-g, H*0.4), S(2, 0, H*0.6+g, W*0.6, H*0.4-g), S(3, W*0.6+g, H*0.4+g, W*0.4-g, H*0.3), S(4, W*0.6+g, H*0.7+g, W*0.2-g/2, H*0.3-g), S(5, W*0.8+g/2, H*0.7+g, W*0.2-g/2, H*0.3-g)];
  if (layout === 'p-6-pyramid')      { const sw=W*0.3; const sh=H*0.45; return [S(0, (W-sw)/2, 0, sw, sh), S(1, W*0.05, sh+g, sw, sh-g), S(2, W*0.35, sh+g, sw, sh-g), S(3, W*0.65, sh+g, sw, sh-g), S(4, 0, 0, W*0.2, sh-g), S(5, W*0.8, 0, W*0.2, sh-g)]; }
  if (layout === 'p-6-center-hero')  { const cw=W*0.5; const ch=H*0.5; const sw=(W-cw)/2-g; const sh=(H-ch)/2-g; return [S(0, (W-cw)/2, (H-ch)/2, cw, ch), S(1, 0, 0, sw, sh+ch+g), S(2, W-sw, 0, sw, sh+ch+g), S(3, sw+g, 0, cw, sh), S(4, sw+g, sh+ch+g+g, cw/2-g/2, sh), S(5, sw+g+cw/2+g/2, sh+ch+g+g, cw/2-g/2, sh)]; }

  // 7 photos extras
  if (layout === 'p-7-3-4')          { const sw3=(W-2*g)/3; const sw4=(W-3*g)/4; return [S(0, 0, 0, sw3, h2), S(1, sw3+g, 0, sw3, h2), S(2, 2*(sw3+g), 0, sw3, h2), S(3, 0, h2+g, sw4, h2), S(4, sw4+g, h2+g, sw4, h2), S(5, 2*(sw4+g), h2+g, sw4, h2), S(6, 3*(sw4+g), h2+g, sw4, h2)]; }
  if (layout === 'p-7-4-3')          { const sw3=(W-2*g)/3; const sw4=(W-3*g)/4; return [S(0, 0, 0, sw4, h2), S(1, sw4+g, 0, sw4, h2), S(2, 2*(sw4+g), 0, sw4, h2), S(3, 3*(sw4+g), 0, sw4, h2), S(4, 0, h2+g, sw3, h2), S(5, sw3+g, h2+g, sw3, h2), S(6, 2*(sw3+g), h2+g, sw3, h2)]; }
  if (layout === 'p-7-mosaic')       return [S(0, 0, 0, W*0.55, H*0.5), S(1, W*0.55+g, 0, W*0.45-g, H*0.25), S(2, W*0.55+g, H*0.25+g, W*0.45-g, H*0.25-g), S(3, 0, H*0.5+g, W*0.3, H*0.5-g), S(4, W*0.3+g, H*0.5+g, W*0.3, H*0.5-g), S(5, W*0.6+g, H*0.5+g, W*0.2-g/2, H*0.5-g), S(6, W*0.8+g/2, H*0.5+g, W*0.2-g/2, H*0.5-g)];
  if (layout === 'p-7-col')          { const sh=(H-6*g)/7; return Array.from({length:7}, (_,ii)=>S(ii, 0, ii*(sh+g), W, sh)); }
  if (layout === 'p-7-big-top')      { const sw=(W-2*g)/3; return [S(0, 0, 0, W, H*0.55), S(1, 0, H*0.55+g, sw, H*0.225-g/2), S(2, sw+g, H*0.55+g, sw, H*0.225-g/2), S(3, 2*(sw+g), H*0.55+g, sw, H*0.225-g/2), S(4, 0, H*0.775+g/2, sw, H*0.225-g/2), S(5, sw+g, H*0.775+g/2, sw, H*0.225-g/2), S(6, 2*(sw+g), H*0.775+g/2, sw, H*0.225-g/2)]; }
  if (layout === 'p-7-cols')         { const sh4=(H-3*g)/4; const sh3=(H-2*g)/3; return [S(0, 0, 0, w2, sh4), S(1, 0, sh4+g, w2, sh4), S(2, 0, 2*(sh4+g), w2, sh4), S(3, 0, 3*(sh4+g), w2, sh4), S(4, w2+g, 0, w2, sh3), S(5, w2+g, sh3+g, w2, sh3), S(6, w2+g, 2*(sh3+g), w2, sh3)]; }
  if (layout === 'p-7-strip')        { const sh=(H-6*g)/7; return Array.from({length:7}, (_,ii)=>S(ii, 0, ii*(sh+g), W, sh)); }
  if (layout === 'p-7-focus')        { const sw=(W-2*g)/3; const sh=(H-2*g)/3; return [S(0, sw+g, sh+g, sw, sh), S(1, 0, 0, sw, sh), S(2, sw+g, 0, sw, sh), S(3, 2*(sw+g), 0, sw, sh), S(4, 0, sh+g, sw, sh), S(5, 2*(sw+g), sh+g, sw, sh), S(6, 0, 2*(sh+g), W, sh)]; }
  if (layout === 'p-7-row')          { const sw=(W-6*g)/7; return Array.from({length:7}, (_,ii)=>S(ii, ii*(sw+g), 0, sw, H)); }
  if (layout === 'p-7-col-full')     { const sh=(H-6*g)/7; return Array.from({length:7}, (_,ii)=>S(ii, 0, ii*(sh+g), W, sh)); }
  if (layout === 'p-7-panorama')     { const sw=(W-2*g)/3; return [S(0, 0, 0, W, H*0.45), S(1, 0, H*0.45+g, sw, H*0.275-g/2), S(2, sw+g, H*0.45+g, sw, H*0.275-g/2), S(3, 2*(sw+g), H*0.45+g, sw, H*0.275-g/2), S(4, 0, H*0.725+g/2, sw, H*0.275-g/2), S(5, sw+g, H*0.725+g/2, sw, H*0.275-g/2), S(6, 2*(sw+g), H*0.725+g/2, sw, H*0.275-g/2)]; }
  if (layout === 'p-7-magazine')     return [S(0, 0, 0, W, H*0.4), S(1, 0, H*0.4+g, W*0.5, H*0.3), S(2, W*0.5+g, H*0.4+g, W*0.5-g, H*0.3), S(3, 0, H*0.7+g, W*0.25, H*0.3-g), S(4, W*0.25+g, H*0.7+g, W*0.25-g, H*0.3-g), S(5, W*0.5+g, H*0.7+g, W*0.25-g, H*0.3-g), S(6, W*0.75+g, H*0.7+g, W*0.25-g, H*0.3-g)];
  if (layout === 'p-7-diagonal')     { const sw=W*0.32; const sh=H*0.22; return Array.from({length:7}, (_,ii)=>S(ii, ii*W*0.1, ii*H*0.11, sw, sh)); }

  // 8 photos extras
  if (layout === 'p-8-hero')         { const sw=(W-3*g)/4; const sh=(H-3*g)/4; return [S(0, 0, 0, W, H*0.5), S(1, 0, H*0.5+g, sw, sh), S(2, sw+g, H*0.5+g, sw, sh), S(3, 2*(sw+g), H*0.5+g, sw, sh), S(4, 3*(sw+g), H*0.5+g, sw, sh), S(5, 0, H*0.5+g+sh+g, sw, sh), S(6, sw+g, H*0.5+g+sh+g, sw, sh), S(7, 2*(sw+g), H*0.5+g+sh+g, sw, sh)].slice(0,8); }
  if (layout === 'p-8-mosaic')       return [S(0, 0, 0, W*0.5, H*0.5), S(1, W*0.5+g, 0, W*0.25-g/2, H*0.25), S(2, W*0.75+g/2, 0, W*0.25-g/2, H*0.25), S(3, W*0.5+g, H*0.25+g, W*0.5-g, H*0.25-g), S(4, 0, H*0.5+g, W*0.25, H*0.5-g), S(5, W*0.25+g, H*0.5+g, W*0.25-g, H*0.5-g), S(6, W*0.5+g, H*0.5+g, W*0.25-g/2, H*0.5-g), S(7, W*0.75+g/2, H*0.5+g, W*0.25-g/2, H*0.5-g)];
  if (layout === 'p-8-strip-v')      { const sw=(W-7*g)/8; return Array.from({length:8}, (_,ii)=>S(ii, ii*(sw+g), 0, sw, H)); }
  if (layout === 'p-8-focus')        { const sw=(W-2*g)/3; const sh=(H-2*g)/3; return [S(0, sw+g, sh+g, sw, sh), S(1, 0, 0, sw, sh), S(2, sw+g, 0, sw, sh), S(3, 2*(sw+g), 0, sw, sh), S(4, 0, sh+g, sw, sh), S(5, 2*(sw+g), sh+g, sw, sh), S(6, 0, 2*(sh+g), w2, sh), S(7, w2+g, 2*(sh+g), w2, sh)]; }
  if (layout === 'p-8-cols')         { const sh4=(H-3*g)/4; return [0,1].flatMap(col=>[0,1,2,3].map(row=>S(col*4+row, col*(w2+g), row*(sh4+g), w2, sh4))); }
  if (layout === 'p-8-row')          { const sw=(W-7*g)/8; return Array.from({length:8}, (_,ii)=>S(ii, ii*(sw+g), 0, sw, H)); }
  if (layout === 'p-8-col')          { const sh=(H-7*g)/8; return Array.from({length:8}, (_,ii)=>S(ii, 0, ii*(sh+g), W, sh)); }
  if (layout === 'p-8-4-4')          { const sw=(W-3*g)/4; return [...Array.from({length:4}, (_,ii)=>S(ii, ii*(sw+g), 0, sw, h2)), ...Array.from({length:4}, (_,ii)=>S(ii+4, ii*(sw+g), h2+g, sw, h2))]; }
  if (layout === 'p-8-big-top')      { const sw=(W-3*g)/4; const sh=(H-H*0.5-2*g)/2; return [S(0, 0, 0, W, H*0.5), ...Array.from({length:4}, (_,ii)=>S(ii+1, ii*(sw+g), H*0.5+g, sw, sh)), ...Array.from({length:3}, (_,ii)=>S(ii+5, ii*(sw+g), H*0.5+g+sh+g, sw, sh))]; }
  if (layout === 'p-8-big-left')     { const sh=(H-3*g)/4; return [S(0, 0, 0, W*0.5, H), ...Array.from({length:7}, (_,ii)=>{ const col=ii%2; const row=Math.floor(ii/2); return S(ii+1, W*0.5+g+col*((W*0.5-g)/2+g), row*(sh+g), (W*0.5-g)/2-g/2, sh); }).slice(0,7)].slice(0,8); }
  if (layout === 'p-8-panorama')     { const sw=(W-3*g)/4; const sh=(H-H*0.4-2*g)/2; return [S(0, 0, 0, W, H*0.4), ...Array.from({length:4}, (_,ii)=>S(ii+1, ii*(sw+g), H*0.4+g, sw, sh)), ...Array.from({length:3}, (_,ii)=>S(ii+5, ii*(sw+g), H*0.4+g+sh+g, sw, sh))]; }
  if (layout === 'p-8-uneven')       { const sw=(W-2*g)/3; const sh=(H-3*g)/4; return [S(0, 0, 0, W*0.55, H*0.55), S(1, W*0.55+g, 0, W*0.45-g, H*0.275), S(2, W*0.55+g, H*0.275+g, W*0.45-g, H*0.275-g), S(3, 0, H*0.55+g, sw, sh), S(4, sw+g, H*0.55+g, sw, sh), S(5, 2*(sw+g), H*0.55+g, sw, sh), S(6, 0, H*0.55+g+sh+g, w2, sh), S(7, w2+g, H*0.55+g+sh+g, w2, sh)]; }
  if (layout === 'p-8-cross')        return [S(0, W*0.25, 0, W*0.5, H*0.25), S(1, 0, H*0.25, W*0.25, H*0.5), S(2, W*0.25, H*0.25, W*0.25-g/2, H*0.25-g/2), S(3, W*0.5+g/2, H*0.25, W*0.25-g/2, H*0.25-g/2), S(4, W*0.25, H*0.5+g/2, W*0.25-g/2, H*0.25-g/2), S(5, W*0.5+g/2, H*0.5+g/2, W*0.25-g/2, H*0.25-g/2), S(6, W*0.75, H*0.25, W*0.25, H*0.5), S(7, W*0.25, H*0.75, W*0.5, H*0.25)];
  if (layout === 'p-8-3-5')          { const sw3=(W-2*g)/3; const sw5=(W-4*g)/5; return [S(0, 0, 0, sw3, H*0.4), S(1, sw3+g, 0, sw3, H*0.4), S(2, 2*(sw3+g), 0, sw3, H*0.4), ...Array.from({length:5}, (_,ii)=>S(ii+3, ii*(sw5+g), H*0.4+g, sw5, H*0.6-g))]; }
  if (layout === 'p-8-5-3')          { const sw3=(W-2*g)/3; const sw5=(W-4*g)/5; return [...Array.from({length:5}, (_,ii)=>S(ii, ii*(sw5+g), 0, sw5, H*0.6-g)), S(5, 0, H*0.6, sw3, H*0.4), S(6, sw3+g, H*0.6, sw3, H*0.4), S(7, 2*(sw3+g), H*0.6, sw3, H*0.4)]; }
  if (layout === 'p-8-magazine')     return [S(0, 0, 0, W*0.6, H*0.4), S(1, W*0.6+g, 0, W*0.4-g, H*0.2), S(2, W*0.6+g, H*0.2+g, W*0.4-g, H*0.2-g), S(3, 0, H*0.4+g, W*0.4, H*0.3), S(4, W*0.4+g, H*0.4+g, W*0.3-g/2, H*0.3), S(5, W*0.7+g/2, H*0.4+g, W*0.3-g/2, H*0.3), S(6, 0, H*0.7+g, w2, H*0.3-g), S(7, w2+g, H*0.7+g, w2, H*0.3-g)];
  if (layout === 'p-8-strip-h')      { const sh=(H-7*g)/8; return Array.from({length:8}, (_,ii)=>S(ii, 0, ii*(sh+g), W, sh)); }
  if (layout === 'p-8-corner')       { const sw=W*0.25; const sh=H*0.25; return [S(0, W*0.25, H*0.25, W*0.5, H*0.5), S(1, 0, 0, sw, sh), S(2, W*0.375, 0, sw, sh), S(3, W-sw, 0, sw, sh), S(4, 0, H*0.375, sw, sh), S(5, W-sw, H*0.375, sw, sh), S(6, 0, H-sh, sw, sh), S(7, W-sw, H-sh, sw, sh)]; }
  if (layout === 'p-8-diagonal')     { const sw=W*0.28; const sh=H*0.22; return Array.from({length:8}, (_,ii)=>S(ii, ii*W*0.09, ii*H*0.1, sw, sh)); }

  // 9 photos extras (p-9-grid is already implemented above)
  if (layout === 'p-9-mosaic')       return [S(0, 0, 0, W*0.5, H*0.5), S(1, W*0.5+g, 0, W*0.25-g/2, H*0.25), S(2, W*0.75+g/2, 0, W*0.25-g/2, H*0.25), S(3, W*0.5+g, H*0.25+g, W*0.5-g, H*0.25-g), S(4, 0, H*0.5+g, W*0.25, H*0.5-g), S(5, W*0.25+g, H*0.5+g, W*0.25-g, H*0.25), S(6, W*0.25+g, H*0.75+g, W*0.25-g, H*0.25-g), S(7, W*0.5+g, H*0.5+g, W*0.5-g, H*0.25), S(8, W*0.5+g, H*0.75+g, W*0.5-g, H*0.25-g)];
  if (layout === 'p-9-strip')        { const sh=(H-8*g)/9; return Array.from({length:9}, (_,ii)=>S(ii, 0, ii*(sh+g), W, sh)); }
  if (layout === 'p-9-focus')        { const sw=(W-2*g)/3; const sh=(H-2*g)/3; return [S(0, sw+g, sh+g, sw, sh), ...[[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]].map(([cc,rr], ii)=>S(ii+1, cc*(sw+g), rr*(sh+g), sw, sh))]; }
  if (layout === 'p-9-cols')         { const sh=(H-2*g)/3; return [0,1,2].flatMap(col=>[0,1,2].map(row=>S(col*3+row, col*(w3+g), row*(sh+g), w3, sh))); }
  if (layout === 'p-9-3-3-3')        { const sw=(W-2*g)/3; const sh=(H-2*g)/3; return [0,1,2].flatMap(row=>[0,1,2].map(col=>S(row*3+col, col*(sw+g), row*(sh+g), sw, sh))); }
  if (layout === 'p-9-hero-top')     { const sw=(W-3*g)/4; const sh=(H-H*0.5-2*g)/2; return [S(0, 0, 0, W, H*0.5), ...Array.from({length:4}, (_,ii)=>S(ii+1, ii*(sw+g), H*0.5+g, sw, sh)), ...Array.from({length:4}, (_,ii)=>S(ii+5, ii*(sw+g), H*0.5+g+sh+g, sw, sh))]; }
  if (layout === 'p-9-big-left')     { const sh=(H-3*g)/4; const ssw=(W*0.5-g)/2; return [S(0, 0, 0, W*0.5, H), ...Array.from({length:8}, (_,ii)=>{ const col=ii%2; const row=Math.floor(ii/2); return S(ii+1, W*0.5+g+col*(ssw+g), row*(sh+g), ssw, sh); })]; }
  if (layout === 'p-9-magazine')     return [S(0, 0, 0, W, H*0.35), S(1, 0, H*0.35+g, W*0.4, H*0.4), S(2, W*0.4+g, H*0.35+g, W*0.3-g, H*0.4), S(3, W*0.7, H*0.35+g, W*0.3, H*0.2), S(4, W*0.7, H*0.55+g, W*0.3, H*0.2-g), S(5, 0, H*0.75+g, W*0.25, H*0.25-g), S(6, W*0.25+g, H*0.75+g, W*0.25-g, H*0.25-g), S(7, W*0.5+g, H*0.75+g, W*0.25-g, H*0.25-g), S(8, W*0.75+g, H*0.75+g, W*0.25-g, H*0.25-g)];
  if (layout === 'p-9-diagonal')     { const sw=W*0.28; const sh=H*0.2; return Array.from({length:9}, (_,ii)=>S(ii, ii*W*0.085, ii*H*0.09, sw, sh)); }
  if (layout === 'p-9-4-5')          { const sw4=(W-3*g)/4; const sw5=(W-4*g)/5; return [...Array.from({length:4}, (_,ii)=>S(ii, ii*(sw4+g), 0, sw4, H*0.45-g/2)), ...Array.from({length:5}, (_,ii)=>S(ii+4, ii*(sw5+g), H*0.45+g/2, sw5, H*0.55-g/2))]; }
  if (layout === 'p-9-5-4')          { const sw4=(W-3*g)/4; const sw5=(W-4*g)/5; return [...Array.from({length:5}, (_,ii)=>S(ii, ii*(sw5+g), 0, sw5, H*0.5-g/2)), ...Array.from({length:4}, (_,ii)=>S(ii+5, ii*(sw4+g), H*0.5+g/2, sw4, H*0.5-g/2))]; }
  if (layout === 'p-9-strip-h')      { const sh=(H-8*g)/9; return Array.from({length:9}, (_,ii)=>S(ii, 0, ii*(sh+g), W, sh)); }
  if (layout === 'p-9-4-rows')       { const sw4=(W-3*g)/4; const sw3=(W-2*g)/3; const sw2=(W-g)/2; const sh=(H-3*g)/4; return [...Array.from({length:4}, (_,ii)=>S(ii, ii*(sw4+g), 0, sw4, sh)), ...Array.from({length:3}, (_,ii)=>S(ii+4, ii*(sw3+g), sh+g, sw3, sh)), S(7, 0, 2*(sh+g), sw2, sh*2+g), S(8, sw2+g, 2*(sh+g), sw2, sh*2+g)]; }
  if (layout === 'p-9-big-center')   { const sw=(W-2*g)/3; const sh=(H-2*g)/3; return [S(0, sw+g, sh+g, sw, sh), S(1, 0, 0, sw, sh), S(2, sw+g, 0, sw, sh), S(3, 2*(sw+g), 0, sw, sh), S(4, 0, sh+g, sw, sh), S(5, 2*(sw+g), sh+g, sw, sh), S(6, 0, 2*(sh+g), sw, sh), S(7, sw+g, 2*(sh+g), sw, sh), S(8, 2*(sw+g), 2*(sh+g), sw, sh)]; }
  if (layout === 'p-9-2col-asym')    { const sh=(H-3*g)/4; const sh3=(H-2*g)/3; return [S(0, 0, 0, W*0.4, sh), S(1, 0, sh+g, W*0.4, sh), S(2, 0, 2*(sh+g), W*0.4, sh), S(3, 0, 3*(sh+g), W*0.4, sh), S(4, W*0.4+g, 0, W*0.6-g, sh3), S(5, W*0.4+g, sh3+g, (W*0.6-g)/2-g/2, sh3), S(6, W*0.4+g+(W*0.6-g)/2+g/2, sh3+g, (W*0.6-g)/2-g/2, sh3), S(7, W*0.4+g, 2*(sh3+g), (W*0.6-g)/2-g/2, sh3), S(8, W*0.4+g+(W*0.6-g)/2+g/2, 2*(sh3+g), (W*0.6-g)/2-g/2, sh3)]; }
  if (layout === 'p-9-cross')        { const sw=W*0.25; const sh=H*0.25; return [S(0, W*0.375, H*0.375, sw, sh), S(1, 0, 0, sw, sh), S(2, W*0.375, 0, sw, sh), S(3, W*0.75, 0, sw, sh), S(4, 0, H*0.375, sw, sh), S(5, W*0.75, H*0.375, sw, sh), S(6, 0, H*0.75, sw, sh), S(7, W*0.375, H*0.75, sw, sh), S(8, W*0.75, H*0.75, sw, sh)]; }
  if (layout === 'p-9-editorial')    return [S(0, 0, 0, W*0.6, H*0.5), S(1, W*0.6+g, 0, W*0.4-g, H*0.25), S(2, W*0.6+g, H*0.25+g, W*0.4-g, H*0.25-g), S(3, 0, H*0.5+g, W*0.3, H*0.25), S(4, W*0.3+g, H*0.5+g, W*0.3-g, H*0.25), S(5, W*0.6+g, H*0.5+g, W*0.4-g, H*0.25), S(6, 0, H*0.75+g, W*0.25, H*0.25-g), S(7, W*0.25+g, H*0.75+g, W*0.4-g, H*0.25-g), S(8, W*0.65+g, H*0.75+g, W*0.35-g, H*0.25-g)];
  if (layout === 'p-9-zigzag')       { const sw=W*0.3; const sh=H*0.18; return Array.from({length:9}, (_,ii)=>S(ii, (ii%2===0?0:W-sw), ii*H*0.1, sw, sh)); }

  // 10-16 photos extras (p-10-grid, p-12-grid etc are already implemented above)

  // SPREAD layouts extras
  if (layout === 'sp-1-polaroid')    return [S(0, W*0.15, H*0.05, W*0.7, H*0.85)];
  if (layout === 'sp-1-portrait')    return [S(0, W*0.25, H*0.05, W*0.5, H*0.9)];
  if (layout === 'sp-1-landscape')   return [S(0, W*0.05, H*0.2, W*0.9, H*0.6)];
  if (layout === 'sp-1-corner-tl')   return [S(0, 0, 0, W*0.7, H*0.7)];
  if (layout === 'sp-1-corner-br')   return [S(0, W*0.3, H*0.3, W*0.7, H*0.7)];
  if (layout === 'sp-1-left-strip')  return [S(0, 0, 0, W*0.4, H)];
  if (layout === 'sp-1-right-strip') return [S(0, W*0.6, 0, W*0.4, H)];
  if (layout === 'sp-1-tilt-left')   return [S(0, 0, 0, W*0.85, H)];
  if (layout === 'sp-1-tilt-right')  return [S(0, W*0.15, 0, W*0.85, H)];
  if (layout === 'sp-1-wide-strip')  return [S(0, 0, H*0.25, W, H*0.5)];
  if (layout === 'sp-1-panorama')    return [S(0, 0, H*0.15, W, H*0.7)];
  if (layout === 'sp-1-inset')       return [S(0, W*0.05, H*0.05, W*0.9, H*0.9)];

  if (layout === 'sp-2-triptych')    return [S(0, W*0.05, H*0.1, W*0.45-g/2, H*0.8), S(1, W*0.5+g/2, H*0.1, W*0.45-g/2, H*0.8)];
  if (layout === 'sp-2-overlap')     return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.4, H*0.4, W*0.6, H*0.6)];
  if (layout === 'sp-2-frame')       return [S(0, W*0.05, H*0.05, W*0.45-g/2, H*0.9), S(1, W*0.5+g/2, H*0.05, W*0.45-g/2, H*0.9)];
  if (layout === 'sp-2-stacked-left')  return [S(0, 0, 0, W*0.5, h2), S(1, 0, h2+g, W*0.5, h2)];
  if (layout === 'sp-2-stacked-right') return [S(0, W*0.5+g, 0, W*0.5-g, h2), S(1, W*0.5+g, h2+g, W*0.5-g, h2)];
  if (layout === 'sp-2-panorama-pair') return [S(0, 0, H*0.1, W*0.5, H*0.8), S(1, W*0.5+g, H*0.1, W*0.5-g, H*0.8)];
  if (layout === 'sp-2-asymm-top')   return [S(0, 0, 0, W*0.65, H), S(1, W*0.65+g, H*0.2, W*0.35-g, H*0.6)];
  if (layout === 'sp-2-inset-small') return [S(0, 0, 0, W, H), S(1, W*0.7, H*0.6, W*0.25, H*0.3)];

  if (layout === 'sp-3-magazine')    return [S(0, 0, 0, W*0.5, H), S(1, W*0.5+g, 0, W*0.5-g, h2), S(2, W*0.5+g, h2+g, W*0.5-g, h2)];
  if (layout === 'sp-3-focus')       return [S(0, 0, 0, W*0.7, H), S(1, W*0.7+g, 0, W*0.3-g, h2), S(2, W*0.7+g, h2+g, W*0.3-g, h2)];
  if (layout === 'sp-3-diagonal')    { const sw=W*0.4; const sh=H*0.4; return [S(0, 0, 0, sw, sh), S(1, W*0.3, H*0.3, sw, sh), S(2, W-sw, H-sh, sw, sh)]; }
  if (layout === 'sp-3-editorial')   return [S(0, 0, 0, W*0.6, H*0.65), S(1, W*0.6+g, 0, W*0.4-g, H), S(2, 0, H*0.65+g, W*0.6, H*0.35-g)];
  if (layout === 'sp-3-scattered')   { const sw=W*0.35; const sh=H*0.45; return [S(0, W*0.05, H*0.05, sw, sh), S(1, W*0.55, H*0.15, sw, sh), S(2, W*0.3, H*0.5, sw, sh)]; }
  if (layout === 'sp-3-asymm-wide')  return [S(0, 0, 0, W*0.5, H), S(1, W*0.5+g, 0, W*0.5-g, H*0.4), S(2, W*0.5+g, H*0.4+g, W*0.5-g, H*0.6-g)];
  if (layout === 'sp-3-two-col')     return [S(0, 0, 0, W*0.5, h2), S(1, 0, h2+g, W*0.5, h2), S(2, W*0.5+g, 0, W*0.5-g, H)];
  if (layout === 'sp-3-one-two')     return [S(0, 0, 0, W*0.5, H), S(1, W*0.5+g, 0, W*0.5-g, h2), S(2, W*0.5+g, h2+g, W*0.5-g, h2)];

  if (layout === 'sp-4-magazine')    return [S(0, 0, 0, W*0.6, H*0.5), S(1, W*0.6+g, 0, W*0.4-g, H*0.5), S(2, 0, H*0.5+g, W*0.4, H*0.5-g), S(3, W*0.4+g, H*0.5+g, W*0.6-g, H*0.5-g)];
  if (layout === 'sp-4-diagonal')    { const sw=W*0.3; const sh=H*0.3; return [S(0, 0, 0, sw, sh), S(1, W*0.25, H*0.2, sw, sh), S(2, W*0.5, H*0.5, sw, sh), S(3, W*0.7, H*0.7, sw, sh)]; }
  if (layout === 'sp-4-uneven')      return [S(0, 0, 0, W*0.55, H*0.55), S(1, W*0.55+g, 0, W*0.45-g, H*0.4), S(2, W*0.55+g, H*0.4+g, W*0.45-g, H*0.6-g), S(3, 0, H*0.55+g, W*0.55, H*0.45-g)];
  if (layout === 'sp-4-editorial')   return [S(0, 0, 0, W*0.55, H), S(1, W*0.55+g, 0, W*0.45-g, H*0.35), S(2, W*0.55+g, H*0.35+g, W*0.45-g, H*0.3), S(3, W*0.55+g, H*0.65+g, W*0.45-g, H*0.35-g)];
  if (layout === 'sp-4-pyramid')     { const sw=W*0.25; const sh=H*0.45; return [S(0, (W-sw)/2, 0, sw, sh), S(1, W*0.1, sh+g, sw, sh-g), S(2, W*0.4, sh+g, sw, sh-g), S(3, W*0.7, sh+g, sw, sh-g)]; }
  if (layout === 'sp-4-scattered')   { const sw=W*0.32; const sh=H*0.42; return [S(0, W*0.05, H*0.05, sw, sh), S(1, W*0.55, H*0.05, sw, sh), S(2, W*0.05, H*0.55, sw, sh), S(3, W*0.55, H*0.55, sw, sh)]; }
  if (layout === 'sp-4-2-2')         return [S(0, 0, 0, W*0.5, h2), S(1, 0, h2+g, W*0.5, h2), S(2, W*0.5+g, 0, W*0.5-g, h2), S(3, W*0.5+g, h2+g, W*0.5-g, h2)];
  if (layout === 'sp-4-asymm-wide')  return [S(0, 0, 0, W*0.55, H*0.6), S(1, W*0.55+g, 0, W*0.45-g, H), S(2, 0, H*0.6+g, W*0.275, H*0.4-g), S(3, W*0.275+g, H*0.6+g, W*0.275-g, H*0.4-g)];

  if (layout === 'sp-5-editorial')   return [S(0, 0, 0, W*0.55, H*0.55), S(1, W*0.55+g, 0, W*0.45-g, H*0.35), S(2, W*0.55+g, H*0.35+g, W*0.45-g, H*0.65-g), S(3, 0, H*0.55+g, W*0.275, H*0.45-g), S(4, W*0.275+g, H*0.55+g, W*0.275-g, H*0.45-g)];
  if (layout === 'sp-6-editorial')   return [S(0, 0, 0, W*0.5, H*0.5), S(1, W*0.5+g, 0, W*0.5-g, H*0.35), S(2, W*0.5+g, H*0.35+g, W*0.5-g, H*0.15), S(3, 0, H*0.5+g, W*0.25, H*0.5-g), S(4, W*0.25+g, H*0.5+g, W*0.25-g, H*0.5-g), S(5, W*0.5+g, H*0.5+g, W*0.5-g, H*0.5-g)];
  if (layout === 'sp-8-editorial')   return [S(0, 0, 0, W*0.5, H*0.4), S(1, W*0.5+g, 0, W*0.25-g/2, H*0.4), S(2, W*0.75+g/2, 0, W*0.25-g/2, H*0.4), S(3, 0, H*0.4+g, W*0.25, H*0.3), S(4, W*0.25+g, H*0.4+g, W*0.25-g, H*0.3), S(5, W*0.5+g, H*0.4+g, W*0.5-g, H*0.3), S(6, 0, H*0.7+g, W*0.5, H*0.3-g), S(7, W*0.5+g, H*0.7+g, W*0.5-g, H*0.3-g)];

  if (layout === 'sp-11-grid')       { const cw=(W-3*g)/4; const ch=(H-2*g)/3; return [...Array.from({length:8}, (_,ii)=>S(ii, (ii%4)*(cw+g), Math.floor(ii/4)*(ch+g), cw, ch)), S(8, 0, 2*(ch+g), cw, ch), S(9, cw+g, 2*(ch+g), cw*2+g, ch), S(10, 3*(cw+g), 2*(ch+g), cw, ch)]; }
  if (layout === 'sp-14-grid')       { const cw=(W-6*g)/7; const ch=(H-g)/2; return Array.from({length:14},(_,ii)=>S(ii, (ii%7)*(cw+g), Math.floor(ii/7)*(ch+g), cw, ch)); }

  // Text layouts
  if (layout === 'p-text-center')      return [];
  if (layout === 'p-text-left')        return [];
  if (layout === 'p-text-right')       return [];
  if (layout === 'p-text-photo-left')  return [S(0, 0, H*0.05, W*0.45, H*0.9)];
  if (layout === 'p-text-photo-right') return [S(0, W*0.55, H*0.05, W*0.45, H*0.9)];

  return [S(0, 0, 0, W, H)];
}
