'use client';

import { useEffect, useRef } from 'react';
import { STAR_CATALOG, CONSTELLATION_LINES, CONSTELLATION_LABELS, CONSTELLATION_LABELS_EN, CONSTELLATION_LABELS_PL, CONSTELLATION_LABELS_RO, CONSTELLATION_LABELS_DE } from '@/lib/astronomy/starCatalog';

interface StarMapConfig {
    date: string; time: string; location: string;
    latitude: number; longitude: number;
    headline: string; subtitle: string; dedication: string;
    style: string;
    backgroundColor: string; starColor: string; textColor: string; fontFamily: string;
    size: string; productType: string; price: number;
    showGrid?: boolean; showConstellations?: boolean; showMilkyWay?: boolean;
    constellationLang?: 'uk' | 'en' | 'pl' | 'ro' | 'de';
}

// ─── Astronomy: RA/Dec → canvas XY ──────────────────────────────────────────
// We use a gnomonic (tangent plane) projection centered on the sky overhead
// Center = (LST hours → RA degrees, latitude → Dec)
// This gives a natural "looking up" view of the whole sky

function getJD(d: string, t: string) {
    const [y,mo,dd] = d.split('-').map(Number);
    const [h,m] = (t||'22:00').split(':').map(Number);
    const ut = h + m/60;
    const A=Math.floor((14-mo)/12), Y=y+4800-A, M=mo+12*A-3;
    const JDN=dd+Math.floor((153*M+2)/5)+365*Y+Math.floor(Y/4)-Math.floor(Y/100)+Math.floor(Y/400)-32045;
    return JDN+(ut-12)/24;
}

function getLST(jd: number, lon: number): number {
    // Local Sidereal Time in degrees
    const T=(jd-2451545)/36525;
    let gmst=280.46061837+360.98564736629*(jd-2451545)+T*T*0.000387933-T*T*T/38710000;
    return ((gmst+lon)%360+360)%360;
}

// Stereographic projection of the whole sky
// Center = zenith (RA=LST, Dec=lat)
// Returns null if star is behind the sky (more than 90° from center, i.e., below horizon)
// We use FOV=180° to show full sky
function projectSky(
    ra_deg: number, dec_deg: number,
    lst_deg: number, lat_deg: number,
    cx: number, cy: number, R: number,
    showBelowHorizon: boolean
): {x: number; y: number; visible: boolean} | null {
    const r = Math.PI/180;
    const ra0 = lst_deg*r, dec0 = lat_deg*r;
    const ra  = ra_deg*r,  dec  = dec_deg*r;

    // Angular separation from zenith (= altitude above horizon)
    const cosC = Math.sin(dec0)*Math.sin(dec) + Math.cos(dec0)*Math.cos(dec)*Math.cos(ra-ra0);
    const C = Math.acos(Math.max(-1, Math.min(1, cosC))); // 0 = zenith, 90° = horizon, 180° = nadir

    if(!showBelowHorizon && C > Math.PI/2 + 0.15) return null; // slightly below horizon = skip
    if(C > Math.PI*0.98) return null; // near nadir = skip (projection singularity)

    // Stereographic projection: r = 2*tan(C/2)
    // Scale so that C=90° (horizon) maps to radius R
    const scale = R / (2*Math.tan(Math.PI/4)); // C=90° → 2*tan(45°)=2 → R/2... wait
    // Actually: at C=90°, r_proj = 2*R*tan(45°) = 2R, so scale = R/2*tan(C/2)
    // Let's use: r_px = R * tan(C/2) / tan(PI/4) = R * tan(C/2)
    const r_px = R * Math.tan(C/2) / Math.tan(Math.PI/4);

    // Position angle from zenith
    // PA = atan2 of the star relative to North
    const sinPA = Math.cos(dec)*Math.sin(ra-ra0);
    const cosPA = Math.sin(dec)*Math.cos(dec0) - Math.cos(dec)*Math.sin(dec0)*Math.cos(ra-ra0);
    const pa = Math.atan2(sinPA, cosPA); // 0=North, clockwise=East

    const visible = C < Math.PI/2;
    return {
        x: cx + r_px * Math.sin(pa),
        y: cy - r_px * Math.cos(pa),
        visible
    };
}

