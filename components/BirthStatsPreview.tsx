'use client';

import { useEffect, useRef } from 'react';

interface BirthStatsConfig {
    babyName: string;
    birthDate: string;
    birthTime: string;
    weight: string;
    height: string;
    templateStyle: string;
    zodiacSign: string;
    backgroundColor: string;
    textColor: string;
    accentColor: string;
    fontFamily: string;
    size: string;
    productType: string;
    price: number;
}

interface BirthStatsPreviewProps {
    config: BirthStatsConfig;
}

export default function BirthStatsPreview({ config }: BirthStatsPreviewProps) {
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

        // Draw baby name at top
        if (config.babyName) {
            ctx.fillStyle = config.textColor;
            ctx.font = `bold 48px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(config.babyName, centerX, 100);
        }

        // Draw decorative line
        ctx.strokeStyle = config.accentColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX - 100, 130);
        ctx.lineTo(centerX + 100, 130);
        ctx.stroke();

        // Format birth date
        let formattedDate = '';
        if (config.birthDate) {
            const dateObj = new Date(config.birthDate);
            formattedDate = dateObj.toLocaleDateString('uk-UA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }

        // Draw birth date
        if (formattedDate) {
            ctx.fillStyle = config.textColor;
            ctx.font = `20px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(formattedDate, centerX, 170);
        }

        // Stats section
        const statsY = 250;
        const lineHeight = 80;

        // Helper function to draw stat item
        const drawStat = (label: string, value: string, y: number) => {
            ctx.fillStyle = config.accentColor;
            ctx.font = `14px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(label.toUpperCase(), centerX, y);

            ctx.fillStyle = config.textColor;
            ctx.font = `bold 36px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(value, centerX, y + 45);
        };

        // Draw stats
        if (config.birthTime) {
            drawStat('ЧАС НАРОДЖЕННЯ', config.birthTime, statsY);
        }

        if (config.weight) {
            drawStat('ВАГА', `${config.weight} кг`, statsY + lineHeight);
        }

        if (config.height) {
            drawStat('ЗРІСТ', `${config.height} см`, statsY + lineHeight * 2);
        }

        // Draw zodiac sign if calculated
        if (config.zodiacSign) {
            ctx.fillStyle = config.accentColor;
            ctx.font = `16px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText('ЗНАК ЗОДІАКУ', centerX, statsY + lineHeight * 3);

            ctx.fillStyle = config.textColor;
            ctx.font = `28px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(config.zodiacSign, centerX, statsY + lineHeight * 3 + 40);
        }

        // Draw decorative elements based on template style
        if (config.templateStyle === 'pastel-illustrated') {
            // Draw baby footprints
            const drawFootprint = (x: number, y: number, scale: number) => {
                ctx.fillStyle = config.accentColor;
                ctx.globalAlpha = 0.3;

                // Toes
                for (let i = 0; i < 5; i++) {
                    ctx.beginPath();
                    ctx.arc(x + i * 8 * scale, y, 4 * scale, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Foot
                ctx.beginPath();
                ctx.ellipse(x + 16 * scale, y + 15 * scale, 12 * scale, 18 * scale, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = 1;
            };

            drawFootprint(80, 680, 1);
            drawFootprint(canvas.width - 110, 720, 1);

            // Draw stars
            const drawStar = (x: number, y: number, size: number) => {
                ctx.fillStyle = config.accentColor;
                ctx.globalAlpha = 0.4;
                ctx.font = `${size}px serif`;
                ctx.fillText('★', x, y);
                ctx.globalAlpha = 1;
            };

            drawStar(50, 200, 24);
            drawStar(canvas.width - 60, 220, 20);
            drawStar(70, 400, 16);
            drawStar(canvas.width - 80, 450, 18);
        }

        // Template-specific decorative elements
        if (config.templateStyle === 'minimal-modern') {
            // Draw geometric shapes
            ctx.strokeStyle = config.accentColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.2;

            ctx.beginPath();
            ctx.arc(80, 300, 30, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(canvas.width - 80, 500, 25, 0, Math.PI * 2);
            ctx.stroke();

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
