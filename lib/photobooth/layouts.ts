// Pre-defined layout configurations for different print sizes

import { LayoutConfig, PhotoOrientation } from './types';

// Conversion helper: 300 DPI means 1 inch = 300 pixels
const inchToPixels = (inches: number, dpi: number = 300): number => {
  return Math.round(inches * dpi);
};

const mmToPixels = (mm: number, dpi: number = 300): number => {
  return Math.round((mm / 25.4) * dpi);
};

export const LAYOUTS: Record<string, LayoutConfig> = {
  // Classic 2x6 inch photo strip (3 photos)
  photostrip_2x6: {
    id: 'photostrip_2x6',
    name: 'photostrip_2x6',
    displayName: '2x6" Photo Strip (3 photos)',
    canvasWidth: inchToPixels(2),
    canvasHeight: inchToPixels(6),
    bleed: mmToPixels(3),
    safeMargin: mmToPixels(5),
    dpi: 300,
    backgroundColor: '#ffffff',
    slots: [
      {
        x: inchToPixels(0.1),
        y: inchToPixels(0.2),
        width: inchToPixels(1.8),
        height: inchToPixels(1.6),
      },
      {
        x: inchToPixels(0.1),
        y: inchToPixels(2.2),
        width: inchToPixels(1.8),
        height: inchToPixels(1.6),
      },
      {
        x: inchToPixels(0.1),
        y: inchToPixels(4.2),
        width: inchToPixels(1.8),
        height: inchToPixels(1.6),
      },
    ],
  },

  // 4x6 inch print (4 photos in grid)
  print_4x6_grid: {
    id: 'print_4x6_grid',
    name: 'print_4x6_grid',
    displayName: '4x6" Print (4 photos)',
    canvasWidth: inchToPixels(4),
    canvasHeight: inchToPixels(6),
    bleed: mmToPixels(3),
    safeMargin: mmToPixels(5),
    dpi: 300,
    backgroundColor: '#ffffff',
    slots: [
      {
        x: inchToPixels(0.15),
        y: inchToPixels(0.5),
        width: inchToPixels(1.7),
        height: inchToPixels(2.3),
      },
      {
        x: inchToPixels(2.15),
        y: inchToPixels(0.5),
        width: inchToPixels(1.7),
        height: inchToPixels(2.3),
      },
      {
        x: inchToPixels(0.15),
        y: inchToPixels(3.2),
        width: inchToPixels(1.7),
        height: inchToPixels(2.3),
      },
      {
        x: inchToPixels(2.15),
        y: inchToPixels(3.2),
        width: inchToPixels(1.7),
        height: inchToPixels(2.3),
      },
    ],
  },

  // 5x15 cm photo strip (3 photos) - European standard
  photostrip_5x15cm: {
    id: 'photostrip_5x15cm',
    name: 'photostrip_5x15cm',
    displayName: '5x15cm Photo Strip (3 photos)',
    canvasWidth: mmToPixels(50),
    canvasHeight: mmToPixels(150),
    bleed: mmToPixels(3),
    safeMargin: mmToPixels(5),
    dpi: 300,
    backgroundColor: '#ffffff',
    slots: [
      {
        x: mmToPixels(5),
        y: mmToPixels(10),
        width: mmToPixels(40),
        height: mmToPixels(35),
      },
      {
        x: mmToPixels(5),
        y: mmToPixels(57),
        width: mmToPixels(40),
        height: mmToPixels(35),
      },
      {
        x: mmToPixels(5),
        y: mmToPixels(104),
        width: mmToPixels(40),
        height: mmToPixels(35),
      },
    ],
  },

  // 6x4 inch landscape (2 photos)
  print_6x4_landscape: {
    id: 'print_6x4_landscape',
    name: 'print_6x4_landscape',
    displayName: '6x4" Landscape (2 photos)',
    canvasWidth: inchToPixels(6),
    canvasHeight: inchToPixels(4),
    bleed: mmToPixels(3),
    safeMargin: mmToPixels(5),
    dpi: 300,
    backgroundColor: '#ffffff',
    slots: [
      {
        x: inchToPixels(0.2),
        y: inchToPixels(0.5),
        width: inchToPixels(2.6),
        height: inchToPixels(3),
      },
      {
        x: inchToPixels(3.2),
        y: inchToPixels(0.5),
        width: inchToPixels(2.6),
        height: inchToPixels(3),
      },
    ],
  },

  // Square Instagram style (4 photos)
  square_instagram: {
    id: 'square_instagram',
    name: 'square_instagram',
    displayName: 'Square 4x4" (4 photos)',
    canvasWidth: inchToPixels(4),
    canvasHeight: inchToPixels(4),
    bleed: mmToPixels(3),
    safeMargin: mmToPixels(5),
    dpi: 300,
    backgroundColor: '#ffffff',
    slots: [
      {
        x: inchToPixels(0.15),
        y: inchToPixels(0.15),
        width: inchToPixels(1.7),
        height: inchToPixels(1.7),
      },
      {
        x: inchToPixels(2.15),
        y: inchToPixels(0.15),
        width: inchToPixels(1.7),
        height: inchToPixels(1.7),
      },
      {
        x: inchToPixels(0.15),
        y: inchToPixels(2.15),
        width: inchToPixels(1.7),
        height: inchToPixels(1.7),
      },
      {
        x: inchToPixels(2.15),
        y: inchToPixels(2.15),
        width: inchToPixels(1.7),
        height: inchToPixels(1.7),
      },
    ],
  },
};

// Helper to get layout by ID
export const getLayout = (layoutId: string): LayoutConfig | undefined => {
  return LAYOUTS[layoutId];
};

// Helper to get all layouts
export const getAllLayouts = (): LayoutConfig[] => {
  return Object.values(LAYOUTS);
};

// Helper to create custom layout
export const createCustomLayout = (config: Partial<LayoutConfig> & { id: string; name: string }): LayoutConfig => {
  return {
    displayName: config.displayName || config.name,
    canvasWidth: config.canvasWidth || inchToPixels(4),
    canvasHeight: config.canvasHeight || inchToPixels(6),
    bleed: config.bleed || mmToPixels(3),
    safeMargin: config.safeMargin || mmToPixels(5),
    dpi: config.dpi || 300,
    backgroundColor: config.backgroundColor || '#ffffff',
    slots: config.slots || [],
    ...config,
  };
};

// Helper to get layouts by orientation
export const getLayoutsByOrientation = (orientation: PhotoOrientation): LayoutConfig[] => {
  const allLayouts = getAllLayouts();

  return allLayouts.filter(layout => {
    const aspectRatio = layout.canvasWidth / layout.canvasHeight;

    if (orientation === 'square') {
      return Math.abs(aspectRatio - 1) < 0.1; // Close to 1:1
    } else if (orientation === 'landscape') {
      return aspectRatio > 1.1; // Width > Height
    } else {
      return aspectRatio < 0.9; // Height > Width (portrait)
    }
  });
};
