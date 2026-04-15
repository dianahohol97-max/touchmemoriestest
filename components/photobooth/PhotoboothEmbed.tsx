'use client';

import React, { useState } from 'react';
import { PhotoboothCore } from './PhotoboothCore';
import { PhotoboothConfigPanel } from './PhotoboothConfig';
import { PhotoboothConfig } from '@/lib/photobooth/types';
import { DEFAULT_PHOTOBOOTH_CONFIG } from '@/lib/photobooth/defaults';
import styles from './Photobooth.module.css';

interface PhotoboothEmbedProps {
  /**
   * Initial configuration for the photobooth
   */
  initialConfig?: Partial<PhotoboothConfig>;

  /**
   * Whether to show the configuration panel
   */
  showConfig?: boolean;

  /**
   * Callback when a photobooth session is completed
   */
  onComplete?: (imageDataUrl: string) => void;

  /**
   * Callback when an error occurs
   */
  onError?: (error: { code: string; message: string }) => void;

  /**
   * Custom CSS class name
   */
  className?: string;

  /**
   * Whether to allow configuration changes
   */
  allowConfiguration?: boolean;
}

/**
 * PhotoboothEmbed - Main embeddable photobooth component
 *
 * This component can be embedded in any page to provide photobooth functionality.
 *
 * @example
 * ```tsx
 * <PhotoboothEmbed
 *   initialConfig={{
 *     layout: LAYOUTS.photostrip_2x6,
 *     capture: { numberOfPhotos: 4 },
 *     customization: { eventName: "My Event" }
 *   }}
 *   onComplete={(imageUrl) => console.log('Photo ready!', imageUrl)}
 *   allowConfiguration={true}
 * />
 * ```
 */
export const PhotoboothEmbed: React.FC<PhotoboothEmbedProps> = ({
  initialConfig = {} as Partial<PhotoboothConfig>,
  showConfig: initialShowConfig = false,
  onComplete,
  onError,
  className = '',
  allowConfiguration = false,
}) => {
  const [config, setConfig] = useState<PhotoboothConfig>({
    ...DEFAULT_PHOTOBOOTH_CONFIG,
    ...initialConfig,
    layout: initialConfig.layout || DEFAULT_PHOTOBOOTH_CONFIG.layout,
    capture: {
      ...DEFAULT_PHOTOBOOTH_CONFIG.capture,
      ...initialConfig.capture,
    },
    customization: {
      ...DEFAULT_PHOTOBOOTH_CONFIG.customization,
      ...initialConfig.customization,
    },
  });

  const [showConfig, setShowConfig] = useState(initialShowConfig);

  return (
    <div className={`photobooth-embed ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Configuration Toggle Button */}
      {allowConfiguration && !showConfig && (
        <button
          onClick={() => setShowConfig(true)}
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            zIndex: 100,
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: "3px",
            width: '48px',
            height: '48px',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
            fontSize: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Configuration"
        >
          
        </button>
      )}

      {/* Configuration Panel */}
      {showConfig && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <PhotoboothConfigPanel
            config={config}
            onChange={setConfig}
            onClose={() => setShowConfig(false)}
          />
        </div>
      )}

      {/* Photobooth Core */}
      <PhotoboothCore
        config={config}
        onComplete={onComplete}
        onError={onError}
        className={styles['photobooth-core']}
      />
    </div>
  );
};

export default PhotoboothEmbed;
