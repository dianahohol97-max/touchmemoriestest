# Online Photobooth Component

A modular, embeddable web component for taking photos and generating printable layouts. Built with React, TypeScript, and HTML Canvas.

## Features

- 📸 **Browser-based camera access** using WebRTC (getUserMedia)
- ⏱️ **Countdown timer** with visual feedback
- 🖼️ **Multiple print layouts** (2x6", 4x6", 5x15cm, etc.)
- 🎨 **Customizable designs** (overlay frames, text, logos)
- 📱 **Responsive design** (mobile-first, works on desktop)
- 💾 **High-quality export** (PNG/JPG at 300 DPI)
- ⚙️ **Configuration panel** for developers
- 🔌 **Easy integration** as embeddable component

## Quick Start

### Installation

The photobooth is already integrated into your Next.js project. To use it in a new page:

```tsx
import { PhotoboothEmbed } from '@/components/photobooth';

export default function MyPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PhotoboothEmbed />
    </div>
  );
}
```

### Basic Usage

```tsx
import { PhotoboothEmbed } from '@/components/photobooth';

function App() {
  const handleComplete = (imageDataUrl: string) => {
    console.log('Photo ready!', imageDataUrl);
    // Save to backend, display, etc.
  };

  return (
    <PhotoboothEmbed
      onComplete={handleComplete}
      allowConfiguration={true}
    />
  );
}
```

## Configuration

### Layout Configuration

The photobooth supports multiple pre-defined layouts:

```tsx
import { PhotoboothEmbed, LAYOUTS } from '@/components/photobooth';

<PhotoboothEmbed
  initialConfig={{
    layout: LAYOUTS.photostrip_2x6, // 2x6" photo strip
  }}
/>
```

**Available Layouts:**

- `photostrip_2x6` - Classic 2×6" photo strip (3 photos)
- `print_4x6_grid` - 4×6" print with 4 photos in grid
- `photostrip_5x15cm` - 5×15cm European standard (3 photos)
- `print_6x4_landscape` - 6×4" landscape (2 photos)
- `square_instagram` - Square 4×4" (4 photos)

### Capture Configuration

```tsx
<PhotoboothEmbed
  initialConfig={{
    capture: {
      numberOfPhotos: 4,        // Number of photos to take
      countdownSeconds: 3,      // Countdown before each photo
      delayBetweenShots: 1000,  // Delay in milliseconds
      cameraFacing: 'user',     // 'user' (front) or 'environment' (back)
      resolution: {
        width: 1920,
        height: 1080,
      },
    },
  }}
/>
```

### Customization Configuration

```tsx
<PhotoboothEmbed
  initialConfig={{
    customization: {
      eventName: 'Wedding 2026',
      eventDate: 'March 12, 2026',
      textColor: '#ffffff',
      fontSize: 24,
      fontFamily: 'Arial, sans-serif',
      overlayImage: '/frames/wedding-frame.png',
      logo: '/logo.png',
    },
  }}
/>
```

## Complete Example

```tsx
'use client';

import { PhotoboothEmbed, LAYOUTS } from '@/components/photobooth';

export default function EventPhotoboothPage() {
  const handleComplete = async (imageDataUrl: string) => {
    // Convert to blob
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();

    // Upload to server
    const formData = new FormData();
    formData.append('photo', blob, 'photobooth.png');

    await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
  };

  const handleError = (error) => {
    console.error('Photobooth error:', error);
    alert(error.message);
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PhotoboothEmbed
        initialConfig={{
          layout: LAYOUTS.photostrip_2x6,
          capture: {
            numberOfPhotos: 3,
            countdownSeconds: 3,
            delayBetweenShots: 1000,
            cameraFacing: 'user',
          },
          customization: {
            eventName: 'Summer Festival 2026',
            eventDate: 'July 20, 2026',
            textColor: '#FFD700',
            logo: '/festival-logo.png',
          },
        }}
        onComplete={handleComplete}
        onError={handleError}
        allowConfiguration={true}
      />
    </div>
  );
}
```

