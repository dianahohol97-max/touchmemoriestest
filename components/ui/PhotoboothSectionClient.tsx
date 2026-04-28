'use client';

import React, { useState } from 'react';
import { PhotoboothEmbed, LAYOUTS } from '@/components/photobooth';
import styles from './PhotoboothSection.module.css';

interface SectionContent {
    heading?: string | null;
    subheading?: string | null;
    cta_text?: string | null;
    metadata?: {
        badge?: string;
        features?: Array<{
            icon: string;
            title: string;
            description: string;
        }>;
        help_text?: string;
        layouts?: Array<{
            name: string;
            description: string;
        }>;
    };
}

interface PhotoboothSectionClientProps {
    sectionContent?: SectionContent;
}

export const PhotoboothSectionClient: React.FC<PhotoboothSectionClientProps> = ({ sectionContent }) => {
    const [showPhotobooth, setShowPhotobooth] = useState(false);

    // Content with fallbacks
    const badge = sectionContent?.metadata?.badge || ' Новинка';
    const title = sectionContent?.heading || 'Онлайн Фотобудка';
    const subtitle = sectionContent?.subheading ||
        'Створіть унікальні фото-спогади прямо зараз! Зробіть серію знімків і отримай готовий макет для друку.';
    const ctaText = sectionContent?.cta_text || 'Спробувати фотобудку';
    const helpText = sectionContent?.metadata?.help_text ||
        ' Як це працює: натисни кнопку → дозволь доступ до камери → посміхнись перед об\'єктивом → отримай готові фото!';

    const features = sectionContent?.metadata?.features || [
        { icon: '', title: 'Просто у браузері', description: 'Без встановлення додатків' },
        { icon: '', title: 'Миттєвий результат', description: 'Готовий макет за секунди' },
        { icon: '', title: 'Професійна якість', description: '300 DPI для друку' },
        { icon: '', title: 'Збережіть або надрукуй', description: 'PNG або JPG формат' }
    ];

    const layouts = sectionContent?.metadata?.layouts || [
        { name: 'Фотострічка 2×6"', description: '3 фото' },
        { name: 'Сітка 4×6"', description: '4 фото' },
        { name: 'Квадрат 4×4"', description: '4 фото' },
        { name: 'Альбомна 6×4"', description: '2 фото' }
    ];

    const handleComplete = (imageDataUrl: string) => {
        // Тут можна додати логіку для збереження фото
    };

    const handleError = (error: { code: string; message: string }) => {
        console.error('Помилка фотобудки:', error);
        alert(error.message);
    };

    if (showPhotobooth) {
        return (
            <div className={styles.fullscreenPhotobooth}>
                <button
                    onClick={() => setShowPhotobooth(false)}
                    className={styles.closeButton}
                    aria-label="Закрити фотобудку"
                >
                    
                </button>
                <PhotoboothEmbed
                    initialConfig={{
                        layout: LAYOUTS.photostrip_2x6,
                        capture: {
                            numberOfPhotos: 3,
                            countdownSeconds: 3,
                            delayBetweenShots: 1000,
                            cameraFacing: 'user',
                            resolution: { width: 1280, height: 720 }
                        } as any,
                        customization: {
                            eventName: 'Touch Memories',
                            textColor: '#FFD700',
                            fontSize: 28,
                        },
                    }}
                    onComplete={handleComplete}
                    onError={handleError}
                    allowConfiguration={false}
                />
            </div>
        );
    }

    return (
        <section className={styles.photoboothSection}>
            <div className={styles.container}>
                <div className={styles.content}>
                    <div className={styles.textContent}>
                        <span className={styles.badge}>{badge}</span>
                        <h2 className={styles.title}>{title}</h2>
                        <p className={styles.subtitle}>{subtitle}</p>

                        <div className={styles.features}>
                            {features.map((feature, index) => (
                                <div key={index} className={styles.feature}>
                                    <div className={styles.featureIcon}>{feature.icon}</div>
                                    <div>
                                        <h3>{feature.title}</h3>
                                        <p>{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowPhotobooth(true)}
                            className={styles.launchButton}
                        >
                            <span className={styles.buttonIcon}></span>
                            {ctaText}
                            <span className={styles.buttonArrow}>→</span>
                        </button>

                        <p className={styles.helpText}>{helpText}</p>
                    </div>

                    <div className={styles.visualContent}>
                        <div className={styles.mockup}>
                            <div className={styles.phone}>
                                <div className={styles.phoneScreen}>
                                    <div className={styles.previewLayout}>
                                        <div className={styles.previewPhoto}></div>
                                        <div className={styles.previewPhoto}></div>
                                        <div className={styles.previewPhoto}></div>
                                    </div>
                                    <div className={styles.previewText}>Готовий макет</div>
                                </div>
                            </div>
                            <div className={styles.floatingElements}>
                                <div className={`${styles.floatingElement} ${styles.float1}`}></div>
                                <div className={`${styles.floatingElement} ${styles.float2}`}></div>
                                <div className={`${styles.floatingElement} ${styles.float3}`}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.layoutOptions}>
                    <h3 className={styles.layoutTitle}>Доступні формати для друку:</h3>
                    <div className={styles.layoutGrid}>
                        {layouts.map((layout, index) => (
                            <div key={index} className={styles.layoutCard}>
                                <div className={styles.layoutPreview}>
                                    {index === 0 && (
                                        <div className={styles.layoutStrip}>
                                            <div className={styles.miniPhoto}></div>
                                            <div className={styles.miniPhoto}></div>
                                            <div className={styles.miniPhoto}></div>
                                        </div>
                                    )}
                                    {index === 1 && (
                                        <div className={styles.layoutGrid2x2}>
                                            <div className={styles.miniPhoto}></div>
                                            <div className={styles.miniPhoto}></div>
                                            <div className={styles.miniPhoto}></div>
                                            <div className={styles.miniPhoto}></div>
                                        </div>
                                    )}
                                    {index === 2 && (
                                        <div className={styles.layoutSquare}>
                                            <div className={styles.miniPhoto}></div>
                                            <div className={styles.miniPhoto}></div>
                                            <div className={styles.miniPhoto}></div>
                                            <div className={styles.miniPhoto}></div>
                                        </div>
                                    )}
                                    {index === 3 && (
                                        <div className={styles.layoutLandscape}>
                                            <div className={styles.miniPhoto}></div>
                                            <div className={styles.miniPhoto}></div>
                                        </div>
                                    )}
                                </div>
                                <div className={styles.layoutName}>{layout.name}</div>
                                <div className={styles.layoutDesc}>{layout.description}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PhotoboothSectionClient;
