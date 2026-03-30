'use client';

import { useEffect, useRef } from 'react';
import { STAR_CATALOG, CONSTELLATION_LINES } from '@/lib/astronomy/starCatalog';

interface StarMapConfig {
    date: string;
    time: string;
    location: string;
    latitude: number;
    longitude: number;
    headline: string;
    subtitle: string;
    dedication: string;
    style: 'classic-dark' | 'light-minimal' | 'circular' | 'full-bleed' | 'with-horizon';
    backgroundColor: string;
    starColor: string;
    textColor: string;
    fontFamily: string;
    size: string;
    productType: string;
    price: number;
}

interface StarMapPreviewProps {
    config: StarMapConfig;
}

function toRad(deg: number) { return deg * Math.PI / 180; }
function toDeg(rad: number) { return rad * 180 / Math.PI; }

function getJulianDate(dateStr: string, timeStr: string): number {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, m] = timeStr.split(':').map(Number);
    const ut = h + m / 60;
    const A = Math.floor((14 - mo) / 12);
    const Y = y + 4800 - A;
    const M = mo + 12 * A - 3;
    const JDN = d + Math.floor((153 * M + 2) / 5) + 365 * Y +
        Math.floor(Y / 4) - Math.floor(Y / 100) + Math.floor(Y / 400) - 32045;
    return JDN + (ut - 12) / 24;
}

function getGMST(jd: number): number {
    const T = (jd - 2451545.0) / 36525.0;
    let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) +
        T * T * 0.000387933 - T * T * T / 38710000.0;
    gmst = ((gmst % 360) + 360) % 360;
    return gmst / 15;
}

function raDecToAltAz(ra: number, dec: number, lat: number, lon: number, jd: number): { alt: number; az: number } {
    const gmst = getGMST(jd);
    const lst = ((gmst + lon / 15) % 24 + 24) % 24;
    const ha = ((lst - ra) % 24 + 24) % 24;
    const haRad = toRad(ha * 15);
    const decRad = toRad(dec);
    const latRad = toRad(lat);
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const alt = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
    const cosAz = (Math.sin(decRad) - Math.sin(toRad(alt)) * Math.sin(latRad)) /
        (Math.cos(toRad(alt)) * Math.cos(latRad));
    let az = toDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
    if (Math.sin(haRad) > 0) az = 360 - az;
    return { alt, az };
}

function altAzToXY(alt: number, az: number, cx: number, cy: number, radius: number, fov: number): { x: number; y: number } | null {
    if (alt < -8) return null;
    const zenithDist = 90 - alt;
    if (zenithDist > fov) return null;
    const r = radius * Math.tan(toRad(zenithDist) / 2) / Math.tan(toRad(fov) / 2);
    const azRad = toRad(az);
    return { x: cx + r * Math.sin(azRad), y: cy - r * Math.cos(azRad) };
}

