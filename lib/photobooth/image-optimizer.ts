// Image optimization utilities for better performance

export class ImageOptimizer {
  /**
   * Compress an image data URL to reduce memory usage
   * @param dataUrl - The original image data URL
   * @param quality - Compression quality (0-1)
   * @param maxWidth - Maximum width for the image
   * @param maxHeight - Maximum height for the image
   * @returns Compressed image data URL
   */
  static async compressImage(
    dataUrl: string,
    quality: number = 0.8,
    maxWidth: number = 1920,
    maxHeight: number = 1080
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Use better image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw the image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to compressed format
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = dataUrl;
    });
  }

  /**
   * Batch compress multiple images
   * @param dataUrls - Array of image data URLs
   * @param quality - Compression quality (0-1)
   * @returns Array of compressed image data URLs
   */
  static async compressBatch(
    dataUrls: string[],
    quality: number = 0.8
  ): Promise<string[]> {
    const promises = dataUrls.map((dataUrl) =>
      this.compressImage(dataUrl, quality)
    );
    return Promise.all(promises);
  }

  /**
   * Get image dimensions
   * @param dataUrl - Image data URL
   * @returns Width and height
   */
  static async getImageDimensions(
    dataUrl: string
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = dataUrl;
    });
  }

  /**
   * Estimate memory usage of a data URL (in MB)
   * @param dataUrl - Image data URL
   * @returns Estimated memory usage in MB
   */
  static estimateMemoryUsage(dataUrl: string): number {
    // Base64 encoded data is roughly 4/3 the size of original
    // Subtract the data URL prefix to get just the base64 data
    const base64Data = dataUrl.split(',')[1] || '';
    const sizeInBytes = (base64Data.length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    return sizeInMB;
  }

  /**
   * Resize canvas to exact dimensions
   * @param sourceCanvas - Source canvas element
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @returns New canvas with resized image
   */
  static resizeCanvas(
    sourceCanvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number
  ): HTMLCanvasElement {
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;

    const ctx = targetCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

    return targetCanvas;
  }
}
