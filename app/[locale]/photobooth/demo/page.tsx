'use client';

import React, { useState } from 'react';
import { PhotoboothEmbed, LAYOUTS, PhotoboothConfig } from '@/components/photobooth';
import styles from './demo.module.css';

type DemoPreset = 'wedding' | 'corporate' | 'birthday' | 'festival' | 'custom';

export default function PhotoboothDemoPage() {
  const [preset, setPreset] = useState<DemoPreset>('wedding');
  const [showPhotobooth, setShowPhotobooth] = useState(false);

  const presets: Record<DemoPreset, Partial<PhotoboothConfig>> = {
    wedding: {
      layout: LAYOUTS.photostrip_2x6,
      capture: {
        numberOfPhotos: 3,
        countdownSeconds: 3,
        delayBetweenShots: 1000,
        cameraFacing: 'user',
        resolution: { width: 1920, height: 1080 },
      },
      customization: {
        eventName: 'Sarah & John',
        eventDate: 'June 15, 2026',
        textColor: '#FFD700',
        fontSize: 28,
        fontFamily: 'Georgia, serif',
      },
    },
    corporate: {
      layout: LAYOUTS.print_4x6_grid,
      capture: {
        numberOfPhotos: 4,
        countdownSeconds: 2,
        delayBetweenShots: 500,
        cameraFacing: 'user',
        resolution: { width: 1920, height: 1080 },
      },
      customization: {
        eventName: 'Tech Summit 2026',
        eventDate: 'March 12, 2026',
        textColor: '#003366',
        fontSize: 24,
        fontFamily: 'Arial, sans-serif',
      },
    },
    birthday: {
      layout: LAYOUTS.square_instagram,
      capture: {
        numberOfPhotos: 4,
        countdownSeconds: 2,
        delayBetweenShots: 800,
        cameraFacing: 'user',
        resolution: { width: 1920, height: 1080 },
      },
      customization: {
        eventName: 'Happy 30th Birthday!',
        eventDate: 'March 2026',
        textColor: '#FF1493',
        fontSize: 32,
        fontFamily: 'Comic Sans MS, cursive',
      },
    },
    festival: {
      layout: LAYOUTS.print_6x4_landscape,
      capture: {
        numberOfPhotos: 2,
        countdownSeconds: 3,
        delayBetweenShots: 1000,
        cameraFacing: 'user',
        resolution: { width: 1920, height: 1080 },
      },
      customization: {
        eventName: 'Summer Music Festival',
        eventDate: 'July 2026',
        textColor: '#00FF00',
        fontSize: 26,
        fontFamily: 'Impact, sans-serif',
      },
    },
    custom: {
      layout: LAYOUTS.photostrip_5x15cm,
      capture: {
        numberOfPhotos: 3,
        countdownSeconds: 3,
        delayBetweenShots: 1000,
        cameraFacing: 'user',
        resolution: { width: 1920, height: 1080 },
      },
      customization: {
        eventName: 'Custom Event',
        textColor: '#ffffff',
        fontSize: 24,
      },
    },
  };

  const handleComplete = (imageDataUrl: string) => {
    console.log('Photobooth completed!');
    console.log('Image size:', (imageDataUrl.length / 1024 / 1024).toFixed(2), 'MB');
  };

  const handleError = (error: { code: string; message: string }) => {
    console.error('Error:', error);
    alert(`Error: ${error.message}`);
  };

  if (showPhotobooth) {
    return (
      <div className={styles.fullscreen}>
        <button
          onClick={() => setShowPhotobooth(false)}
          className={styles.closeButton}
        >
          ✕ Close Demo
        </button>
        <PhotoboothEmbed
          initialConfig={presets[preset]}
          onComplete={handleComplete}
          onError={handleError}
          allowConfiguration={true}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>📸 Photobooth Demo</h1>
        <p>Choose a preset configuration and launch the photobooth</p>
      </header>

      <div className={styles.presets}>
        <div
          className={`${styles.presetCard} ${preset === 'wedding' ? styles.active : ''}`}
          onClick={() => setPreset('wedding')}
        >
          <div className={styles.icon}>💒</div>
          <h3>Wedding</h3>
          <p>2×6" strip, 3 photos</p>
          <p className={styles.detail}>Elegant serif font with gold text</p>
        </div>

        <div
          className={`${styles.presetCard} ${preset === 'corporate' ? styles.active : ''}`}
          onClick={() => setPreset('corporate')}
        >
          <div className={styles.icon}>💼</div>
          <h3>Corporate</h3>
          <p>4×6" grid, 4 photos</p>
          <p className={styles.detail}>Professional layout for events</p>
        </div>

        <div
          className={`${styles.presetCard} ${preset === 'birthday' ? styles.active : ''}`}
          onClick={() => setPreset('birthday')}
        >
          <div className={styles.icon}>🎂</div>
          <h3>Birthday</h3>
          <p>4×4" square, 4 photos</p>
          <p className={styles.detail}>Fun Instagram-style layout</p>
        </div>

        <div
          className={`${styles.presetCard} ${preset === 'festival' ? styles.active : ''}`}
          onClick={() => setPreset('festival')}
        >
          <div className={styles.icon}>🎪</div>
          <h3>Festival</h3>
          <p>6×4" landscape, 2 photos</p>
          <p className={styles.detail}>Bold design for events</p>
        </div>

        <div
          className={`${styles.presetCard} ${preset === 'custom' ? styles.active : ''}`}
          onClick={() => setPreset('custom')}
        >
          <div className={styles.icon}>⚙️</div>
          <h3>Custom</h3>
          <p>5×15cm strip, 3 photos</p>
          <p className={styles.detail}>Fully customizable</p>
        </div>
      </div>

      <div className={styles.configPreview}>
        <h2>Current Configuration</h2>
        <pre className={styles.code}>
          {JSON.stringify(presets[preset], null, 2)}
        </pre>
      </div>

      <div className={styles.actions}>
        <button onClick={() => setShowPhotobooth(true)} className={styles.launchButton}>
          Launch Photobooth
        </button>
      </div>

      <div className={styles.info}>
        <h3>Features</h3>
        <ul>
          <li>✅ Live camera preview with WebRTC</li>
          <li>✅ Countdown timer with visual feedback</li>
          <li>✅ Multiple photo capture sequence</li>
          <li>✅ High-quality canvas rendering (300 DPI)</li>
          <li>✅ Multiple layout options</li>
          <li>✅ Customizable text and branding</li>
          <li>✅ PNG/JPG export</li>
          <li>✅ Responsive mobile-first design</li>
          <li>✅ Configuration panel for developers</li>
        </ul>
      </div>
    </div>
  );
}
