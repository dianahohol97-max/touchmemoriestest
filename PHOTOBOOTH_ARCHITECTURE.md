# Photobooth Component Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PhotoboothEmbed                          │
│  (Main embeddable component with config management)        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          PhotoboothCore                             │    │
│  │  (Core logic, state management, UI flow)           │    │
│  │                                                      │    │
│  │  ┌──────────────┐    ┌──────────────────────┐      │    │
│  │  │  Camera      │    │  Canvas              │      │    │
│  │  │  Manager     │───▶│  Generator           │      │    │
│  │  │              │    │                      │      │    │
│  │  │  - WebRTC    │    │  - Layout rendering  │      │    │
│  │  │  - Capture   │    │  - 300 DPI export    │      │    │
│  │  │  - Stream    │    │  - Overlays          │      │    │
│  │  └──────────────┘    └──────────────────────┘      │    │
│  │                                                      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │       PhotoboothConfigPanel                        │    │
│  │  (Admin configuration interface)                   │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
PhotoboothEmbed (Wrapper)
│
├── PhotoboothCore (Main component)
│   ├── Camera View
│   │   ├── Video Element (live preview)
│   │   ├── Countdown Overlay
│   │   ├── Capture Flash
│   │   ├── Photo Counter
│   │   └── Thumbnail Strip
│   │
│   ├── Preview View
│   │   ├── Generated Image
│   │   └── Download Controls
│   │
│   └── Error/Loading Views
│
└── PhotoboothConfigPanel (Optional)
    ├── Layout Tab
    ├── Capture Tab
    └── Customization Tab
```

## Data Flow

```
User Action Flow:
┌─────────────┐
│ User clicks │
│   "Start"   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Request Camera  │
│ Access (WebRTC) │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Live Preview   │
│   (mirrored)    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Start Capture   │
│   Sequence      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   Countdown     │
│    3...2...1    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Capture Photo   │
│ (Canvas draw)   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Repeat for N    │
│     photos      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   Generate      │
│   Layout        │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Show Preview   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│    Download     │
│   PNG / JPG     │
└─────────────────┘
```

## State Machine

```
States:
┌──────┐
│ idle │──┐
└──────┘  │
          │ initializeCamera()
          ▼
┌────────────────┐
│ camera-setup   │
└────────┬───────┘
         │
         │ success
         ▼
┌────────────────┐
│ camera-ready   │
└────────┬───────┘
         │
         │ startCapture()
         ▼
┌────────────────┐
│   countdown    │──┐
└────────┬───────┘  │
         │          │ repeat
         │          │ for each
         │          │ photo
         ▼          │
┌────────────────┐  │
│   capturing    │──┘
└────────┬───────┘
         │
         │ all photos done
         ▼
┌────────────────┐
│   processing   │
└────────┬───────┘
         │
         │ layout complete
         ▼
┌────────────────┐
│    preview     │
└────────┬───────┘
         │
         │ reset()
         ▼
     (back to
   camera-ready)
```

## Module Dependencies

```
PhotoboothEmbed
│
├─► PhotoboothCore
│   │
│   ├─► CameraManager (lib/photobooth/camera.ts)
│   │   └─► Browser WebRTC API
│   │
│   ├─► CanvasGenerator (lib/photobooth/canvas-generator.ts)
│   │   └─► HTML Canvas API
│   │
│   ├─► LayoutConfig (lib/photobooth/layouts.ts)
│   │
│   └─► Types (lib/photobooth/types.ts)
│
└─► PhotoboothConfigPanel
    └─► Same types/configs
```

## File Organization

```
/components/photobooth/
├── index.ts ────────────► Public API exports
├── PhotoboothEmbed.tsx ─► Main embeddable wrapper
├── PhotoboothCore.tsx ──► Core logic & UI
├── PhotoboothConfig.tsx ► Admin config panel
└── *.module.css ────────► Component styles

/lib/photobooth/
├── index.ts ────────────► Utility exports
├── types.ts ────────────► TypeScript definitions
├── layouts.ts ──────────► Layout configurations
├── defaults.ts ─────────► Default configs
├── camera.ts ───────────► Camera access utility
└── canvas-generator.ts ─► Canvas rendering utility

/app/photobooth/
├── page.tsx ────────────► Main demo page
├── layout.tsx ──────────► Page metadata
└── demo/
    ├── page.tsx ────────► Interactive demo
    └── demo.module.css ─► Demo styles
