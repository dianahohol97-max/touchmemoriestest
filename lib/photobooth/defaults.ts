// Default configurations for the photobooth

import { CaptureConfig, CustomizationConfig, PhotoboothConfig } from './types';
import { LAYOUTS } from './layouts';

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  numberOfPhotos: 3,
  countdownSeconds: 3,
  delayBetweenShots: 1000,
  cameraFacing: 'user',
  resolution: {
    width: 1920,
    height: 1080,
  },
  maxFileSizeMB: 50, // Increased to 50MB to support high-quality photos
};

export const DEFAULT_CUSTOMIZATION_CONFIG: CustomizationConfig = {
  textColor: '#ffffff',
  fontSize: 24,
  fontFamily: 'Arial, sans-serif',
};

export const DEFAULT_PHOTOBOOTH_CONFIG: PhotoboothConfig = {
  layout: LAYOUTS.photostrip_2x6,
  capture: DEFAULT_CAPTURE_CONFIG,
  customization: DEFAULT_CUSTOMIZATION_CONFIG,
};
