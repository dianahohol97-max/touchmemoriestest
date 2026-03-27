'use client';

import { useEffect, useRef } from 'react';

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

export default function StarMapPreview({ config }: StarMapPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size (preview resolution)
        const width = 600;
        const height = 800;
        canvas.width = width;
        canvas.height = height;

        // Clear canvas
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Draw star map (placeholder for now - will integrate d3-celestial)
        drawStarMapPlaceholder(ctx, width, height, config);

        // Draw text overlays
        drawTextOverlays(ctx, width, height, config);

    }, [config]);

    const drawStarMapPlaceholder = (ctx: CanvasRenderingContext2D, width: number, height: number, config: StarMapConfig) => {
        // Calculate star map area based on style
        let mapX = 0;
        let mapY = 0;
        let mapWidth = width;
        let mapHeight = height * 0.6;

        if (config.style === 'circular') {
            const diameter = Math.min(width, height) * 0.6;
            mapX = (width - diameter) / 2;
            mapY = 50;
            mapWidth = diameter;
            mapHeight = diameter;

            // Draw circular boundary
            ctx.strokeStyle = config.textColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(width / 2, mapY + diameter / 2, diameter / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (config.style === 'full-bleed') {
            mapHeight = height;
        }

        // Draw placeholder stars (will be replaced with d3-celestial)
        drawPlaceholderStars(ctx, mapX, mapY, mapWidth, mapHeight, config);

        // Draw constellations placeholder
        if (config.style !== 'full-bleed') {
            drawPlaceholderConstellations(ctx, mapX, mapY, mapWidth, mapHeight, config);
        }

        // Draw horizon line for 'with-horizon' style
        if (config.style === 'with-horizon') {
            ctx.strokeStyle = config.textColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, mapY + mapHeight * 0.7);
            ctx.lineTo(width, mapY + mapHeight * 0.7);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw location pin
            ctx.fillStyle = config.textColor;
            ctx.beginPath();
            ctx.arc(width / 2, mapY + mapHeight * 0.7, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const drawPlaceholderStars = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, config: StarMapConfig) => {
        // Generate random stars based on date/location (deterministic)
        const seed = config.latitude + config.longitude + new Date(config.date).getTime();
        const random = (i: number) => {
            const x = Math.sin(seed + i) * 10000;
            return x - Math.floor(x);
        };

        ctx.fillStyle = config.starColor;

        // Draw ~200 stars with varying sizes
        for (let i = 0; i < 200; i++) {
            const starX = x + random(i * 2) * width;
            const starY = y + random(i * 2 + 1) * height;
            const size = random(i * 3) * 2 + 0.5;

            if (config.style === 'circular') {
                // Check if star is within circle
                const centerX = x + width / 2;
                const centerY = y + height / 2;
                const radius = width / 2;
                const dist = Math.sqrt(Math.pow(starX - centerX, 2) + Math.pow(starY - centerY, 2));
                if (dist > radius) continue;
            }

            ctx.globalAlpha = random(i * 4) * 0.5 + 0.5;
            ctx.beginPath();
            ctx.arc(starX, starY, size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    };

    const drawPlaceholderConstellations = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, config: StarMapConfig) => {
        // Draw a few constellation lines (placeholder)
        ctx.strokeStyle = config.starColor;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;

        // Big Dipper example
        const points = [
            [0.2, 0.3], [0.25, 0.25], [0.3, 0.2], [0.35, 0.25],
            [0.35, 0.35], [0.4, 0.4], [0.45, 0.45]
        ];

        ctx.beginPath();
        points.forEach((point, i) => {
            const px = x + point[0] * width;
            const py = y + point[1] * height;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();

        ctx.globalAlpha = 1;
    };

    const drawTextOverlays = (ctx: CanvasRenderingContext2D, width: number, height: number, config: StarMapConfig) => {
        ctx.fillStyle = config.textColor;
        ctx.textAlign = 'center';

        // Draw headline
        if (config.headline) {
            ctx.font = `bold 32px ${config.fontFamily}`;
            const headlineY = config.style === 'full-bleed' ? 50 : height * 0.65;
            ctx.fillText(config.headline, width / 2, headlineY);
        }

        // Draw subtitle
        if (config.subtitle) {
            ctx.font = `18px ${config.fontFamily}`;
            const subtitleY = config.style === 'full-bleed' ? 85 : height * 0.7;
            ctx.fillText(config.subtitle, width / 2, subtitleY);
        }

        // Draw dedication
        if (config.dedication) {
            ctx.font = `14px ${config.fontFamily}`;
            const dedicationY = config.style === 'full-bleed' ? height - 40 : height * 0.85;

            // Word wrap dedication text
            const maxWidth = width * 0.8;
            const words = config.dedication.split(' ');
            let line = '';
            let lineY = dedicationY;

            words.forEach((word, i) => {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && i > 0) {
                    ctx.fillText(line, width / 2, lineY);
                    line = word + ' ';
                    lineY += 20;
                } else {
                    line = testLine;
                }
            });
            ctx.fillText(line, width / 2, lineY);
        }

        // Draw coordinates (bottom right)
        ctx.font = `10px ${config.fontFamily}`;
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.7;
        ctx.fillText(
            `${config.latitude.toFixed(4)}° N, ${config.longitude.toFixed(4)}° E`,
            width - 10,
            height - 10
        );
        ctx.globalAlpha = 1;
    };

    return (
        <div ref={containerRef} className="bg-white rounded-lg shadow-lg p-6">
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
