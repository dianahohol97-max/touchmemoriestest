'use client';

import { useEffect, useRef } from 'react';
import { STAR_CATALOG, CONSTELLATION_LINES } from '@/lib/astronomy/starCatalog';

interface StarMapConfig {
  date: string; time: string; location: string;
  latitude: number; longitude: number;
  headline: string; subtitle: string; dedication: string;
  style: 'classic-dark' | 'light-minimal' | 'circular' | 'full-bleed' | 'with-horizon' | 'heart-dark' | 'heart-light' | 'forest-peak';
  backgroundColor: string; starColor: string; textColor: string; fontFamily: string;
  size: string; productType: string; price: number;
  showGrid?: boolean; showConstellations?: boolean; showMilkyWay?: boolean;
}

// ─── Astronomy ────────────────────────────────────────────────────────────────
const toRad = (d: number) => d * Math.PI / 180;
const toDeg = (r: number) => r * 180 / Math.PI;

function getJD(date: string, time: string) {
  const [y,mo,d] = date.split('-').map(Number);
  const [h,m] = time.split(':').map(Number);
  const A = Math.floor((14-mo)/12), Y = y+4800-A, M = mo+12*A-3;
  const JDN = d + Math.floor((153*M+2)/5) + 365*Y + Math.floor(Y/4) - Math.floor(Y/100) + Math.floor(Y/400) - 32045;
  return JDN + (h+m/60-12)/24;
}

function raDecToAltAz(ra: number, dec: number, lat: number, lon: number, jd: number) {
  const T = (jd-2451545)/36525;
  let gmst = 280.46061837 + 360.98564736629*(jd-2451545) + T*T*0.000387933 - T*T*T/38710000;
  gmst = ((gmst%360)+360)%360;
  const lst = ((gmst/15 + lon/15)%24+24)%24;
  const ha = toRad(((lst-ra)*15+360)%360);
  const decR = toRad(dec), latR = toRad(lat);
  const sinAlt = Math.sin(decR)*Math.sin(latR) + Math.cos(decR)*Math.cos(latR)*Math.cos(ha);
  const alt = toDeg(Math.asin(Math.max(-1,Math.min(1,sinAlt))));
  const cosAz = (Math.sin(decR)-Math.sin(toRad(alt))*Math.sin(latR))/(Math.cos(toRad(alt))*Math.cos(latR));
  let az = toDeg(Math.acos(Math.max(-1,Math.min(1,cosAz))));
  if (Math.sin(ha) > 0) az = 360-az;
  return { alt, az };
}

function project(alt: number, az: number, cx: number, cy: number, R: number, fov: number) {
  if (alt < -10) return null;
  const zd = 90-alt;
  if (zd > fov) return null;
  const r = R * Math.tan(toRad(zd)/2) / Math.tan(toRad(fov)/2);
  const azR = toRad(az);
  return { x: cx + r*Math.sin(azR), y: cy - r*Math.cos(azR) };
}

// Heart shape path (normalized 0-1)
function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const x = cx - w/2, y = cy - h*0.46;
  ctx.beginPath();
  ctx.moveTo(cx, y + h*0.3);
  ctx.bezierCurveTo(cx, y, x, y, x, y + h*0.3);
  ctx.bezierCurveTo(x, y + h*0.6, cx - w*0.1, y + h*0.75, cx, y + h);
  ctx.bezierCurveTo(cx + w*0.1, y + h*0.75, cx + w, y + h*0.6, cx + w, y + h*0.3);
  ctx.bezierCurveTo(cx + w, y, cx, y, cx, y + h*0.3);
  ctx.closePath();
}

