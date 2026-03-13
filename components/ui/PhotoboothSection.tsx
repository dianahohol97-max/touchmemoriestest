'use client';

import React, { useState } from 'react';
import { PhotoboothEmbed, LAYOUTS } from '@/components/photobooth';
import styles from './PhotoboothSection.module.css';

export const PhotoboothSection: React.FC = () => {
  const [showPhotobooth, setShowPhotobooth] = useState(false);

  const handleComplete = (imageDataUrl: string) => {
    console.log('Фото готове!');
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
          ✕
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
            <span className={styles.badge}>📸 Новинка</span>
            <h2 className={styles.title}>Онлайн Фотобудка</h2>
            <p className={styles.subtitle}>
              Створи унікальні фото-спогади прямо зараз! Зроби серію знімків і отримай готовий макет для друку.
            </p>

            <div className={styles.features}>
              <div className={styles.feature}>
                <div className={styles.featureIcon}>📱</div>
                <div>
                  <h3>Просто у браузері</h3>
                  <p>Без встановлення додатків</p>
                </div>
              </div>

              <div className={styles.feature}>
                <div className={styles.featureIcon}>⚡</div>
                <div>
                  <h3>Миттєвий результат</h3>
                  <p>Готовий макет за секунди</p>
                </div>
              </div>

              <div className={styles.feature}>
                <div className={styles.featureIcon}>🎨</div>
                <div>
                  <h3>Професійна якість</h3>
                  <p>300 DPI для друку</p>
                </div>
              </div>

              <div className={styles.feature}>
                <div className={styles.featureIcon}>💾</div>
                <div>
                  <h3>Збережи або надрукуй</h3>
                  <p>PNG або JPG формат</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPhotobooth(true)}
              className={styles.launchButton}
            >
              <span className={styles.buttonIcon}>📸</span>
              Спробувати фотобудку
              <span className={styles.buttonArrow}>→</span>
            </button>

            <p className={styles.helpText}>
              💡 Як це працює: натисни кнопку → дозволь доступ до камери → посміхнись перед об'єктивом → отримай готові фото!
            </p>
          </div>

          <div className={styles.visualContent}>
            <div className={styles.mockup}>
              <div className={styles.phone}>
                <div className={styles.phoneScreen}>
                  <div className={styles.previewLayout}>
                    <div className={styles.previewPhoto}>📷</div>
                    <div className={styles.previewPhoto}>📷</div>
                    <div className={styles.previewPhoto}>📷</div>
                  </div>
                  <div className={styles.previewText}>Готовий макет</div>
                </div>
              </div>
              <div className={styles.floatingElements}>
                <div className={`${styles.floatingElement} ${styles.float1}`}>✨</div>
                <div className={`${styles.floatingElement} ${styles.float2}`}>🎉</div>
                <div className={`${styles.floatingElement} ${styles.float3}`}>💫</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.layoutOptions}>
          <h3 className={styles.layoutTitle}>Доступні формати для друку:</h3>
          <div className={styles.layoutGrid}>
            <div className={styles.layoutCard}>
              <div className={styles.layoutPreview}>
                <div className={styles.layoutStrip}>
                  <div className={styles.miniPhoto}></div>
                  <div className={styles.miniPhoto}></div>
                  <div className={styles.miniPhoto}></div>
                </div>
              </div>
              <div className={styles.layoutName}>Фотострічка 2×6"</div>
              <div className={styles.layoutDesc}>3 фото</div>
            </div>

            <div className={styles.layoutCard}>
              <div className={styles.layoutPreview}>
                <div className={styles.layoutGrid2x2}>
                  <div className={styles.miniPhoto}></div>
                  <div className={styles.miniPhoto}></div>
                  <div className={styles.miniPhoto}></div>
                  <div className={styles.miniPhoto}></div>
                </div>
              </div>
              <div className={styles.layoutName}>Сітка 4×6"</div>
              <div className={styles.layoutDesc}>4 фото</div>
            </div>

            <div className={styles.layoutCard}>
              <div className={styles.layoutPreview}>
                <div className={styles.layoutSquare}>
                  <div className={styles.miniPhoto}></div>
                  <div className={styles.miniPhoto}></div>
                  <div className={styles.miniPhoto}></div>
                  <div className={styles.miniPhoto}></div>
                </div>
              </div>
              <div className={styles.layoutName}>Квадрат 4×4"</div>
              <div className={styles.layoutDesc}>4 фото</div>
            </div>

            <div className={styles.layoutCard}>
              <div className={styles.layoutPreview}>
                <div className={styles.layoutLandscape}>
                  <div className={styles.miniPhoto}></div>
                  <div className={styles.miniPhoto}></div>
                </div>
              </div>
              <div className={styles.layoutName}>Альбомна 6×4"</div>
              <div className={styles.layoutDesc}>2 фото</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PhotoboothSection;
