// Main exports for the photobooth module

export { PhotoboothEmbed } from './PhotoboothEmbed';
export { PhotoboothCore } from './PhotoboothCore';
export { PhotoboothConfigPanel } from './PhotoboothConfig';

// Re-export types
export type {
  PhotoboothConfig,
  LayoutConfig,
  CaptureConfig,
  CustomizationConfig,
  PhotoSlot,
  CapturedPhoto,
  PhotoboothState,
  PhotoboothError,
} from '@/lib/photobooth/types';

// Re-export layouts
export { LAYOUTS, getAllLayouts, getLayout, createCustomLayout } from '@/lib/photobooth/layouts';

// Re-export defaults
export { DEFAULT_PHOTOBOOTH_CONFIG, DEFAULT_CAPTURE_CONFIG, DEFAULT_CUSTOMIZATION_CONFIG } from '@/lib/photobooth/defaults';

// Re-export utilities
export { CameraManager } from '@/lib/photobooth/camera';
export { CanvasGenerator } from '@/lib/photobooth/canvas-generator';
