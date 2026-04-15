'use client';

import React, { useState } from 'react';
import { PhotoboothConfig, LayoutConfig, CaptureConfig, CustomizationConfig } from '@/lib/photobooth/types';
import { getAllLayouts } from '@/lib/photobooth/layouts';
import styles from './PhotoboothConfig.module.css';

interface PhotoboothConfigPanelProps {
  config: PhotoboothConfig;
  onChange: (config: PhotoboothConfig) => void;
  onClose?: () => void;
}

export const PhotoboothConfigPanel: React.FC<PhotoboothConfigPanelProps> = ({
  config,
  onChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'layout' | 'capture' | 'customization'>('layout');
  const layouts = getAllLayouts();

  const updateLayout = (layoutId: string) => {
    const layout = layouts.find((l) => l.id === layoutId);
    if (layout) {
      onChange({ ...config, layout });
    }
  };

  const updateCapture = (updates: Partial<CaptureConfig>) => {
    onChange({
      ...config,
      capture: { ...config.capture, ...updates },
    });
  };

  const updateCustomization = (updates: Partial<CustomizationConfig>) => {
    onChange({
      ...config,
      customization: { ...config.customization, ...updates },
    });
  };

  return (
    <div className={styles.configPanel}>
      <div className={styles.configHeader}>
        <h2>Photobooth Configuration</h2>
        {onClose && (
          <button onClick={onClose} className={styles.closeBtn}>
            
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'layout' ? styles.active : ''}`}
          onClick={() => setActiveTab('layout')}
        >
          Layout
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'capture' ? styles.active : ''}`}
          onClick={() => setActiveTab('capture')}
        >
          Capture
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'customization' ? styles.active : ''}`}
          onClick={() => setActiveTab('customization')}
        >
          Customization
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {/* Layout Tab */}
        {activeTab === 'layout' && (
          <div className={styles.section}>
            <h3>Print Layout</h3>
            <div className={styles.formGroup}>
              <label>Layout Template</label>
              <select
                value={config.layout.id}
                onChange={(e) => updateLayout(e.target.value)}
                className={styles.select}
              >
                {layouts.map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.layoutInfo}>
              <h4>Layout Details</h4>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.label}>Size:</span>
                  <span className={styles.value}>
                    {(config.layout.canvasWidth / 300).toFixed(1)}" × {(config.layout.canvasHeight / 300).toFixed(1)}"
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}>Resolution:</span>
                  <span className={styles.value}>
                    {config.layout.canvasWidth} × {config.layout.canvasHeight}px
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}>Photo Slots:</span>
                  <span className={styles.value}>{config.layout.slots.length}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}>DPI:</span>
                  <span className={styles.value}>{config.layout.dpi || 300}</span>
                </div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Background Color</label>
              <input
                type="color"
                value={config.layout.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    layout: { ...config.layout, backgroundColor: e.target.value },
                  })
                }
                className={styles.colorInput}
              />
            </div>
          </div>
        )}

        {/* Capture Tab */}
        {activeTab === 'capture' && (
          <div className={styles.section}>
            <h3>Capture Settings</h3>

            <div className={styles.formGroup}>
              <label>Number of Photos</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.capture.numberOfPhotos}
                onChange={(e) => updateCapture({ numberOfPhotos: parseInt(e.target.value) })}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Countdown (seconds)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.capture.countdownSeconds}
                onChange={(e) => updateCapture({ countdownSeconds: parseInt(e.target.value) })}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Delay Between Shots (ms)</label>
              <input
                type="number"
                min="0"
                max="5000"
                step="100"
                value={config.capture.delayBetweenShots}
                onChange={(e) => updateCapture({ delayBetweenShots: parseInt(e.target.value) })}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Camera Facing</label>
              <select
                value={config.capture.cameraFacing}
                onChange={(e) => updateCapture({ cameraFacing: e.target.value as 'user' | 'environment' })}
                className={styles.select}
              >
                <option value="user">Front Camera (Selfie)</option>
                <option value="environment">Back Camera</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Resolution</label>
              <select
                value={`${config.capture.resolution.width}x${config.capture.resolution.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  updateCapture({ resolution: { width, height } });
                }}
                className={styles.select}
              >
                <option value="1280x720">HD (1280×720)</option>
                <option value="1920x1080">Full HD (1920×1080)</option>
                <option value="2560x1440">2K (2560×1440)</option>
                <option value="3840x2160">4K (3840×2160)</option>
              </select>
            </div>
          </div>
        )}

        {/* Customization Tab */}
        {activeTab === 'customization' && (
          <div className={styles.section}>
            <h3>Customization</h3>

            <div className={styles.formGroup}>
              <label>Event Name</label>
              <input
                type="text"
                value={config.customization?.eventName || ''}
                onChange={(e) => updateCustomization({ eventName: e.target.value })}
                placeholder="e.g., Wedding 2024"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Event Date</label>
              <input
                type="text"
                value={config.customization?.eventDate || ''}
                onChange={(e) => updateCustomization({ eventDate: e.target.value })}
                placeholder="e.g., March 12, 2026"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Text Color</label>
              <input
                type="color"
                value={config.customization?.textColor || '#ffffff'}
                onChange={(e) => updateCustomization({ textColor: e.target.value })}
                className={styles.colorInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Font Size</label>
              <input
                type="number"
                min="12"
                max="72"
                value={config.customization?.fontSize || 24}
                onChange={(e) => updateCustomization({ fontSize: parseInt(e.target.value) })}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Overlay Image URL</label>
              <input
                type="text"
                value={config.customization?.overlayImage || ''}
                onChange={(e) => updateCustomization({ overlayImage: e.target.value })}
                placeholder="https://example.com/frame.png"
                className={styles.input}
              />
              <small className={styles.helpText}>
                Transparent PNG overlay that will be placed on top of photos
              </small>
            </div>

            <div className={styles.formGroup}>
              <label>Logo URL</label>
              <input
                type="text"
                value={config.customization?.logo || ''}
                onChange={(e) => updateCustomization({ logo: e.target.value })}
                placeholder="https://example.com/logo.png"
                className={styles.input}
              />
              <small className={styles.helpText}>
                Logo will be positioned at the bottom center
              </small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoboothConfigPanel;