export default function StarMapPreview({ config }: { config: StarMapConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 600, H = 800;
    canvas.width = W; canvas.height = H;

    const isHeart = config.style === 'heart-dark' || config.style === 'heart-light';
    const isDark = config.style === 'classic-dark' || config.style === 'circular' || config.style === 'full-bleed' || config.style === 'heart-dark' || config.style === 'with-horizon';
    const isForestPeak = config.style === 'forest-peak';
    const isCircular = config.style === 'circular' || config.style === 'classic-dark' || config.style === 'light-minimal' || config.style === 'heart-dark' || config.style === 'heart-light';
    const isFullBleed = config.style === 'full-bleed' || config.style === 'forest-peak';

    // ── BACKGROUND ──
    if (isForestPeak) {
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H*0.65);
      skyGrad.addColorStop(0, '#1a3a5c'); skyGrad.addColorStop(1, '#2d6a8a');
      ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
      // Mountains
      ctx.fillStyle = '#1a3a5c';
      ctx.beginPath(); ctx.moveTo(0, H*0.65);
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, H*0.4 + Math.sin(x*0.05)*40 + Math.sin(x*0.02)*60);
      ctx.lineTo(W, H*0.65); ctx.closePath(); ctx.fill();
      // Forest
      ctx.fillStyle = '#0d2233';
      ctx.fillRect(0, H*0.65, W, H*0.35);
      // Trees silhouette
      for (let x = -10; x < W+10; x += 22) {
        const h2 = 60 + Math.sin(x*0.3)*20;
        ctx.fillStyle = '#0d1f30';
        ctx.beginPath();
        ctx.moveTo(x, H*0.95); ctx.lineTo(x-10, H*0.65+h2*0.6);
        ctx.lineTo(x-7, H*0.65+h2*0.6); ctx.lineTo(x-7, H*0.65+h2*0.3);
        ctx.lineTo(x-5, H*0.65+h2*0.3); ctx.lineTo(x, H*0.65);
        ctx.lineTo(x+5, H*0.65+h2*0.3); ctx.lineTo(x+7, H*0.65+h2*0.3);
        ctx.lineTo(x+7, H*0.65+h2*0.6); ctx.lineTo(x+10, H*0.65+h2*0.6);
        ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = config.backgroundColor;
      ctx.fillRect(0, 0, W, H);
    }

    // ── POSTER FRAME for non-fullbleed ──
    if (!isFullBleed) {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, W-28, H-28);
    }

    // ── MAP AREA ──
    const mapAreaH = isFullBleed ? H*0.62 : H*0.62;
    const mapCX = W/2;
    const mapCY = isFullBleed ? H*0.38 : mapAreaH/2 + (isFullBleed ? 0 : 12);
    const mapR = isHeart
      ? W*0.42
      : Math.min(W*0.43, mapAreaH*0.46);
    const FOV = 90;
    const jd = getJD(config.date, config.time);

    // ── CLIP to shape ──
    ctx.save();
    if (isHeart) {
      heartPath(ctx, mapCX, mapCY, mapR*2, mapR*2.2);
      ctx.clip();
    } else if (!isFullBleed) {
      ctx.beginPath();
      ctx.arc(mapCX, mapCY, mapR, 0, Math.PI*2);
      ctx.clip();
    }

    // Map background
    if (isHeart || (!isFullBleed)) {
      ctx.fillStyle = isDark ? '#0a0e1a' : (config.style === 'light-minimal' ? '#f0f0f0' : '#111827');
      if (isHeart) {
        heartPath(ctx, mapCX, mapCY, mapR*2, mapR*2.2);
      } else {
        ctx.beginPath();
        ctx.arc(mapCX, mapCY, mapR, 0, Math.PI*2);
      }
      ctx.fill();
    }

    // ── MILKY WAY (subtle) ──
    if (config.showMilkyWay !== false && !isFullBleed) {
      for (let i = 0; i < 600; i++) {
        const seed = i*2.7;
        const rx = (Math.sin(seed*1.3)*0.5+0.5)*mapR*2 - mapR;
        const ry = (Math.sin(seed*0.7)*0.5+0.5)*mapR*2 - mapR;
        const dist = Math.sqrt(rx*rx+ry*ry);
        if (dist > mapR) continue;
        const band = Math.abs(rx*0.3 - ry*0.9) / mapR;
        if (band > 0.18) continue;
        ctx.globalAlpha = (0.18-band)/0.18 * 0.12;
        ctx.fillStyle = isDark ? '#aac4ff' : '#8899cc';
        ctx.beginPath();
        ctx.arc(mapCX+rx, mapCY+ry, 0.4, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── COORDINATE GRID ──
    if (config.showGrid) {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
      ctx.lineWidth = 0.5;
      // Altitude circles
      for (const altDeg of [30, 60]) {
        const zd = 90-altDeg;
        const r2 = mapR * Math.tan(toRad(zd)/2) / Math.tan(toRad(FOV)/2);
        ctx.beginPath();
        ctx.arc(mapCX, mapCY, r2, 0, Math.PI*2);
        ctx.stroke();
      }
      // Azimuth lines
      for (let az2 = 0; az2 < 360; az2 += 30) {
        const azR2 = toRad(az2);
        ctx.beginPath();
        ctx.moveTo(mapCX, mapCY);
        ctx.lineTo(mapCX + mapR*Math.sin(azR2), mapCY - mapR*Math.cos(azR2));
        ctx.stroke();
      }
    }

    // ── CONSTELLATION LINES ──
    if (config.showConstellations !== false) {
      ctx.strokeStyle = isDark ? 'rgba(180,200,255,0.35)' : 'rgba(50,70,140,0.30)';
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 1;
      for (const [ra1,dec1,ra2,dec2] of CONSTELLATION_LINES) {
        const {alt:a1,az:az1} = raDecToAltAz(ra1,dec1,config.latitude,config.longitude,jd);
        const {alt:a2,az:az2} = raDecToAltAz(ra2,dec2,config.latitude,config.longitude,jd);
        const p1 = project(a1,az1,mapCX,mapCY,mapR,FOV);
        const p2 = project(a2,az2,mapCX,mapCY,mapR,FOV);
        if (!p1||!p2) continue;
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
      }
    }

    // ── STARS ──
    for (const [ra,dec,mag,name] of STAR_CATALOG) {
      const {alt,az} = raDecToAltAz(ra,dec,config.latitude,config.longitude,jd);
      const pos = project(alt,az,mapCX,mapCY,mapR,FOV);
      if (!pos) continue;

      const size = Math.max(0.4, 3.8 - (mag+1.5)*0.56);
      const alpha = Math.max(0.25, 1.0 - mag*0.16);
      const starC = isDark ? config.starColor : (config.style === 'light-minimal' ? '#1a2a6c' : config.starColor);

      // Glow for bright stars
      if (mag < 1.5) {
        const g = ctx.createRadialGradient(pos.x,pos.y,0, pos.x,pos.y,size*5);
        g.addColorStop(0, starC+'cc'); g.addColorStop(0.5, starC+'44'); g.addColorStop(1, starC+'00');
        ctx.globalAlpha = alpha*0.7;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pos.x,pos.y,size*5,0,Math.PI*2); ctx.fill();
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = starC;
      ctx.beginPath(); ctx.arc(pos.x,pos.y,size,0,Math.PI*2); ctx.fill();

      // Star name for very bright
      if (mag < 1.2 && name) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = isDark ? 'rgba(200,220,255,0.8)' : 'rgba(30,45,125,0.8)';
        ctx.font = `9px ${config.fontFamily}`;
        ctx.textAlign = 'left';
        ctx.fillText(name, pos.x+size+3, pos.y+4);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── SHAPE BORDER ──
    if (isHeart) {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      heartPath(ctx, mapCX, mapCY, mapR*2, mapR*2.2);
      ctx.stroke();
    } else if (!isFullBleed) {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mapCX, mapCY, mapR, 0, Math.PI*2); ctx.stroke();
    }

    // ── SEPARATOR LINE ──
    if (!isFullBleed) {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      const sepY = mapCY + (isHeart ? mapR*1.15 : mapR) + 18;
      ctx.beginPath();
      ctx.moveTo(W*0.2, sepY); ctx.lineTo(W*0.8, sepY); ctx.stroke();
    }

    // ── TEXT AREA ──
    const textColor = isDark ? config.textColor : (config.style === 'light-minimal' ? '#1a2a6c' : config.textColor);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';

    const textStartY = isFullBleed
      ? H*0.68
      : mapCY + (isHeart ? mapR*1.22 : mapR) + 36;

    if (config.headline) {
      ctx.font = `bold 26px ${config.fontFamily}`;
      ctx.globalAlpha = 1;
      // Multi-line support
      const words = config.headline.split(' ');
      let line = '', lineY = textStartY;
      for (let i = 0; i < words.length; i++) {
        const test = line + words[i] + ' ';
        if (ctx.measureText(test).width > W*0.72 && i > 0) {
          ctx.fillText(line.trim(), W/2, lineY); line = words[i]+' '; lineY += 34;
        } else line = test;
      }
      ctx.fillText(line.trim(), W/2, lineY);
    }

    // Heart icon (decorative)
    ctx.font = `18px serif`;
    ctx.globalAlpha = 0.7;
    ctx.fillText('♥', W/2, textStartY + 56);
    ctx.globalAlpha = 1;

    if (config.subtitle) {
      ctx.font = `13px ${config.fontFamily}`;
      ctx.globalAlpha = 0.75;
      ctx.fillText(config.subtitle, W/2, textStartY + 82);
      ctx.globalAlpha = 1;
    }

    // Location + date
    const locLine1 = config.location || '';
    const locLine2 = config.date ? config.date.split('-').reverse().join('.') : '';
    const latStr = config.latitude >= 0 ? `${config.latitude.toFixed(2)}°N` : `${Math.abs(config.latitude).toFixed(2)}°S`;
    const lonStr = config.longitude >= 0 ? `${config.longitude.toFixed(2)}°E` : `${Math.abs(config.longitude).toFixed(2)}°W`;

    ctx.font = `12px ${config.fontFamily}`;
    ctx.globalAlpha = 0.65;
    let metaY = textStartY + (config.subtitle ? 104 : 90);
    if (locLine1) { ctx.fillText(locLine1, W/2, metaY); metaY += 18; }
    if (locLine2) { ctx.fillText(locLine2, W/2, metaY); metaY += 18; }
    ctx.font = `10px ${config.fontFamily}`;
    ctx.globalAlpha = 0.45;
    ctx.fillText(`${latStr}  ${lonStr}`, W/2, metaY);
    ctx.globalAlpha = 1;

  }, [config]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-base font-semibold text-gray-700 mb-3">Попередній перегляд</h3>
      <canvas ref={canvasRef} className="w-full h-auto rounded-lg border border-gray-100" style={{ maxHeight:'75vh' }} />
      <p className="text-xs text-gray-400 mt-2 text-center">{config.size} • {config.price} ₴</p>
    </div>
  );
}
