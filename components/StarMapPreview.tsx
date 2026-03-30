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

// ─── Astronomy ───────────────────────────────────────────────────────────────
function getJD(dateStr: string, timeStr: string): number {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, m] = (timeStr || '22:00').split(':').map(Number);
    const ut = h + m / 60;
    const A = Math.floor((14 - mo) / 12);
    const Y = y + 4800 - A, M = mo + 12 * A - 3;
    const JDN = d + Math.floor((153*M+2)/5) + 365*Y + Math.floor(Y/4) - Math.floor(Y/100) + Math.floor(Y/400) - 32045;
    return JDN + (ut - 12) / 24;
}
function getGMST(jd: number): number {
    const T = (jd - 2451545) / 36525;
    let g = 280.46061837 + 360.98564736629*(jd-2451545) + T*T*0.000387933 - T*T*T/38710000;
    return ((g % 360) + 360) % 360 / 15;
}
function toAltAz(ra: number, dec: number, lat: number, lon: number, jd: number) {
    const r = Math.PI/180;
    const lst = ((getGMST(jd) + lon/15) % 24 + 24) % 24;
    const ha = ((lst - ra) % 24 + 24) % 24;
    const haR = ha*15*r, decR = dec*r, latR = lat*r;
    const sinAlt = Math.sin(decR)*Math.sin(latR) + Math.cos(decR)*Math.cos(latR)*Math.cos(haR);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / r;
    const cosAz = (Math.sin(decR) - Math.sin(alt*r)*Math.sin(latR)) / (Math.cos(alt*r)*Math.cos(latR));
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) / r;
    if (Math.sin(haR) > 0) az = 360 - az;
    return { alt, az };
}
function project(alt: number, az: number, cx: number, cy: number, R: number, fov = 90) {
    if (alt < -5) return null;
    const zd = 90 - alt;
    if (zd > fov + 5) return null;
    const r = R * Math.tan((zd * Math.PI/180) / 2) / Math.tan((fov * Math.PI/180) / 2);
    return { x: cx + r * Math.sin(az * Math.PI/180), y: cy - r * Math.cos(az * Math.PI/180) };
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
}

function drawCoordGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, starColor: string) {
    ctx.strokeStyle = `rgba(${hexToRgb(starColor)}, 0.12)`;
    ctx.lineWidth = 0.5;
    // Concentric circles every 30° altitude
    for (let alt = 0; alt <= 90; alt += 30) {
        const zd = 90 - alt;
        const r = R * Math.tan((zd * Math.PI/180) / 2) / Math.tan((90 * Math.PI/180) / 2);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    // Radial lines every 30° azimuth
    for (let az = 0; az < 360; az += 30) {
        const azR = az * Math.PI/180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + R * Math.sin(azR), cy - R * Math.cos(azR));
        ctx.stroke();
    }
    // Cardinal labels
    const cardinals = [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as [string, number][];
    ctx.fillStyle = `rgba(${hexToRgb(starColor)}, 0.45)`;
    ctx.font = `bold 11px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [label, az] of cardinals) {
        const azR = az * Math.PI / 180;
        const x = cx + (R + 16) * Math.sin(azR);
        const y = cy - (R + 16) * Math.cos(azR);
        ctx.fillText(label, x, y);
    }
}

function drawMilkyWay(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, lat: number, lon: number, jd: number, starColor: string) {
    // Milky Way band: galactic plane RA/Dec pairs (approximate)
    const band: [number, number][] = [
        [0,0],[0.5,-10],[1,-20],[1.5,-30],[2,-40],[2.5,-45],[3,-50],[3.5,-52],[4,-50],
        [5,-40],[5.5,-30],[6,-20],[6.5,-10],[7,0],[7.5,10],[8,20],[8.5,25],[9,28],
        [9.5,30],[10,28],[10.5,22],[11,15],[11.5,5],[12,-5],[12.5,-15],[13,-25],
        [13.5,-35],[14,-45],[14.5,-50],[15,-55],[15.5,-58],[16,-60],[16.5,-60],
        [17,-58],[17.5,-52],[18,-42],[18.5,-32],[19,-20],[19.5,-10],[20,0],
        [20.5,10],[21,18],[21.5,22],[22,24],[22.5,22],[23,16],[23.5,8],[24,0]
    ];
    const pts = band.map(([ra, dec]) => {
        const { alt, az } = toAltAz(ra, dec, lat, lon, jd);
        return project(alt, az, cx, cy, R);
    }).filter(Boolean) as { x: number; y: number }[];
    if (pts.length < 3) return;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = starColor;
    ctx.lineWidth = 24;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        // skip if jump is too large (wrapping)
        const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
        if (Math.sqrt(dx*dx+dy*dy) > R * 0.5) { ctx.moveTo(pts[i].x, pts[i].y); continue; }
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
}

// ─── Heart path ───────────────────────────────────────────────────────────────
function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.3);
    ctx.bezierCurveTo(cx - s * 1.2, cy - s * 0.4, cx - s * 1.2, cy - s, cx, cy - s * 0.55);
    ctx.bezierCurveTo(cx + s * 1.2, cy - s, cx + s * 1.2, cy - s * 0.4, cx, cy + s * 0.3);
    ctx.closePath();
}

// ─── Forest/mountain background for 'forest-peak' ────────────────────────────
function drawForestBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    sky.addColorStop(0, '#0a1a3a');
    sky.addColorStop(0.5, '#1a3a6e');
    sky.addColorStop(1, '#3a6ea8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // Mountains
    ctx.fillStyle = '#0e2444';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    ctx.lineTo(W * 0.12, H * 0.3); ctx.lineTo(W * 0.25, H * 0.45);
    ctx.lineTo(W * 0.38, H * 0.22); ctx.lineTo(W * 0.52, H * 0.38);
    ctx.lineTo(W * 0.65, H * 0.18); ctx.lineTo(W * 0.78, H * 0.35);
    ctx.lineTo(W * 0.88, H * 0.25); ctx.lineTo(W, H * 0.42);
    ctx.lineTo(W, H * 0.55); ctx.closePath();
    ctx.fill();
    // Treeline
    const treeColor = '#071830';
    ctx.fillStyle = treeColor;
    for (let x = -10; x < W + 10; x += 18) {
        const h = 45 + Math.sin(x * 0.3) * 12 + Math.random() * 8;
        const base = H * 0.6 + Math.sin(x * 0.15) * 8;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x - 10, base - h * 0.45);
        ctx.lineTo(x - 7, base - h * 0.45);
        ctx.lineTo(x - 13, base - h * 0.7);
        ctx.lineTo(x - 5, base - h * 0.7);
        ctx.lineTo(x, base - h);
        ctx.lineTo(x + 5, base - h * 0.7);
        ctx.lineTo(x + 13, base - h * 0.7);
        ctx.lineTo(x + 7, base - h * 0.45);
        ctx.lineTo(x + 10, base - h * 0.45);
        ctx.closePath();
        ctx.fill();
    }
    // Ground
    ctx.fillStyle = treeColor;
    ctx.fillRect(0, H * 0.65, W, H * 0.35);
}

// ─── Main Component ────────────────────────────────────────────────────────────
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
        const isForest = config.style === 'forest-peak';
        const isFullBleed = config.style === 'full-bleed';
        const isLight = config.style === 'light-minimal' || config.style === 'heart-light';

        // ── Background ──
        if (isForest) {
            drawForestBg(ctx, W, H);
        } else {
            ctx.fillStyle = config.backgroundColor;
            ctx.fillRect(0, 0, W, H);
        }

        // ── Map layout ──
        const mapAreaH = isFullBleed ? H : Math.round(H * 0.64);
        const cx = W / 2;
        const cy = isFullBleed ? H / 2 : mapAreaH / 2;

        let mapR: number;
        if (isHeart) {
            mapR = Math.min(W, mapAreaH) * 0.38;
        } else {
            mapR = Math.min(W / 2 - 20, mapAreaH / 2 - 20) * 0.94;
        }

        const jd = getJD(config.date, config.time);
        const lat = config.latitude, lon = config.longitude;

        // ── Clip ──
        ctx.save();
        if (isHeart) {
            heartPath(ctx, cx, cy - mapR * 0.1, mapR * 1.1);
            ctx.clip();
        } else if (!isFullBleed) {
            ctx.beginPath();
            ctx.arc(cx, cy, mapR, 0, Math.PI * 2);
            ctx.clip();
        }

        // ── Sky background inside clip ──
        if (!isForest || isHeart) {
            ctx.fillStyle = config.backgroundColor;
            ctx.fillRect(0, 0, W, H);
        }

        // ── Milky Way ──
        if (config.showMilkyWay !== false) {
            drawMilkyWay(ctx, cx, cy, mapR, lat, lon, jd, config.starColor);
        }

        // ── Coordinate grid ──
        if (config.showGrid) {
            drawCoordGrid(ctx, cx, cy, mapR, config.starColor);
        }

        // ── Constellation lines ──
        const showConst = config.showConstellations !== false;
        if (showConst) {
            ctx.strokeStyle = config.starColor;
            ctx.lineWidth = isLight ? 0.7 : 0.9;
            ctx.globalAlpha = isLight ? 0.35 : 0.55;
            for (const [ra1, dec1, ra2, dec2] of CONSTELLATION_LINES) {
                const a1 = toAltAz(ra1, dec1, lat, lon, jd);
                const a2 = toAltAz(ra2, dec2, lat, lon, jd);
                const p1 = project(a1.alt, a1.az, cx, cy, mapR);
                const p2 = project(a2.alt, a2.az, cx, cy, mapR);
                if (!p1 || !p2) continue;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // ── Stars ──
        for (const [ra, dec, mag, name] of STAR_CATALOG) {
            const { alt, az } = toAltAz(ra, dec, lat, lon, jd);
            const pos = project(alt, az, cx, cy, mapR);
            if (!pos) continue;

            // Size: mag -1.5 → 4px, mag 5 → 0.5px
            const size = Math.max(0.4, 3.8 - (mag + 1.5) * 0.52);
            const alpha = Math.max(0.35, Math.min(1.0, 1.05 - mag * 0.15));

            // Glow for bright stars
            if (mag < 1.5) {
                const glowR = size * 3.5;
                const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
                glow.addColorStop(0, config.starColor);
                glow.addColorStop(0.3, config.starColor + 'aa');
                glow.addColorStop(1, config.starColor + '00');
                ctx.globalAlpha = alpha * 0.5;
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = alpha;
            ctx.fillStyle = config.starColor;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.fill();

            // Constellation labels for bright named stars
            if (mag < 1.0 && name) {
                ctx.globalAlpha = 0.55;
                ctx.fillStyle = config.textColor;
                ctx.font = `10px ${config.fontFamily}`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(name, pos.x + size + 4, pos.y);
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore(); // end clip

        // ── Border / frame around map ──
        if (isHeart) {
            ctx.save();
            heartPath(ctx, cx, cy - mapR * 0.1, mapR * 1.1);
            ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (!isFullBleed) {
            ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, mapR, 0, Math.PI * 2);
            ctx.stroke();
        }

        // ── Thin outer poster border ──
        if (!isFullBleed) {
            ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.strokeRect(16, 16, W - 32, H - 32);
        }

        // ── Text block ──
        const textColor = config.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        if (isFullBleed) {
            // Text over map with slight shadow
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 8;
            if (config.headline) {
                ctx.font = `bold 28px ${config.fontFamily}`;
                ctx.fillStyle = textColor;
                ctx.fillText(config.headline, W / 2, 55);
            }
            ctx.shadowBlur = 0;
        } else {
            const textTop = mapAreaH + 28;

            // Divider line
            ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(W * 0.15, mapAreaH + 1); ctx.lineTo(W * 0.85, mapAreaH + 1);
            ctx.stroke();

            if (config.headline) {
                ctx.font = `bold 26px ${config.fontFamily}`;
                ctx.fillStyle = textColor;
                ctx.globalAlpha = 1;
                // Word wrap
                const maxW = W * 0.82;
                const words = config.headline.split(' ');
                let line = '', y = textTop;
                for (let i = 0; i < words.length; i++) {
                    const test = line + words[i] + ' ';
                    if (ctx.measureText(test).width > maxW && i > 0) {
                        ctx.fillText(line.trim(), W / 2, y); line = words[i] + ' '; y += 32;
                    } else line = test;
                }
                ctx.fillText(line.trim(), W / 2, y);
            }

            // Heart / decoration symbol
            const hasHeadline = !!config.headline;
            const heartY = hasHeadline ? textTop + 68 : textTop + 20;
            ctx.font = '18px sans-serif';
            ctx.fillStyle = textColor;
            ctx.globalAlpha = 0.85;
            ctx.fillText('♥', W / 2, heartY);
            ctx.globalAlpha = 1;

            // Location + date
            const infoY = heartY + 30;
            ctx.font = `13px ${config.fontFamily}`;
            ctx.fillStyle = textColor;
            ctx.globalAlpha = 0.65;
            if (config.location) ctx.fillText(config.location, W / 2, infoY);

            // Format date nicely
            const dateFormatted = config.date
                ? new Date(config.date + 'T12:00:00').toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '';
            if (dateFormatted) ctx.fillText(dateFormatted, W / 2, infoY + 20);

            // Coordinates
            const latStr = lat >= 0 ? `${lat.toFixed(4)}° N` : `${Math.abs(lat).toFixed(4)}° S`;
            const lonStr = lon >= 0 ? `${lon.toFixed(4)}° E` : `${Math.abs(lon).toFixed(4)}° W`;
            ctx.font = `10px ${config.fontFamily}`;
            ctx.fillStyle = textColor;
            ctx.globalAlpha = 0.45;
            ctx.fillText(`${latStr}  ${lonStr}`, W / 2, H - 22);
            ctx.globalAlpha = 1;

            if (config.subtitle) {
                ctx.font = `13px ${config.fontFamily}`;
                ctx.fillStyle = textColor;
                ctx.globalAlpha = 0.6;
                ctx.fillText(config.subtitle, W / 2, infoY + 44);
                ctx.globalAlpha = 1;
            }
        }

    }, [config]);

    return (
        <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 text-center uppercase tracking-wider">Попередній перегляд</h3>
            <canvas
                ref={canvasRef}
                className="w-full h-auto rounded-lg"
                style={{ maxHeight: '75vh', display: 'block' }}
            />
            <p className="text-xs text-center text-gray-400 mt-2">
                {config.size} · {config.productType} · {config.price} ₴
            </p>
        </div>
    );
}