// ─── Heart clip path ──────────────────────────────────────────────────────────
function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    // Mathematically correct heart using parametric equation
    // heart: x = 16sin³(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
    // Scaled to fit bounding box of ~s*2 width, ~s*2 height, centered at cx,cy
    ctx.beginPath();
    const steps = 200;
    const scaleX = s * 0.93;
    const scaleY = s * 0.88;
    const offsetY = s * 0.08; // shift center slightly up so bottom point aligns
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const x = cx + scaleX * (16 * Math.pow(Math.sin(t), 3)) / 16;
        const y = cy + offsetY - scaleY * (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t)) / 17;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

// ─── Forest background ────────────────────────────────────────────────────────
function drawForest(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const sky=ctx.createLinearGradient(0,0,0,H*0.7);
    sky.addColorStop(0,'#030810'); sky.addColorStop(0.6,'#0a1a30'); sky.addColorStop(1,'#143550');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#071525';
    ctx.beginPath(); ctx.moveTo(0,H*0.58);
    [[0.08,0.33],[0.2,0.47],[0.33,0.25],[0.48,0.39],[0.6,0.21],[0.74,0.35],[0.86,0.26],[1,0.43]].forEach(([x,y])=>ctx.lineTo((x as number)*W,(y as number)*H));
    ctx.lineTo(W,H*0.58); ctx.closePath(); ctx.fill();
    for(let x=-5;x<W+5;x+=14) {
        const h=38+Math.sin(x*0.33)*9;
        const base=H*0.61+Math.sin(x*0.19)*5;
        ctx.fillStyle='#040d1c';
        ctx.beginPath(); ctx.moveTo(x,base);
        ctx.lineTo(x-7,base-h*0.44); ctx.lineTo(x-4,base-h*0.44);
        ctx.lineTo(x-9,base-h*0.71); ctx.lineTo(x-3,base-h*0.71);
        ctx.lineTo(x,base-h); ctx.lineTo(x+3,base-h*0.71);
        ctx.lineTo(x+9,base-h*0.71); ctx.lineTo(x+4,base-h*0.44);
        ctx.lineTo(x+7,base-h*0.44); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle='#040d1c'; ctx.fillRect(0,H*0.66,W,H*0.34);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StarMapPreview({ config }: { config: StarMapConfig }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current; if(!canvas) return;
        const ctx = canvas.getContext('2d'); if(!ctx) return;
        // Dynamic canvas size based on selected size
        const dimMap: Record<string, [number,number]> = {
            'A4 (21×29.7 см)': [595, 842],
            'A3 (29.7×42 см)': [842, 1191],
            '30×40 см': [600, 800],
            '50×70 см': [600, 840],
            '60×90 см': [600, 900],
        };
        const [W, H] = dimMap[config.size] || [600, 800];
        // Use devicePixelRatio for crisp rendering on retina/HiDPI screens
        const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 2;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        const isHeart  = config.style==='heart-dark'||config.style==='heart-light';
        const isForest = config.style==='forest-peak';
        const isFull   = config.style==='full-bleed';
        const isLight  = config.style==='light-minimal'||config.style==='heart-light';

        // BG
        if(isForest) drawForest(ctx,W,H);
        else { ctx.fillStyle=config.backgroundColor; ctx.fillRect(0,0,W,H); }

        // Map geometry
        const mapH = isFull ? H : Math.round(H*0.60);
        const cx=W/2, cy = isFull ? H/2 : mapH/2;
        const R = isHeart
            ? Math.min(W,mapH)*0.46
            : Math.min(W/2-20, mapH/2-20)*0.96;

        // Compute LST (RA of zenith in degrees)
        const jd = getJD(config.date, config.time);
        const lst_deg = getLST(jd, config.longitude);
        const lat = config.latitude;

        // Helper: project star RA/Dec to canvas
        const P = (ra_h: number, dec_d: number, belowOk=false) =>
            projectSky(ra_h*15, dec_d, lst_deg, lat, cx, cy, R, belowOk||isFull);

        // Clip
        ctx.save();
        if(isHeart) {
            drawHeart(ctx,cx,cy-R*0.08,R*1.12); ctx.clip();
        } else if(!isFull) {
            ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
        }

        // Fill inside clip
        if(!isForest) { ctx.fillStyle=config.backgroundColor; ctx.fillRect(0,0,W,H); }
        else if(isHeart) { ctx.fillStyle='#030810'; ctx.fillRect(0,0,W,H); }

        // Milky Way
        if(config.showMilkyWay!==false) {
            const mw: [number,number][] = [
                [0,-5],[0.5,-15],[1,-25],[1.5,-35],[2,-43],[2.5,-48],[3,-51],[3.5,-52],
                [4,-50],[4.5,-45],[5,-37],[5.5,-28],[6,-18],[6.5,-8],[7,2],[7.5,12],
                [8,20],[8.5,24],[9,27],[9.5,29],[10,27],[10.5,21],[11,13],[11.5,3],
                [12,-7],[12.5,-17],[13,-27],[13.5,-37],[14,-47],[14.5,-52],[15,-56],
                [15.5,-58],[16,-59],[16.5,-59],[17,-56],[17.5,-51],[18,-43],[18.5,-33],
                [19,-21],[19.5,-9],[20,3],[20.5,13],[21,20],[21.5,24],[22,25],
                [22.5,22],[23,15],[23.5,7],[24,-2]
            ];
            const pts = mw.map(([ra,dec])=>P(ra,dec,true)).filter(Boolean) as {x:number;y:number}[];
            if(pts.length>4) {
                ctx.save(); ctx.globalAlpha=0.07;
                ctx.strokeStyle=config.starColor; ctx.lineWidth=22; ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
                for(let i=1;i<pts.length;i++) {
                    const dx=pts[i].x-pts[i-1].x, dy=pts[i].y-pts[i-1].y;
                    if(dx*dx+dy*dy>(R*0.3)*(R*0.3)){ ctx.moveTo(pts[i].x,pts[i].y); continue; }
                    ctx.lineTo(pts[i].x,pts[i].y);
                }
                ctx.stroke(); ctx.restore();
            }
        }

        // Coord grid (RA/Dec grid)
        if(config.showGrid) {
            ctx.save(); ctx.strokeStyle=config.starColor; ctx.globalAlpha=0.1; ctx.lineWidth=0.5;
            // Dec circles every 30°
            for(let dec=-60;dec<=90;dec+=30) {
                const pts2:any[]=[];
                for(let ra=0;ra<24;ra+=0.25) {
                    const p=P(ra,dec,true); if(p) pts2.push(p);
                }
                if(pts2.length<3) continue;
                ctx.beginPath(); ctx.moveTo(pts2[0].x,pts2[0].y);
                for(let i=1;i<pts2.length;i++) {
                    const dx=pts2[i].x-pts2[i-1].x, dy=pts2[i].y-pts2[i-1].y;
                    if(dx*dx+dy*dy>(R*0.3)*(R*0.3)){ ctx.moveTo(pts2[i].x,pts2[i].y); continue; }
                    ctx.lineTo(pts2[i].x,pts2[i].y);
                }
                ctx.stroke();
            }
            // RA lines every 2h
            for(let ra=0;ra<24;ra+=2) {
                const pts2:any[]=[];
                for(let dec=-80;dec<=90;dec+=5) { const p=P(ra,dec,true); if(p) pts2.push(p); }
                if(pts2.length<2) continue;
                ctx.beginPath(); ctx.moveTo(pts2[0].x,pts2[0].y);
                for(let i=1;i<pts2.length;i++) {
                    const dx=pts2[i].x-pts2[i-1].x, dy=pts2[i].y-pts2[i-1].y;
                    if(dx*dx+dy*dy>(R*0.3)*(R*0.3)){ ctx.moveTo(pts2[i].x,pts2[i].y); continue; }
                    ctx.lineTo(pts2[i].x,pts2[i].y);
                }
                ctx.stroke();
            }
            ctx.restore();
        }

        // Constellation lines
        if(config.showConstellations!==false) {
            ctx.save();
            ctx.strokeStyle=config.starColor;
            ctx.lineWidth=isLight?0.8:1.0;
            ctx.globalAlpha=isLight?0.35:0.65;
            for(const [ra1,dec1,ra2,dec2] of CONSTELLATION_LINES) {
                const p1=P(ra1,dec1,true), p2=P(ra2,dec2,true);
                if(!p1||!p2) continue;
                const dx=p1.x-p2.x, dy=p1.y-p2.y;
                if(dx*dx+dy*dy>(R*0.6)*(R*0.6)) continue; // skip wrap-arounds
                ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
            }
            ctx.restore();
        }

        // Stars — improved visibility: larger size, better alpha curve
        for(const [ra,dec,mag] of STAR_CATALOG) {
            const pos=P(ra,dec,true); if(!pos) continue;
            // size: bright stars bigger, faint stars still visible (min 0.5px)
            const size=Math.max(0.5, 3.5-(mag+1.0)*0.35);
            // alpha: steeper curve, faint stars more visible
            const alpha=Math.max(0.25, Math.min(1.0, 1.3-mag*0.13));
            // Glow only for bright stars on DARK backgrounds
            if(mag<1.5 && !isLight) {
                const g=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,size*4);
                g.addColorStop(0,config.starColor); g.addColorStop(0.3,config.starColor+'bb'); g.addColorStop(1,config.starColor+'00');
                ctx.globalAlpha=alpha*0.35; ctx.fillStyle=g;
                ctx.beginPath(); ctx.arc(pos.x,pos.y,size*4,0,Math.PI*2); ctx.fill();
            }
            ctx.globalAlpha=alpha; ctx.fillStyle=config.starColor;
            ctx.beginPath(); ctx.arc(pos.x,pos.y,size,0,Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha=1;

        const s = W/600;
        // Constellation labels
        if(config.showConstellations!==false) {
            ctx.save();
            ctx.font=`9px ${config.fontFamily}`;
            ctx.fillStyle=config.textColor; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.globalAlpha=isLight?0.35:0.4;
            const labelsForLang = config.constellationLang === 'en' ? CONSTELLATION_LABELS_EN
                : config.constellationLang === 'pl' ? CONSTELLATION_LABELS_PL
                : config.constellationLang === 'ro' ? CONSTELLATION_LABELS_RO
                : config.constellationLang === 'de' ? CONSTELLATION_LABELS_DE
                : CONSTELLATION_LABELS;
            for(const [ra,dec,name] of labelsForLang) {
                const pos=P(ra,dec,true); if(!pos) continue;
                const dx=pos.x-cx, dy=pos.y-cy;
                if(dx*dx+dy*dy>(R*0.90)*(R*0.90)) continue;
                ctx.fillText(name, pos.x, pos.y);
            }
            ctx.restore();
        }

        // Horizon circle (subtle dashed line)
        if(!isFull && !isHeart) {
            // Draw horizon as a dashed inner circle (approximate)
            const horizR = R * Math.tan(Math.PI/4); // C=90° maps to R*tan(45°)=R
            ctx.save();
            ctx.strokeStyle=config.starColor; ctx.globalAlpha=0.1;
            ctx.lineWidth=0.8; ctx.setLineDash([3,5]);
            ctx.beginPath(); ctx.arc(cx,cy,horizR,0,Math.PI*2); ctx.stroke();
            ctx.setLineDash([]); ctx.restore();
        }

        ctx.restore(); // end clip

        // Border
        if(isHeart) {
            ctx.save(); drawHeart(ctx,cx,cy-R*0.08,R*1.12);
            ctx.strokeStyle=isLight?'rgba(0,0,0,0.2)':'rgba(255,255,255,0.45)';
            ctx.lineWidth=2; ctx.stroke(); ctx.restore();
        } else if(!isFull) {
            ctx.strokeStyle=isLight?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.4)';
            ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
        }
        if(!isFull) {
            ctx.strokeStyle=isLight?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.15)';
            ctx.lineWidth=1; ctx.strokeRect(16,16,W-32,H-32);
            // inner double border
            ctx.strokeStyle=isLight?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.04)';
            ctx.lineWidth=1; ctx.strokeRect(22,22,W-44,H-44);
        }

        // Text zone — scale proportionally to W (base=600)
        ctx.fillStyle=config.textColor; ctx.textAlign='center'; ctx.textBaseline='alphabetic';

        if(isFull) {
            if(config.headline){
                ctx.font=`bold ${Math.round(32*s)}px ${config.fontFamily}`; ctx.globalAlpha=0.95;
                ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=14;
                ctx.fillText(config.headline,W/2,62*s); ctx.shadowBlur=0; ctx.globalAlpha=1;
            }
        } else {
            const textZoneTop = mapH;
            const textZoneH = H - mapH;
            const tCy = textZoneTop + textZoneH * 0.5; // center of text zone

            // Decorative separator line with dots
            ctx.save();
            const sepY = textZoneTop + 12*s;
            ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(W*0.25, sepY); ctx.lineTo(W*0.75, sepY); ctx.stroke();
            // dot in center of separator
            ctx.fillStyle = isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)';
            ctx.beginPath(); ctx.arc(W/2, sepY, 2*s, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = config.textColor;
            ctx.restore();

            // Headline — bigger, more prominent
            let currentY = textZoneTop + textZoneH * 0.3;
            if(config.headline){
                ctx.font=`bold ${Math.round(28*s)}px ${config.fontFamily}`;
                ctx.globalAlpha=0.95;
                const mw=W*0.82;
                const words=config.headline.split(' ');
                let line='', lineY=currentY;
                for(let i=0;i<words.length;i++){
                    const t=line+words[i]+' ';
                    if(ctx.measureText(t).width>mw&&i>0){
                        ctx.fillText(line.trim(),W/2,lineY);
                        line=words[i]+' '; lineY+=34*s;
                    } else line=t;
                }
                ctx.fillText(line.trim(),W/2,lineY);
                currentY = lineY + 26*s;
            }

            // (heart symbol removed)
            currentY += 6*s;

            // Location + date — bigger
            const loc = config.location || '';
            const ds = config.date ? new Date(config.date+'T12:00:00').toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric'}) : '';
            ctx.font=`${Math.round(15*s)}px ${config.fontFamily}`; ctx.globalAlpha=0.75;
            if(loc){ ctx.fillText(loc, W/2, currentY); currentY += 21*s; }
            if(ds){  ctx.fillText(ds,  W/2, currentY); currentY += 21*s; }
            ctx.globalAlpha=1;

            // Dedication (italic)
            if(config.dedication){
                currentY += 6*s;
                ctx.font=`italic ${Math.round(13*s)}px ${config.fontFamily}`; ctx.globalAlpha=0.55;
                const mw=W*0.78; const words=config.dedication.split(' ');
                let line='', lineY=currentY;
                for(let i=0;i<words.length;i++){
                    const t=line+words[i]+' ';
                    if(ctx.measureText(t).width>mw&&i>0){
                        ctx.fillText(line.trim(),W/2,lineY); line=words[i]+' '; lineY+=19*s;
                    } else line=t;
                }
                ctx.fillText(line.trim(),W/2,lineY);
            }

            // Coordinates — bottom, small
            ctx.globalAlpha=1;
            ctx.font=`${Math.round(9*s)}px ${config.fontFamily}`; ctx.globalAlpha=0.28;
            const latS=lat>=0?`${lat.toFixed(2)}°N`:`${Math.abs(lat).toFixed(2)}°S`;
            const lonS=config.longitude>=0?`${config.longitude.toFixed(2)}°E`:`${Math.abs(config.longitude).toFixed(2)}°W`;
            ctx.fillText(`${latS}  ${lonS}`, W/2, H-20*s); ctx.globalAlpha=1;
        }
    }, [config]);

    const aspectMap: Record<string, string> = {
        'A4 (21×29.7 см)': '210/297',
        'A3 (29.7×42 см)': '297/420',
        '30×40 см': '3/4',
        '50×70 см': '5/7',
        '60×90 см': '2/3',
    };
    const aspectRatio = aspectMap[config.size] || '3/4';

    return (
        <div className="rounded-xl shadow-2xl overflow-hidden" style={{backgroundColor: config.backgroundColor}}>
            <div style={{ position: 'relative', width: '100%', aspectRatio, overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        position: 'absolute', top:0, left:0,
                        width:'100%', height:'100%',
                        display:'block',
                    }}
                />
            </div>
        </div>
    );
}