export default function StarMapPreview({ config }: StarMapPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = 600, H = 800;
        canvas.width = W;
        canvas.height = H;

        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, W, H);

        const isFullBleed = config.style === 'full-bleed';
        const isCircular = config.style === 'circular';
        const mapAreaH = isFullBleed ? H : Math.round(H * 0.62);
        const mapCX = W / 2;
        const mapCY = isFullBleed ? H / 2 : mapAreaH / 2;
        const mapRadius = isCircular
            ? Math.min(W, mapAreaH) * 0.44
            : Math.min(W / 2, mapAreaH / 2) * 0.95;
        const FOV = 90;

        const jd = getJulianDate(config.date, config.time);

        ctx.save();
        if (isCircular) {
            ctx.beginPath();
            ctx.arc(mapCX, mapCY, mapRadius, 0, Math.PI * 2);
            ctx.clip();
        } else if (!isFullBleed) {
            ctx.rect(0, 0, W, mapAreaH);
            ctx.clip();
        }

        // Constellation lines
        ctx.strokeStyle = config.starColor;
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 0.8;
        for (const [ra1, dec1, ra2, dec2] of CONSTELLATION_LINES) {
            const p1 = altAzToXY(...Object.values(raDecToAltAz(ra1, dec1, config.latitude, config.longitude, jd)) as [number, number], mapCX, mapCY, mapRadius, FOV);
            const p2 = altAzToXY(...Object.values(raDecToAltAz(ra2, dec2, config.latitude, config.longitude, jd)) as [number, number], mapCX, mapCY, mapRadius, FOV);
            if (!p1 || !p2) continue;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        // Stars
        ctx.globalAlpha = 1;
        for (const [ra, dec, mag, name] of STAR_CATALOG) {
            const { alt, az } = raDecToAltAz(ra, dec, config.latitude, config.longitude, jd);
            const pos = altAzToXY(alt, az, mapCX, mapCY, mapRadius, FOV);
            if (!pos) continue;
            const size = Math.max(0.5, 4.0 - (mag + 1.5) * 0.6);
            const alpha = Math.max(0.3, Math.min(1.0, 1.0 - (mag - 0.0) * 0.18));

            if (mag < 1.5) {
                const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size * 4);
                glow.addColorStop(0, config.starColor);
                glow.addColorStop(0.4, config.starColor + '88');
                glow.addColorStop(1, config.starColor + '00');
                ctx.globalAlpha = alpha * 0.6;
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, size * 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = alpha;
            ctx.fillStyle = config.starColor;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.fill();

            if (mag < 1.2 && name) {
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = config.textColor;
                ctx.font = `10px ${config.fontFamily}`;
                ctx.textAlign = 'left';
                ctx.fillText(name, pos.x + size + 3, pos.y + 4);
            }
        }

        ctx.globalAlpha = 1;
        ctx.restore();

        if (isCircular) {
            ctx.strokeStyle = config.textColor;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(mapCX, mapCY, mapRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        if (config.style === 'with-horizon') {
            ctx.strokeStyle = config.textColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.35;
            ctx.setLineDash([4, 4]);
            const horizY = mapCY + mapRadius;
            ctx.beginPath();
            ctx.moveTo(mapCX - mapRadius, Math.min(horizY, mapAreaH - 2));
            ctx.lineTo(mapCX + mapRadius, Math.min(horizY, mapAreaH - 2));
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        if (!isFullBleed && !isCircular) {
            ctx.strokeStyle = config.textColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.15;
            ctx.beginPath();
            ctx.moveTo(W * 0.1, mapAreaH + 1);
            ctx.lineTo(W * 0.9, mapAreaH + 1);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Text
        ctx.fillStyle = config.textColor;
        ctx.textAlign = 'center';
        const textStartY = isFullBleed ? 52 : mapAreaH + 32;

        if (config.headline) {
            ctx.font = `bold 30px ${config.fontFamily}`;
            ctx.globalAlpha = isFullBleed ? 0.9 : 1;
            ctx.fillText(config.headline, W / 2, textStartY);
            ctx.globalAlpha = 1;
        }
        if (config.subtitle) {
            ctx.font = `15px ${config.fontFamily}`;
            ctx.globalAlpha = 0.72;
            ctx.fillText(config.subtitle, W / 2, textStartY + 30);
            ctx.globalAlpha = 1;
        }
        if (config.dedication) {
            ctx.font = `italic 13px ${config.fontFamily}`;
            ctx.globalAlpha = 0.62;
            const maxW = W * 0.78;
            const words = config.dedication.split(' ');
            let line = '', lineY = textStartY + (config.subtitle ? 64 : 42);
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                if (ctx.measureText(testLine).width > maxW && i > 0) {
                    ctx.fillText(line.trim(), W / 2, lineY);
                    line = words[i] + ' '; lineY += 20;
                } else { line = testLine; }
            }
            ctx.fillText(line.trim(), W / 2, lineY);
            ctx.globalAlpha = 1;
        }

        // Coordinates
        ctx.font = `10px ${config.fontFamily}`;
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.4;
        const latStr = config.latitude >= 0 ? `${config.latitude.toFixed(2)}° N` : `${Math.abs(config.latitude).toFixed(2)}° S`;
        const lonStr = config.longitude >= 0 ? `${config.longitude.toFixed(2)}° E` : `${Math.abs(config.longitude).toFixed(2)}° W`;
        ctx.fillText(`${latStr}, ${lonStr}`, W - 12, H - 12);
        ctx.globalAlpha = 1;

    }, [config]);

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Попередній перегляд</h3>
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    className="w-full h-auto border border-gray-200 rounded-lg"
                    style={{ maxHeight: '80vh' }}
                />
                <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600">
                        {config.size} • {config.productType} • {config.price} ₴
                    </p>
                </div>
            </div>
        </div>
    );
}
