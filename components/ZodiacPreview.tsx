'use client';

import { useEffect, useRef } from 'react';

interface ZodiacConfig {
    zodiacSign: string;
    zodiacSymbol: string;
    birthDate: string;
    name: string;
    dateText: string;
    style: string;
    backgroundColor: string;
    zodiacColor: string;
    textColor: string;
    fontFamily: string;
    size: string;
    productType: string;
    price: number;
}

interface ZodiacPreviewProps {
    config: ZodiacConfig;
}

export default function ZodiacPreview({ config }: ZodiacPreviewProps) {
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

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Draw style-specific elements
        if (config.style === 'constellation') {
            // Draw stars
            ctx.fillStyle = config.zodiacColor;
            ctx.globalAlpha = 0.8;

            for (let i = 0; i < 100; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 2;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1;

            // Draw constellation pattern (simplified)
            ctx.strokeStyle = config.zodiacColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;

            const constellationPoints = [
                { x: centerX - 80, y: centerY - 60 },
                { x: centerX - 40, y: centerY - 100 },
                { x: centerX + 40, y: centerY - 80 },
                { x: centerX + 80, y: centerY - 40 },
                { x: centerX + 60, y: centerY + 20 },
                { x: centerX, y: centerY + 60 },
                { x: centerX - 60, y: centerY + 40 }
            ];

            // Draw lines between points
            ctx.beginPath();
            ctx.moveTo(constellationPoints[0].x, constellationPoints[0].y);
            constellationPoints.forEach(point => {
                ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();

            // Draw stars at constellation points
            ctx.fillStyle = config.zodiacColor;
            ctx.globalAlpha = 1;
            constellationPoints.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        if (config.style === 'illustrated-symbol') {
            // Draw decorative circle
            ctx.strokeStyle = config.zodiacColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 180, 0, Math.PI * 2);
            ctx.stroke();

            ctx.globalAlpha = 0.15;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 160, 0, Math.PI * 2);
            ctx.stroke();

            ctx.globalAlpha = 1;
        }

        if (config.style === 'aura-gradient') {
            // Draw gradient aura
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 250);
            gradient.addColorStop(0, config.zodiacColor + '60');
            gradient.addColorStop(0.5, config.zodiacColor + '20');
            gradient.addColorStop(1, config.zodiacColor + '00');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw zodiac symbol
        ctx.fillStyle = config.zodiacColor;
        ctx.font = `200px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.zodiacSymbol, centerX, centerY);

        // Draw zodiac name
        ctx.fillStyle = config.textColor;
        ctx.font = `bold 36px ${config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText(config.zodiacSign, centerX, 100);

        // Draw decorative line
        ctx.strokeStyle = config.zodiacColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 100, 130);
        ctx.lineTo(centerX + 100, 130);
        ctx.stroke();

        // Draw name if provided
        if (config.name) {
            ctx.fillStyle = config.textColor;
            ctx.font = `24px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(config.name, centerX, centerY + 170);
        }

        // Draw date text or dates range
        const displayDate = config.birthDate
            ? new Date(config.birthDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
            : config.dateText;

        if (displayDate) {
            ctx.fillStyle = config.textColor;
            ctx.font = `16px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.globalAlpha = 0.8;
            ctx.fillText(displayDate, centerX, canvas.height - 60);
            ctx.globalAlpha = 1;
        }

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
