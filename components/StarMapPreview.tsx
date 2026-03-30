'use client';

import { useEffect, useRef } from 'react';
import { STAR_CATALOG, CONSTELLATION_LINES, CONSTELLATION_LABELS } from '@/lib/astronomy/starCatalog';

interface StarMapConfig {
    date: string; time: string; location: string;
    latitude: number; longitude: number;
    headline: string; subtitle: string; dedication: string;
    style: string;
    backgroundColor: string; starColor: string; textColor: string; fontFamily: string;
    size: string; productType: string; price: number;
    showGrid?: boolean; showConstellations?: boolean; showMilkyWay?: boolean;
}

// ─── Astronomy ──────────────────────────────────────────────────────────────
function getJD(d: string, t: string) {
    const [y,mo,dd] = d.split('-').map(Number);
    const [h,m] = (t||'22:00').split(':').map(Number);
    const ut = h + m/60;
    const A = Math.floor((14-mo)/12), Y = y+4800-A, M = mo+12*A-3;
    const JDN = dd+Math.floor((153*M+2)/5)+365*Y+Math.floor(Y/4)-Math.floor(Y/100)+Math.floor(Y/400)-32045;
    return JDN+(ut-12)/24;
}
function gmst(jd: number) {
    const T=(jd-2451545)/36525;
    return (((280.46061837+360.98564736629*(jd-2451545)+T*T*0.000387933-T*T*T/38710000)%360)+360)%360/15;
}
function altaz(ra: number, dec: number, lat: number, lon: number, jd: number) {
    const r=Math.PI/180;
    const lst=((gmst(jd)+lon/15)%24+24)%24;
    const ha=((lst-ra)%24+24)%24;
    const haR=ha*15*r, decR=dec*r, latR=lat*r;
    const sinAlt=Math.sin(decR)*Math.sin(latR)+Math.cos(decR)*Math.cos(latR)*Math.cos(haR);
    const alt=Math.asin(Math.max(-1,Math.min(1,sinAlt)))/r;
    const c=(Math.sin(decR)-Math.sin(alt*r)*Math.sin(latR))/(Math.cos(alt*r)*Math.cos(latR));
    let az=Math.acos(Math.max(-1,Math.min(1,c)))/r;
    if(Math.sin(haR)>0) az=360-az;
    return {alt,az};
}
function proj(alt: number, az: number, cx: number, cy: number, R: number) {
    if(alt < -8) return null;
    const zd=90-alt;
    if(zd>92) return null;
    const r=R*Math.tan(zd*Math.PI/180/2)/Math.tan(Math.PI/2*0.999);
    return {x:cx+r*Math.sin(az*Math.PI/180), y:cy-r*Math.cos(az*Math.PI/180)};
}

// ─── Heart clip path ─────────────────────────────────────────────────────────
function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(cx, cy+s*0.35);
    ctx.bezierCurveTo(cx-s*1.25,cy-s*0.35, cx-s*1.25,cy-s, cx,cy-s*0.5);
    ctx.bezierCurveTo(cx+s*1.25,cy-s, cx+s*1.25,cy-s*0.35, cx,cy+s*0.35);
    ctx.closePath();
}

