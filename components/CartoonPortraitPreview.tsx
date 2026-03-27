'use client';

import { useEffect, useRef } from 'react';

interface CartoonPortraitConfig {
    uploadedPhotoPreview: string | null;
    animationStyle: string;
    backgroundType: string;
    backgroundColor: string;
    gradientColors: [string, string];
    sceneType: string | null;
    captionText: string;
    fontFamily: string;
    textColor: string;
    addDate: boolean;
    addName: boolean;
    customName: string;
    generatedPortrait: string | null;
    isProcessing: boolean;
    size: string;
    productType: string;
}

interface CartoonPortraitPreviewProps {
    config: CartoonPortraitConfig;
}

export default function CartoonPortraitPreview({ config }: CartoonPortraitPreviewProps) {
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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw background
        if (config.backgroundType === 'solid') {
            ctx.fillStyle = config.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (config.backgroundType === 'gradient') {
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, config.gradientColors[0]);
            gradient.addColorStop(1, config.gradientColors[1]);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (config.backgroundType === 'scene') {
            // Draw simple scene background
            if (config.sceneType === 'city') {
                ctx.fillStyle = '#87CEEB'; // Sky blue
                ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
                ctx.fillStyle = '#D3D3D3'; // Gray for city
                ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
            } else if (config.sceneType === 'nature') {
                ctx.fillStyle = '#87CEEB'; // Sky blue
                ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
                ctx.fillStyle = '#90EE90'; // Light green
                ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
            } else if (config.sceneType === 'fantasy') {
                const fantasyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                fantasyGradient.addColorStop(0, '#9b59b6');
                fantasyGradient.addColorStop(1, '#3498db');
                ctx.fillStyle = fantasyGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        } else if (config.backgroundType === 'transparent') {
            // Checkerboard pattern for transparency
            const size = 20;
            for (let y = 0; y < canvas.height; y += size) {
                for (let x = 0; x < canvas.width; x += size) {
                    ctx.fillStyle = ((x / size) + (y / size)) % 2 === 0 ? '#f0f0f0' : '#ffffff';
                    ctx.fillRect(x, y, size, size);
                }
            }
        }

        // Draw portrait image
        const portraitImage = new Image();
        portraitImage.crossOrigin = 'anonymous';

        portraitImage.onload = () => {
            const portraitWidth = 400;
            const portraitHeight = 400;
            const portraitX = (canvas.width - portraitWidth) / 2;
            const portraitY = 100;

            // Draw white frame around portrait
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(portraitX - 10, portraitY - 10, portraitWidth + 20, portraitHeight + 20);

            // Draw shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 5;

            // Draw portrait
            ctx.drawImage(portraitImage, portraitX, portraitY, portraitWidth, portraitHeight);

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            // Add processing overlay if generating
            if (config.isProcessing) {
                ctx.fillStyle = 'rgba(147, 51, 234, 0.7)';
                ctx.fillRect(portraitX, portraitY, portraitWidth, portraitHeight);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 24px Montserrat';
                ctx.textAlign = 'center';
                ctx.fillText('Генерація...', canvas.width / 2, portraitY + portraitHeight / 2);
            }

            // Draw caption text
            if (config.captionText) {
                const textY = portraitY + portraitHeight + 60;
                ctx.fillStyle = config.textColor;
                ctx.font = `28px ${config.fontFamily}`;
                ctx.textAlign = 'center';
                ctx.fillText(config.captionText, canvas.width / 2, textY);
            }

            // Draw name
            if (config.addName && config.customName) {
                const nameY = config.captionText
                    ? portraitY + portraitHeight + 100
                    : portraitY + portraitHeight + 60;
                ctx.fillStyle = config.textColor;
                ctx.font = `20px ${config.fontFamily}`;
                ctx.textAlign = 'center';
                ctx.fillText(config.customName, canvas.width / 2, nameY);
            }

            // Draw date
            if (config.addDate) {
                const dateY = portraitY + portraitHeight + (config.captionText ? 130 : config.addName ? 100 : 60);
                const dateStr = new Date().toLocaleDateString('uk-UA', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                ctx.fillStyle = config.textColor;
                ctx.font = `16px ${config.fontFamily}`;
                ctx.textAlign = 'center';
                ctx.globalAlpha = 0.7;
                ctx.fillText(dateStr, canvas.width / 2, dateY);
                ctx.globalAlpha = 1;
            }
        };

        // Use generated portrait if available, otherwise show uploaded photo or placeholder
        if (config.generatedPortrait) {
            portraitImage.src = config.generatedPortrait;
        } else if (config.uploadedPhotoPreview) {
            portraitImage.src = config.uploadedPhotoPreview;
        } else {
            // Draw placeholder
            const portraitWidth = 400;
            const portraitHeight = 400;
            const portraitX = (canvas.width - portraitWidth) / 2;
            const portraitY = 100;

            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(portraitX, portraitY, portraitWidth, portraitHeight);

            ctx.fillStyle = '#9ca3af';
            ctx.font = '20px Montserrat';
            ctx.textAlign = 'center';
            ctx.fillText('Завантажте фото', canvas.width / 2, portraitY + portraitHeight / 2);
        }

    }, [config]);

    return (
        <div className="flex flex-col items-center">
            {/* Side-by-side comparison if portrait is generated */}
            {config.generatedPortrait && config.uploadedPhotoPreview && (
                <div className="grid grid-cols-2 gap-4 mb-6 w-full">
                    <div className="text-center">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Оригінал</p>
                        <img
                            src={config.uploadedPhotoPreview}
                            alt="Original"
                            className="w-full aspect-square object-cover rounded-lg shadow-md"
                        />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-gray-700 mb-2">AI Портрет</p>
                        <img
                            src={config.generatedPortrait}
                            alt="Generated"
                            className="w-full aspect-square object-cover rounded-lg shadow-md"
                        />
                    </div>
                </div>
            )}

            {/* Main canvas preview */}
            <canvas
                ref={canvasRef}
                className="w-full max-w-md shadow-lg rounded"
                style={{
                    aspectRatio: '3/4'
                }}
            />

            <p className="text-sm text-gray-500 mt-4 text-center">
                {config.isProcessing
                    ? 'Генеруємо ваш портрет...'
                    : config.generatedPortrait
                    ? 'Прев\'ю фінального постера'
                    : 'Прев\'ю оновлюється в реальному часі'}
            </p>

            {/* Processing info */}
            {config.isProcessing && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                    Це може зайняти 30-60 секунд
                </p>
            )}
        </div>
    );
}
