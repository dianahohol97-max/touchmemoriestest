// Canvas-based image generation for print layouts

import { LayoutConfig, CapturedPhoto, CustomizationConfig } from './types';

export class CanvasGenerator {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    // Lazy initialization - will be created when needed
  }

  private ensureCanvas(): void {
    if (!this.canvas && typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      const ctx = this.canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      this.ctx = ctx;
    }
  }

  async generateLayout(
    photos: CapturedPhoto[],
    layout: LayoutConfig,
    customization?: CustomizationConfig
  ): Promise<string> {
    this.ensureCanvas();
    if (!this.canvas || !this.ctx) {
      throw new Error('Canvas not available');
    }

    // Set canvas size
    this.canvas.width = layout.canvasWidth;
    this.canvas.height = layout.canvasHeight;

    // Fill background
    this.ctx.fillStyle = layout.backgroundColor || '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw bleed area guide (optional, for debugging)
    // this.drawBleedGuide(layout);

    // Draw photos into slots
    await this.drawPhotosInSlots(photos, layout);

    // Draw overlay frame if provided
    if (customization?.overlayImage) {
      await this.drawOverlay(customization.overlayImage);
    }

    // Draw text customizations
    if (customization) {
      this.drawCustomText(customization, layout);
    }

    // Draw logo if provided
    if (customization?.logo) {
      await this.drawLogo(customization.logo, layout);
    }

    // Export as high-quality image
    return this.canvas.toDataURL('image/png');
  }

  private async drawPhotosInSlots(photos: CapturedPhoto[], layout: LayoutConfig): Promise<void> {
    const slots = layout.slots.slice(0, photos.length);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const photo = photos[i];

      if (!photo) continue;

      await this.drawPhotoInSlot(photo.dataUrl, slot);
    }
  }

  private async drawPhotoInSlot(
    photoDataUrl: string,
    slot: { x: number; y: number; width: number; height: number; rotation?: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.ctx.save();

        // Apply rotation if specified
        if (slot.rotation) {
          const centerX = slot.x + slot.width / 2;
          const centerY = slot.y + slot.height / 2;
          this.ctx.translate(centerX, centerY);
          this.ctx.rotate((slot.rotation * Math.PI) / 180);
          this.ctx.translate(-centerX, -centerY);
        }

        // Calculate dimensions to fill the slot while maintaining aspect ratio
        const imgAspect = img.width / img.height;
        const slotAspect = slot.width / slot.height;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgAspect > slotAspect) {
          // Image is wider - fit to height and crop width
          drawHeight = slot.height;
          drawWidth = drawHeight * imgAspect;
          offsetX = -(drawWidth - slot.width) / 2;
          offsetY = 0;
        } else {
          // Image is taller - fit to width and crop height
          drawWidth = slot.width;
          drawHeight = drawWidth / imgAspect;
          offsetX = 0;
          offsetY = -(drawHeight - slot.height) / 2;
        }

        // Clip to slot boundaries
        this.ctx.beginPath();
        this.ctx.rect(slot.x, slot.y, slot.width, slot.height);
        this.ctx.clip();

        // Draw image
        this.ctx.drawImage(img, slot.x + offsetX, slot.y + offsetY, drawWidth, drawHeight);

        this.ctx.restore();
        resolve();
      };

      img.onerror = () => reject(new Error('Failed to load photo'));
      img.src = photoDataUrl;
    });
  }

  private async drawOverlay(overlayUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        resolve();
      };

      img.onerror = () => reject(new Error('Failed to load overlay image'));
      img.src = overlayUrl;
    });
  }

  private drawCustomText(customization: CustomizationConfig, layout: LayoutConfig): void {
    const { eventName, eventDate, textColor, fontSize, fontFamily } = customization;

    if (!eventName && !eventDate) return;

    this.ctx.fillStyle = textColor || '#ffffff';
    this.ctx.font = `${fontSize || 24}px ${fontFamily || 'Arial'}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    const centerX = this.canvas.width / 2;
    const topMargin = layout.safeMargin + 10;

    // Add text shadow for better readability
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;

    if (eventName) {
      this.ctx.fillText(eventName, centerX, topMargin);
    }

    if (eventDate) {
      const dateY = eventName ? topMargin + (fontSize || 24) + 10 : topMargin;
      this.ctx.font = `${(fontSize || 24) * 0.8}px ${fontFamily || 'Arial'}`;
      this.ctx.fillText(eventDate, centerX, dateY);
    }

    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
  }

  private async drawLogo(logoUrl: string, layout: LayoutConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const maxLogoWidth = this.canvas.width * 0.2;
        const maxLogoHeight = this.canvas.height * 0.1;

        let logoWidth = img.width;
        let logoHeight = img.height;

        // Scale logo to fit
        const scale = Math.min(maxLogoWidth / logoWidth, maxLogoHeight / logoHeight, 1);
        logoWidth *= scale;
        logoHeight *= scale;

        // Position logo at bottom center
        const x = (this.canvas.width - logoWidth) / 2;
        const y = this.canvas.height - logoHeight - layout.safeMargin - 10;

        this.ctx.drawImage(img, x, y, logoWidth, logoHeight);
        resolve();
      };

      img.onerror = () => {
        console.warn('Failed to load logo, continuing without it');
        resolve();
      };
      img.src = logoUrl;
    });
  }

  private drawBleedGuide(layout: LayoutConfig): void {
    // Draw bleed area (for debugging)
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      layout.bleed,
      layout.bleed,
      this.canvas.width - layout.bleed * 2,
      this.canvas.height - layout.bleed * 2
    );

    // Draw safe area
    this.ctx.strokeStyle = '#00ff00';
    this.ctx.strokeRect(
      layout.safeMargin,
      layout.safeMargin,
      this.canvas.width - layout.safeMargin * 2,
      this.canvas.height - layout.safeMargin * 2
    );
  }

  exportAsDataURL(format: 'png' | 'jpg' = 'png', quality: number = 1.0): string {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    return this.canvas.toDataURL(mimeType, quality);
  }

  async exportAsBlob(format: 'png' | 'jpg' = 'png', quality: number = 1.0): Promise<Blob> {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    return new Promise((resolve, reject) => {
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      this.canvas!.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        mimeType,
        quality
      );
    });
  }

  downloadImage(filename: string, format: 'png' | 'jpg' = 'png', quality: number = 1.0): void {
    if (typeof document === 'undefined') {
      throw new Error('Document not available (SSR)');
    }
    const dataUrl = this.exportAsDataURL(format, quality);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }
}