## Creating Custom Layouts

You can create custom layouts programmatically:

```tsx
import { createCustomLayout } from '@/components/photobooth';

const myLayout = createCustomLayout({
  id: 'custom_layout',
  name: 'custom_layout',
  displayName: 'My Custom Layout',
  canvasWidth: 1200,  // pixels at 300 DPI
  canvasHeight: 1800,
  bleed: 9,          // 3mm bleed at 300 DPI
  safeMargin: 15,    // 5mm margin at 300 DPI
  backgroundColor: '#f0f0f0',
  slots: [
    { x: 100, y: 100, width: 1000, height: 700 },
    { x: 100, y: 900, width: 1000, height: 700 },
  ],
});

<PhotoboothEmbed
  initialConfig={{ layout: myLayout }}
/>
```

### Layout Helper Functions

```tsx
import { inchToPixels, mmToPixels } from '@/lib/photobooth/layouts';

// Convert inches to pixels at 300 DPI
const width = inchToPixels(4);  // = 1200 pixels

// Convert millimeters to pixels at 300 DPI
const margin = mmToPixels(5);   // = 59 pixels
```

## Embedding in Different Contexts

### As a Full Page

```tsx
// app/photobooth/page.tsx
export default function PhotoboothPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PhotoboothEmbed />
    </div>
  );
}
```

### As a Modal/Dialog

```tsx
'use client';

import { useState } from 'react';
import { PhotoboothEmbed } from '@/components/photobooth';

export default function Page() {
  const [showPhotobooth, setShowPhotobooth] = useState(false);

  return (
    <>
      <button onClick={() => setShowPhotobooth(true)}>
        Open Photobooth
      </button>

      {showPhotobooth && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'white',
        }}>
          <button
            onClick={() => setShowPhotobooth(false)}
            style={{ position: 'absolute', top: 10, right: 10, zIndex: 10000 }}
          >
            Close
          </button>
          <PhotoboothEmbed />
        </div>
      )}
    </>
  );
}
```

### Embedded in a Section

```tsx
<div className="event-page">
  <header>Event Details</header>

  <section style={{ height: '600px' }}>
    <h2>Take a Photo!</h2>
    <PhotoboothEmbed />
  </section>

  <footer>Thank you!</footer>
</div>
```

## API Reference

### PhotoboothEmbed Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialConfig` | `Partial<PhotoboothConfig>` | Default config | Initial photobooth configuration |
| `showConfig` | `boolean` | `false` | Show configuration panel on mount |
| `onComplete` | `(imageDataUrl: string) => void` | - | Callback when photo session completes |
| `onError` | `(error: PhotoboothError) => void` | - | Callback when error occurs |
| `className` | `string` | `''` | Custom CSS class |
| `allowConfiguration` | `boolean` | `false` | Show configuration button |

### PhotoboothConfig Type

```typescript
interface PhotoboothConfig {
  layout: LayoutConfig;
  capture: CaptureConfig;
  customization?: CustomizationConfig;
}

interface LayoutConfig {
  id: string;
  name: string;
  displayName: string;
  canvasWidth: number;    // pixels
  canvasHeight: number;   // pixels
  bleed: number;          // pixels
  safeMargin: number;     // pixels
  slots: PhotoSlot[];
  backgroundColor?: string;
  dpi?: number;
}

interface PhotoSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;  // degrees
}

interface CaptureConfig {
  numberOfPhotos: number;
  countdownSeconds: number;
  delayBetweenShots: number;  // milliseconds
  cameraFacing: 'user' | 'environment';
  resolution: {
    width: number;
    height: number;
  };
}

interface CustomizationConfig {
  overlayImage?: string;      // URL to overlay PNG
  eventName?: string;
  eventDate?: string;
  logo?: string;              // URL to logo
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
}
```

## User Flow

