'use client';

import { useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';

interface LoveMapConfig {
    location1: string;
    latitude1: number;
    longitude1: number;
    location2: string;
    latitude2: number;
    longitude2: number;
    names: string;
    date: string;
    subtitle: string;
    colorScheme: string;
    backgroundColor: string;
    mapColor: string;
    textColor: string;
    fontFamily: string;
    size: string;
    productType: string;
    price: number;
}

interface LoveMapPreviewProps {
    config: LoveMapConfig;
}

export default function LoveMapPreview({ config }: LoveMapPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size (preview resolution)
        canvas.width = 600;
        canvas.height = 800;

        // Clear canvas
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw two heart-shaped maps side by side
        const heartWidth = 250;
        const heartHeight = 250;
        const spacing = 50;
        const startX = (canvas.width - (heartWidth * 2 + spacing)) / 2;
        const startY = 120;

        // Helper function to draw a heart shape
        const drawHeartShape = (x: number, y: number, size: number) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.beginPath();
            ctx.moveTo(0, size * 0.3);
            // Left curve
            ctx.bezierCurveTo(-size * 0.5, -size * 0.2, -size * 0.5, size * 0.5, 0, size);
            // Right curve
            ctx.bezierCurveTo(size * 0.5, size * 0.5, size * 0.5, -size * 0.2, 0, size * 0.3);
            ctx.closePath();
            ctx.restore();
        };

        // Draw Heart 1 (Location 1)
        ctx.save();
        drawHeartShape(startX + heartWidth / 2, startY, heartWidth / 2);
        ctx.fillStyle = config.mapColor;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = config.mapColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Draw simplified "map" inside heart 1
        ctx.save();
        ctx.clip();
        drawHeartShape(startX + heartWidth / 2, startY, heartWidth / 2);
        ctx.strokeStyle = config.mapColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        // Draw random "streets" to simulate a map
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(startX + Math.random() * heartWidth, startY + Math.random() * heartHeight);
            ctx.lineTo(startX + Math.random() * heartWidth, startY + Math.random() * heartHeight);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // Location 1 label
        ctx.fillStyle = config.textColor;
        ctx.font = `14px ${config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText(config.location1, startX + heartWidth / 2, startY + heartHeight + 30);

        // Draw Heart 2 (Location 2)
        const heart2X = startX + heartWidth + spacing;
        ctx.save();
        drawHeartShape(heart2X + heartWidth / 2, startY, heartWidth / 2);
        ctx.fillStyle = config.mapColor;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = config.mapColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Draw simplified "map" inside heart 2
        ctx.save();
        ctx.clip();
        drawHeartShape(heart2X + heartWidth / 2, startY, heartWidth / 2);
        ctx.strokeStyle = config.mapColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(heart2X + Math.random() * heartWidth, startY + Math.random() * heartHeight);
            ctx.lineTo(heart2X + Math.random() * heartWidth, startY + Math.random() * heartHeight);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // Location 2 label
        ctx.fillStyle = config.textColor;
        ctx.font = `14px ${config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText(config.location2, heart2X + heartWidth / 2, startY + heartHeight + 30);

        // Draw connecting heart icon between the two hearts
        const connectX = canvas.width / 2;
        const connectY = startY + heartHeight / 2;
        ctx.fillStyle = config.mapColor;
        ctx.save();
        drawHeartShape(connectX, connectY, 20);
        ctx.fill();
        ctx.restore();

        // Draw text at top
        if (config.names) {
            ctx.fillStyle = config.textColor;
            ctx.font = `bold 32px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(config.names, canvas.width / 2, 60);
        }

        // Draw date
        if (config.date) {
            ctx.fillStyle = config.textColor;
            ctx.font = `18px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            const dateObj = new Date(config.date);
            const formattedDate = dateObj.toLocaleDateString('uk-UA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            ctx.fillText(formattedDate, canvas.width / 2, 90);
        }

        // Draw subtitle at bottom
        if (config.subtitle) {
            ctx.fillStyle = config.textColor;
            ctx.font = `italic 16px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.globalAlpha = 0.8;

            // Word wrap subtitle
            const maxWidth = canvas.width - 80;
            const words = config.subtitle.split(' ');
            let line = '';
            let y = startY + heartHeight + 70;

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    ctx.fillText(line, canvas.width / 2, y);
                    line = words[n] + ' ';
                    y += 24;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, canvas.width / 2, y);
            ctx.globalAlpha = 1;
        }

        // Draw coordinates at bottom
        ctx.fillStyle = config.textColor;
        ctx.font = `10px monospace`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.6;
        ctx.fillText(
            `${config.latitude1.toFixed(4)}°, ${config.longitude1.toFixed(4)}° • ${config.latitude2.toFixed(4)}°, ${config.longitude2.toFixed(4)}°`,
            canvas.width / 2,
            canvas.height - 20
        );
        ctx.globalAlpha = 1;

    }, [config]);

    return (
        <div className="flex flex-col items-center">
            <canvas
                ref={canvasRef}
                className="w-full max-w-md shadow-lg rounded"
                style={{
                    aspectRatio: '3/4',
                    backgroundColor: config.backgroundColor
                }}
            />
            <p className="text-sm text-gray-500 mt-4 text-center">
                Прев'ю оновлюється в реальному часі
            </p>
        </div>
    );
}
