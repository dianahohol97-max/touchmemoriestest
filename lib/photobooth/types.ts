// Type definitions for the photobooth system

export interface PhotoSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface LayoutConfig {
  id: string;
  name: string;
  displayName: string;
  canvasWidth: number;
  canvasHeight: number;
  bleed: number; // in pixels
  safeMargin: number; // in pixels
  slots: PhotoSlot[];
  backgroundColor?: string;
  dpi?: number;
}

export type PhotoOrientation = 'landscape' | 'portrait' | 'square';

export type PhotoSource = 'camera' | 'upload';

export interface CaptureConfig {
  numberOfPhotos: number;
  countdownSeconds: number;
  delayBetweenShots: number; // in milliseconds
  cameraFacing: 'user' | 'environment';
  resolution: {
    width: number;
    height: number;
  };
  maxFileSizeMB?: number; // Maximum file size in MB for uploads
}

export interface CustomizationConfig {
  overlayImage?: string; // URL to overlay frame
  eventName?: string;
  eventDate?: string;
  logo?: string; // URL to logo
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface PhotoboothConfig {
  layout: LayoutConfig;
  capture: CaptureConfig;
  customization?: CustomizationConfig;
}

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  timestamp: number;
}

export type PhotoboothState =
  | 'idle'
  | 'format-selection'
  | 'source-selection'
  | 'camera-setup'
  | 'camera-ready'
  | 'upload-ready'
  | 'countdown'
  | 'capturing'
  | 'photo-review'
  | 'processing'
  | 'preview'
  | 'error';

export interface PhotoboothError {
  code: string;
  message: string;
}