```

## Canvas Generation Pipeline

```
Input: Array<CapturedPhoto>
  │
  ├─► 1. Create canvas at layout dimensions
  │      (e.g., 600×1800px for 2×6" at 300 DPI)
  │
  ├─► 2. Fill background color
  │
  ├─► 3. For each photo:
  │      ├─► Load image
  │      ├─► Calculate aspect ratio
  │      ├─► Crop to fill slot
  │      └─► Draw to canvas at slot position
  │
  ├─► 4. Draw overlay frame (if provided)
  │
  ├─► 5. Render text (event name, date)
  │      └─► With shadow for readability
  │
  ├─► 6. Draw logo (if provided)
  │      └─► Positioned at bottom center
  │
  └─► 7. Export as data URL
         ├─► PNG (lossless)
         └─► JPG (with quality setting)
```

## Layout Configuration Structure

```typescript
Layout {
  id: string               // Unique identifier
  name: string            // Internal name
  displayName: string     // User-friendly name
  canvasWidth: number     // Total width in pixels
  canvasHeight: number    // Total height in pixels
  bleed: number           // Bleed area in pixels
  safeMargin: number      // Safe margin in pixels
  dpi: number             // Resolution (default 300)
  backgroundColor: string // Hex color
  slots: [                // Photo positions
    {
      x: number,          // X position
      y: number,          // Y position
      width: number,      // Slot width
      height: number,     // Slot height
      rotation?: number   // Optional rotation
    }
  ]
}
```

## Camera Manager API

```typescript
class CameraManager {
  // Request camera access
  requestCameraAccess(
    facing: 'user' | 'environment',
    resolution: { width, height }
  ): Promise<MediaStream>

  // Attach stream to video element
  attachToVideo(
    videoElement: HTMLVideoElement,
    stream: MediaStream
  ): void

  // Capture current frame
  capturePhoto(
    videoElement: HTMLVideoElement
  ): Promise<string>  // Returns data URL

  // Stop camera and cleanup
  stopCamera(): void

  // Switch between cameras
  switchCamera(
    facing: 'user' | 'environment'
  ): Promise<MediaStream>

  // Check browser support
  isSupported(): boolean

  // Get available cameras
  getAvailableCameras(): Promise<MediaDeviceInfo[]>
}
```

## Canvas Generator API

```typescript
class CanvasGenerator {
  // Generate final layout
  generateLayout(
    photos: CapturedPhoto[],
    layout: LayoutConfig,
    customization?: CustomizationConfig
  ): Promise<string>  // Returns data URL

  // Export in different formats
  exportAsDataURL(
    format: 'png' | 'jpg',
    quality: number
  ): string

  exportAsBlob(
    format: 'png' | 'jpg',
    quality: number
  ): Promise<Blob>

  // Download to user's device
  downloadImage(
    filename: string,
    format: 'png' | 'jpg',
    quality: number
  ): void
}
```

## Configuration System

```
User Config (Partial)
        │
        ▼
   Merge with
 DEFAULT_CONFIG
        │
        ▼
  Full Config
        │
        ├─► Layout Config
        │   └─► Determines canvas size,
        │       photo positions, DPI
        │
        ├─► Capture Config
        │   └─► Controls photo sequence,
        │       countdown, camera settings
        │
        └─► Customization Config
            └─► Text, colors, overlays,
                logos, fonts
```

## Event System

```typescript
// Events emitted by PhotoboothEmbed

onComplete?: (imageDataUrl: string) => void
  // Fired when photobooth session completes
  // Receives high-res image as data URL

onError?: (error: PhotoboothError) => void
  // Fired when any error occurs
  // Receives error with code and message

// Internal state changes (not exposed)
- Camera initialized
- Countdown started
- Photo captured
- Layout generated
```

## Responsive Design Strategy

```
Mobile First Approach:

Base styles (< 768px):
  ├─► Full viewport dimensions
  ├─► Larger touch targets
  ├─► Simplified UI
  └─► Vertical layout

Tablet (768px - 1024px):
  ├─► Optimized camera preview
  └─► Enhanced controls

Desktop (> 1024px):
  ├─► Centered layout
  ├─► Max width constraints
  └─► Enhanced preview
```

## Performance Optimizations

```
1. Camera Stream
   └─► Single instance shared
       └─► Cleanup on unmount

2. Canvas Rendering
   └─► Single canvas reused
       └─► High-quality mode for export only

3. Image Loading
   └─► Promise-based async loading
       └─► Parallel slot rendering

4. State Management
   └─► React hooks (useState, useRef)
       └─► Minimal re-renders

5. CSS
   └─► CSS Modules (scoped styles)
       └─► Hardware-accelerated animations
```

## Security Considerations

```
1. Camera Access
   └─► User permission required
       └─► HTTPS only

2. Data Handling
   └─► All processing client-side
       └─► No automatic server upload

3. Cross-Origin
   └─► Verify origin in postMessage
       └─► CORS headers configured

4. File Validation
   └─► Type checking on overlay/logo URLs
       └─► Error handling for failed loads
```

## Testing Strategy

```
Unit Tests:
  ├─► Layout calculations
  ├─► Camera manager methods
  └─► Canvas generation logic

Integration Tests:
  ├─► Complete photo flow
  ├─► Config changes
  └─► Error scenarios

E2E Tests:
  ├─► User interactions
  ├─► Camera permissions
  └─► Photo download
```

## Deployment Checklist

```
Prerequisites:
  ✓ Next.js app running
  ✓ HTTPS enabled
  ✓ Modern browser

Build:
  ✓ TypeScript compilation
  ✓ CSS modules bundled
  ✓ Assets optimized

Production:
  ✓ CORS configured
  ✓ CSP headers set
  ✓ Rate limiting enabled
  ✓ Analytics added
  ✓ Error tracking enabled
```

## Extension Points

```
Easy to Extend:

1. New Layouts
   └─► Add to layouts.ts with configuration

2. New Customizations
   └─► Extend CustomizationConfig type
       └─► Update canvas-generator.ts

3. Effects/Filters
   └─► Add to canvas drawing pipeline
       └─► Apply before final export

4. Backend Integration
   └─► Use onComplete callback
       └─► Upload to your API

5. Social Sharing
   └─► Convert data URL to blob
       └─► Use Web Share API
```

---

This architecture provides:
- ✅ Clean separation of concerns
- ✅ Modular, reusable components
- ✅ Type-safe configuration
- ✅ Easy customization
- ✅ Performance optimized
- ✅ Production ready