1. **Start Screen** - User clicks "Start Photobooth"
2. **Camera Permission** - Browser requests camera access
3. **Camera Ready** - Live camera preview appears
4. **Start Session** - User clicks "Start Session"
5. **Countdown** - 3-2-1 countdown before each photo
6. **Capture** - Photo taken with flash effect
7. **Repeat** - Process repeats for configured number of photos
8. **Processing** - Layout generated on canvas
9. **Preview** - Final result displayed
10. **Download** - User downloads PNG or JPG

## Browser Compatibility

- ✅ Chrome (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari (iOS 14.3+)
- ✅ Edge (Chromium-based)
- ❌ IE11 (not supported)

**Required Browser Features:**
- `navigator.mediaDevices.getUserMedia`
- HTML Canvas API
- ES6+ JavaScript

## Performance Optimization

The photobooth is optimized for mobile devices:

- Camera stream runs at requested resolution (default 1920×1080)
- Photos captured at full camera resolution
- Canvas rendering at 300 DPI for print quality
- Minimal re-renders using React hooks
- Lazy loading of images

## Print Quality

All layouts are configured at **300 DPI**, which is standard for professional printing:

- 2×6" = 600×1800 pixels
- 4×6" = 1200×1800 pixels
- Exported as PNG (lossless) or JPG (customizable quality)

## Customization Examples

### Wedding Theme

```tsx
<PhotoboothEmbed
  initialConfig={{
    layout: LAYOUTS.photostrip_2x6,
    customization: {
      eventName: 'Sarah & John',
      eventDate: 'June 15, 2026',
      textColor: '#FFD700',
      overlayImage: '/frames/wedding-frame.png',
      logo: '/wedding-logo.png',
    },
  }}
/>
```

### Corporate Event

```tsx
<PhotoboothEmbed
  initialConfig={{
    layout: LAYOUTS.print_4x6_grid,
    capture: {
      numberOfPhotos: 4,
      cameraFacing: 'environment',  // Back camera
    },
    customization: {
      eventName: 'Company Summit 2026',
      logo: '/company-logo.png',
      textColor: '#003366',
    },
  }}
/>
```

### Birthday Party

```tsx
<PhotoboothEmbed
  initialConfig={{
    layout: LAYOUTS.square_instagram,
    capture: {
      numberOfPhotos: 4,
      countdownSeconds: 2,
    },
    customization: {
      eventName: 'Happy 30th Birthday!',
      textColor: '#FF1493',
      overlayImage: '/frames/birthday-frame.png',
    },
  }}
/>
```

## Troubleshooting

### Camera not working

1. Check browser permissions
2. Ensure HTTPS (required for camera access)
3. Try different camera facing mode
4. Check browser console for errors

### Photos appear dark/washed out

1. Check lighting conditions
2. Adjust camera resolution
3. Test with different camera (front vs back)

### Layout not printing correctly

1. Verify DPI is set to 300
2. Check printer settings (actual size, no scaling)
3. Use PNG for best quality
4. Ensure bleed and margins are configured

## File Structure

```
components/photobooth/
├── index.ts                    # Main exports
├── PhotoboothCore.tsx          # Core photobooth logic
├── PhotoboothEmbed.tsx         # Embeddable wrapper component
├── PhotoboothConfig.tsx        # Configuration panel
├── Photobooth.module.css       # Main styles
└── PhotoboothConfig.module.css # Config panel styles

lib/photobooth/
├── types.ts                    # TypeScript definitions
├── layouts.ts                  # Layout configurations
├── defaults.ts                 # Default configurations
├── camera.ts                   # Camera manager
└── canvas-generator.ts         # Canvas image generation

app/photobooth/
├── page.tsx                    # Demo page
└── layout.tsx                  # Page layout
```

## License

This photobooth component is part of your Touch Memories project.

## Support

For issues or questions, refer to the main project documentation.

---

**Built with:** React, TypeScript, Next.js, HTML Canvas, WebRTC
