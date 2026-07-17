'use client';

import { useEffect, useRef } from 'react';

interface MonogramConfig {
    letter: string;
    language: string;
    style: string;
    customText: string;
    backgroundColor: string;
    letterColor: string;
    accentColor: string;
    fontFamily: string;
    size: string;
    productType: string;
    price: number;
}

interface MonogramPreviewProps {
    config: MonogramConfig;
}

export default function MonogramPreview({ config }: MonogramPreviewProps) {
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

        // Draw decorative elements based on style
        if (config.style === 'botanical') {
            // Draw botanical leaves around the letter
            ctx.strokeStyle = config.accentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5;

            // Top leaves
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
                const x = centerX + Math.cos(angle) * 150;
                const y = centerY - 100 + Math.sin(angle) * 150;
                ctx.moveTo(centerX, centerY - 100);
                ctx.quadraticCurveTo(centerX + 30, y - 20, x, y);
                ctx.stroke();
            }

            // Draw small circles (berries)
            ctx.fillStyle = config.accentColor;
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI * 2) / 8;
                const x = centerX + Math.cos(angle) * 180;
                const y = centerY + Math.sin(angle) * 180;
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1;
        }

        if (config.style === 'kids-animal') {
            // Draw cute animal silhouette (simplified bear/bunny shape)
            ctx.fillStyle = config.accentColor;
            ctx.globalAlpha = 0.3;

            // Ears
            ctx.beginPath();
            ctx.arc(centerX - 80, centerY - 200, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX + 80, centerY - 200, 40, 0, Math.PI * 2);
            ctx.fill();

            // Draw stars
            ctx.globalAlpha = 0.5;
            const drawStar = (x: number, y: number, size: number) => {
                ctx.font = `${size}px serif`;
                ctx.fillText('★', x, y);
            };
            drawStar(80, 150, 32);
            drawStar(canvas.width - 100, 200, 28);
            drawStar(100, 650, 24);
            drawStar(canvas.width - 90, 700, 30);

            ctx.globalAlpha = 1;
        }

        if (config.style === 'classic-serif') {
            // Draw elegant corner decorations
            ctx.strokeStyle = config.accentColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.4;

            // Top corners
            ctx.beginPath();
            ctx.moveTo(60, 80);
            ctx.lineTo(120, 80);
            ctx.moveTo(60, 80);
            ctx.lineTo(60, 140);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(canvas.width - 60, 80);
            ctx.lineTo(canvas.width - 120, 80);
            ctx.moveTo(canvas.width - 60, 80);
            ctx.lineTo(canvas.width - 60, 140);
            ctx.stroke();

            // Bottom corners
            ctx.beginPath();
            ctx.moveTo(60, canvas.height - 80);
            ctx.lineTo(120, canvas.height - 80);
            ctx.moveTo(60, canvas.height - 80);
            ctx.lineTo(60, canvas.height - 140);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(canvas.width - 60, canvas.height - 80);
            ctx.lineTo(canvas.width - 120, canvas.height - 80);
            ctx.moveTo(canvas.width - 60, canvas.height - 80);
            ctx.lineTo(canvas.width - 60, canvas.height - 140);
            ctx.stroke();

            ctx.globalAlpha = 1;
        }

        if (config.style === 'modern-sans') {
            // Draw geometric shapes
            ctx.strokeStyle = config.accentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.3;

            // Circles
            ctx.beginPath();
            ctx.arc(100, 150, 50, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(canvas.width - 100, canvas.height - 150, 60, 0, Math.PI * 2);
            ctx.stroke();

            // Lines
            ctx.beginPath();
            ctx.moveTo(80, canvas.height - 100);
            ctx.lineTo(200, canvas.height - 100);
            ctx.stroke();

            ctx.globalAlpha = 1;
        }

        // Draw the main letter
        ctx.fillStyle = config.letterColor;
        ctx.font = `bold 280px ${config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.letter, centerX, centerY);

        // Draw custom text below letter
        if (config.customText) {
            ctx.fillStyle = config.accentColor;
            ctx.font = `24px ${config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(config.customText, centerX, centerY + 200);
        }

        // Draw decorative line if there's custom text
        if (config.customText) {
            ctx.strokeStyle = config.accentColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX - 80, centerY + 180);
            ctx.lineTo(centerX + 80, centerY + 180);
            ctx.stroke();
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
