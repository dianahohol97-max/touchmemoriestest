// File upload utilities for photobooth

export class UploadManager {
  private maxFileSizeMB: number;

  constructor(maxFileSizeMB: number = 50) {
    this.maxFileSizeMB = maxFileSizeMB;
  }

  async processUploadedFile(file: File): Promise<string> {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Please upload an image file (JPG, PNG, etc.)');
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > this.maxFileSizeMB) {
      throw new Error(`File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed size of ${this.maxFileSizeMB}MB`);
    }

    // Convert to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  async processMultipleFiles(files: FileList | File[]): Promise<string[]> {
    const fileArray = Array.from(files);
    const promises = fileArray.map(file => this.processUploadedFile(file));
    return Promise.all(promises);
  }

  validateImageDimensions(
    dataUrl: string,
    minWidth: number = 800,
    minHeight: number = 600
  ): Promise<{ width: number; height: number; valid: boolean }> {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        const valid = img.width >= minWidth && img.height >= minHeight;
        resolve({
          width: img.width,
          height: img.height,
          valid,
        });
      };

      img.onerror = () => {
        resolve({
          width: 0,
          height: 0,
          valid: false,
        });
      };

      img.src = dataUrl;
    });
  }

  async compressImage(
    dataUrl: string,
    maxWidth: number = 1920,
    maxHeight: number = 1080,
    quality: number = 0.9
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = dataUrl;
    });
  }
}