// ─── Forest background ───────────────────────────────────────────────────────
function drawForest(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const sky=ctx.createLinearGradient(0,0,0,H*0.7);
    sky.addColorStop(0,'#060d1f'); sky.addColorStop(0.6,'#0e2040'); sky.addColorStop(1,'#1a4060');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
    // Mountains
    ctx.fillStyle='#0a1a30';
    ctx.beginPath(); ctx.moveTo(0,H*0.6);
    const mts=[[0.1,0.32],[0.22,0.48],[0.35,0.24],[0.5,0.4],[0.62,0.2],[0.76,0.36],[0.88,0.27],[1,0.44]];
    mts.forEach(([x,y])=>ctx.lineTo(x*W,y*H));
    ctx.lineTo(W,H*0.6); ctx.closePath(); ctx.fill();
    // Trees
    const seed=42;
    for(let x=-5;x<W+5;x+=15) {
        const h=40+Math.sin(x*0.31+seed)*10;
        const base=H*0.62+Math.sin(x*0.17)*6;
        ctx.fillStyle='#050e1e';
        ctx.beginPath(); ctx.moveTo(x,base);
        ctx.lineTo(x-8,base-h*0.45); ctx.lineTo(x-5,base-h*0.45);
        ctx.lineTo(x-10,base-h*0.72); ctx.lineTo(x-4,base-h*0.72);
        ctx.lineTo(x,base-h); ctx.lineTo(x+4,base-h*0.72);
        ctx.lineTo(x+10,base-h*0.72); ctx.lineTo(x+5,base-h*0.45);
        ctx.lineTo(x+8,base-h*0.45); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle='#050e1e'; ctx.fillRect(0,H*0.67,W,H*0.33);
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function StarMapPreview({ config }: { config: StarMapConfig }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current; if(!canvas) return;
        const ctx = canvas.getContext('2d'); if(!ctx) return;
        const W=600, H=800;
        canvas.width=W; canvas.height=H;

        const isHeart  = config.style==='heart-dark'||config.style==='heart-light';
        const isForest = config.style==='forest-peak';
        const isFull   = config.style==='full-bleed';
        const isLight  = config.style==='light-minimal'||config.style==='heart-light';

        // ── BG ──
        if(isForest) drawForest(ctx,W,H);
        else { ctx.fillStyle=config.backgroundColor; ctx.fillRect(0,0,W,H); }

        // ── Map geometry ──
        const mapH = isFull ? H : Math.round(H*0.64);
        const cx=W/2, cy = isFull ? H/2 : mapH/2;
        const R = isHeart
            ? Math.min(W,mapH)*0.39
            : Math.min(W/2-24, mapH/2-24)*0.96;

        const jd=getJD(config.date, config.time);
        const lat=config.latitude, lon=config.longitude;

        // ── Clip ──
        ctx.save();
        if(isHeart) {
            drawHeart(ctx,cx,cy-R*0.08,R*1.12); ctx.clip();
        } else if(!isFull) {
            ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
        }

        // Fill inside clip
        if(!isForest) { ctx.fillStyle=config.backgroundColor; ctx.fillRect(0,0,W,H); }
        else if(isHeart) { ctx.fillStyle=config.backgroundColor; ctx.fillRect(0,0,W,H); }

        // ── Milky Way band ──
        if(config.showMilkyWay!==false) {
            const mwPts: [number,number][] = [
                [0,-5],[0.5,-15],[1,-25],[1.5,-35],[2,-43],[2.5,-48],[3,-51],[3.5,-52],
                [4,-50],[4.5,-45],[5,-37],[5.5,-28],[6,-18],[6.5,-8],[7,2],[7.5,12],
                [8,20],[8.5,24],[9,27],[9.5,29],[10,27],[10.5,21],[11,13],[11.5,3],
                [12,-7],[12.5,-17],[13,-27],[13.5,-37],[14,-47],[14.5,-52],[15,-56],
                [15.5,-58],[16,-59],[16.5,-59],[17,-56],[17.5,-51],[18,-43],[18.5,-33],
                [19,-21],[19.5,-9],[20,3],[20.5,13],[21,20],[21.5,24],[22,25],
                [22.5,22],[23,15],[23.5,7],[24,-2]
            ];
            const pts = mwPts.map(([ra,dec])=>{
                const {alt,az}=altaz(ra,dec,lat,lon,jd);
                return proj(alt,az,cx,cy,R);
            }).filter(Boolean) as {x:number;y:number}[];
            if(pts.length>4) {
                ctx.save();
                ctx.globalAlpha=0.06;
                ctx.strokeStyle=config.starColor;
                ctx.lineWidth=28; ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
                for(let i=1;i<pts.length;i++) {
                    const dx=pts[i].x-pts[i-1].x, dy=pts[i].y-pts[i-1].y;
                    if(dx*dx+dy*dy>R*R*0.25){ ctx.moveTo(pts[i].x,pts[i].y); continue; }
                    ctx.lineTo(pts[i].x,pts[i].y);
                }
                ctx.stroke();
                ctx.restore();
            }
        }

        // ── Coord grid ──
        if(config.showGrid) {
            ctx.save();
            ctx.strokeStyle=config.starColor; ctx.globalAlpha=0.1; ctx.lineWidth=0.5;
            for(let alt=0;alt<=90;alt+=30) {
                const zd=90-alt;
                const r=R*Math.tan(zd*Math.PI/180/2)/Math.tan(Math.PI/2*0.999);
                ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
            }
            for(let az=0;az<360;az+=30) {
                const a=az*Math.PI/180;
                ctx.beginPath(); ctx.moveTo(cx,cy);
                ctx.lineTo(cx+R*Math.sin(a),cy-R*Math.cos(a)); ctx.stroke();
            }
            // N/S/E/W
            ctx.globalAlpha=0.35; ctx.fillStyle=config.starColor;
            ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
            [['N',0],['E',90],['S',180],['W',270]].forEach(([l,a])=>{
                const ar=(a as number)*Math.PI/180;
                ctx.fillText(l as string, cx+(R+14)*Math.sin(ar), cy-(R+14)*Math.cos(ar));
            });
            ctx.restore();
        }

        // ── Constellation lines ──
        if(config.showConstellations!==false) {
            ctx.save();
            ctx.strokeStyle=config.starColor;
            ctx.lineWidth = isLight ? 0.8 : 1.0;
            ctx.globalAlpha = isLight ? 0.35 : 0.65;
            for(const [ra1,dec1,ra2,dec2] of CONSTELLATION_LINES) {
                const p1=proj(...Object.values(altaz(ra1,dec1,lat,lon,jd)) as [number,number],cx,cy,R);
                const p2=proj(...Object.values(altaz(ra2,dec2,lat,lon,jd)) as [number,number],cx,cy,R);
                if(!p1||!p2) continue;
                ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
            }
            ctx.restore();
        }

        // ── Stars ──
        for(const [ra,dec,mag] of STAR_CATALOG) {
            const {alt,az}=altaz(ra,dec,lat,lon,jd);
            const pos=proj(alt,az,cx,cy,R); if(!pos) continue;
            const size=Math.max(0.5, 4.2-(mag+1.5)*0.55);
            const alpha=Math.max(0.55, Math.min(1.0, 1.15-mag*0.12));
            // Glow on bright stars
            if(mag<1.5) {
                const g=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,size*4.5);
                g.addColorStop(0,config.starColor);
                g.addColorStop(0.35,config.starColor+'99');
                g.addColorStop(1,config.starColor+'00');
                ctx.globalAlpha=alpha*0.45; ctx.fillStyle=g;
                ctx.beginPath(); ctx.arc(pos.x,pos.y,size*4.5,0,Math.PI*2); ctx.fill();
            }
            ctx.globalAlpha=alpha; ctx.fillStyle=config.starColor;
            ctx.beginPath(); ctx.arc(pos.x,pos.y,size,0,Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha=1;

        // ── Constellation labels ──
        if(config.showConstellations!==false) {
            ctx.save();
            ctx.font=`${isLight?'10':'9'}px ${config.fontFamily}`;
            ctx.fillStyle=config.textColor;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.globalAlpha=isLight?0.4:0.55;
            for(const [ra,dec,name] of CONSTELLATION_LABELS) {
                const {alt,az}=altaz(ra,dec,lat,lon,jd);
                const pos=proj(alt,az,cx,cy,R); if(!pos) continue;
                // Keep inside circle
                const dx=pos.x-cx, dy=pos.y-cy;
                if(dx*dx+dy*dy>(R*0.92)*(R*0.92)) continue;
                ctx.fillText(name, pos.x, pos.y);
            }
            ctx.restore();
        }

        ctx.restore(); // end clip

        // ── Border ──
        if(isHeart) {
            ctx.save(); drawHeart(ctx,cx,cy-R*0.08,R*1.12);
            ctx.strokeStyle=isLight?'rgba(0,0,0,0.2)':'rgba(255,255,255,0.5)';
            ctx.lineWidth=2; ctx.stroke(); ctx.restore();
        } else if(!isFull) {
            ctx.strokeStyle=isLight?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.45)';
            ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
        }

        // Thin outer border
        if(!isFull) {
            ctx.strokeStyle=isLight?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.1)';
            ctx.lineWidth=1; ctx.strokeRect(14,14,W-28,H-28);
        }

        // ── Text block ──
        ctx.fillStyle=config.textColor;
        ctx.textAlign='center'; ctx.textBaseline='alphabetic';

        if(isFull) {
            if(config.headline) {
                ctx.font=`bold 28px ${config.fontFamily}`;
                ctx.globalAlpha=0.92; ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=10;
                ctx.fillText(config.headline, W/2, 56);
                ctx.shadowBlur=0; ctx.globalAlpha=1;
            }
        } else {
            const tY=mapH+30;
            // Divider
            ctx.strokeStyle=isLight?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.08)';
            ctx.lineWidth=1; ctx.beginPath();
            ctx.moveTo(W*0.2,mapH+1); ctx.lineTo(W*0.8,mapH+1); ctx.stroke();

            // Headline (word-wrap)
            if(config.headline) {
                ctx.font=`bold 24px ${config.fontFamily}`;
                const mw=W*0.8; const words=config.headline.split(' ');
                let line='', y=tY;
                for(let i=0;i<words.length;i++) {
                    const t=line+words[i]+' ';
                    if(ctx.measureText(t).width>mw&&i>0){ctx.fillText(line.trim(),W/2,y);line=words[i]+' ';y+=30;}
                    else line=t;
                }
                ctx.fillText(line.trim(),W/2,y);
            }

            // Heart symbol
            ctx.font='16px sans-serif';
            ctx.globalAlpha=0.7;
            ctx.fillText('♥', W/2, tY+56);
            ctx.globalAlpha=1;

            // Location line
            const locationLine = config.location || '';
            // Date: from config.date formatted
            const dateStr = config.date
                ? new Date(config.date+'T12:00:00').toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric'})
                : '';

            ctx.font=`14px ${config.fontFamily}`;
            ctx.globalAlpha=0.65;
            if(locationLine) ctx.fillText(locationLine, W/2, tY+78);
            if(dateStr) ctx.fillText(dateStr, W/2, tY+78+(locationLine?22:0));

            // Dedication
            if(config.dedication) {
                const dY=tY+78+(locationLine?22:0)+(dateStr?22:0)+10;
                ctx.font=`italic 12px ${config.fontFamily}`;
                ctx.globalAlpha=0.55;
                const mw=W*0.76; const words=config.dedication.split(' ');
                let line='', y=dY;
                for(let i=0;i<words.length;i++) {
                    const t=line+words[i]+' ';
                    if(ctx.measureText(t).width>mw&&i>0){ctx.fillText(line.trim(),W/2,y);line=words[i]+' ';y+=18;}
                    else line=t;
                }
                ctx.fillText(line.trim(),W/2,y);
            }
            ctx.globalAlpha=1;

            // Coordinates — bottom
            ctx.font=`10px ${config.fontFamily}`;
            ctx.globalAlpha=0.35;
            const latS=lat>=0?`${lat.toFixed(4)}° N`:`${Math.abs(lat).toFixed(4)}° S`;
            const lonS=lon>=0?`${lon.toFixed(4)}° E`:`${Math.abs(lon).toFixed(4)}° W`;
            ctx.fillText(`${latS}  ${lonS}`, W/2, H-18);
            ctx.globalAlpha=1;
        }

    }, [config]);

    return (
        <div className="rounded-lg shadow-lg overflow-hidden" style={{backgroundColor: config.backgroundColor}}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        objectFit: 'contain',
                    }}
                />
            </div>
            <div className="text-center py-2 text-xs text-gray-400">
                {config.size} · {config.productType} · {config.price} ₴
            </div>
        </div>
    );
}
