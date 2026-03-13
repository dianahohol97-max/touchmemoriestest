# Photobooth Component

A modular, embeddable online photobooth for taking photos and creating printable layouts.

## Quick Usage

```tsx
import { PhotoboothEmbed } from '@/components/photobooth';

export default function MyPage() {
  return <PhotoboothEmbed />;
}
```

## Documentation

📚 **Complete documentation is located in the project root:**

- **[Quick Start Guide](../../PHOTOBOOTH_QUICK_START.md)** - Get started in 5 minutes
- **[User Guide](../../PHOTOBOOTH_README.md)** - Complete feature reference
- **[Integration Guide](../../PHOTOBOOTH_INTEGRATION.md)** - Platform-specific guides
- **[Architecture](../../PHOTOBOOTH_ARCHITECTURE.md)** - Technical details
- **[Documentation Index](../../PHOTOBOOTH_INDEX.md)** - All docs overview

## Live Demos

- Basic: `/photobooth`
- Interactive: `/photobooth/demo`

## Quick Examples

### Wedding Photobooth
```tsx
import { PhotoboothEmbed, LAYOUTS } from '@/components/photobooth';

<PhotoboothEmbed
  initialConfig={{
    layout: LAYOUTS.photostrip_2x6,
    customization: {
      eventName: 'Sarah & John',
      eventDate: 'June 2026',
      textColor: '#FFD700',
    },
  }}
/>
```

### Corporate Event
```tsx
<PhotoboothEmbed
  initialConfig={{
    layout: LAYOUTS.print_4x6_grid,
    capture: { numberOfPhotos: 4 },
    customization: {
      eventName: 'Company Summit',
      logo: '/logo.png',
    },
  }}
/>
```

## Available Exports

### Components
- `PhotoboothEmbed` - Main embeddable component
- `PhotoboothCore` - Core component (for advanced use)
- `PhotoboothConfigPanel` - Configuration panel

### Layouts
- `LAYOUTS` - Pre-configured layouts
- `getAllLayouts()` - Get all layouts
- `getLayout(id)` - Get specific layout
- `createCustomLayout()` - Create custom layout

### Types
- `PhotoboothConfig` - Main config type
- `LayoutConfig` - Layout configuration
- `CaptureConfig` - Capture settings
- `CustomizationConfig` - Customization options

### Utilities
- `CameraManager` - Camera access utility
- `CanvasGenerator` - Canvas rendering utility

## Features

✅ Live camera preview (WebRTC)
✅ Countdown timer
✅ Multiple photo capture
✅ 300 DPI print-quality output
✅ 5 pre-configured layouts
✅ Fully customizable
✅ Mobile responsive
✅ PNG/JPG export

## Browser Requirements

- Modern browser (Chrome, Firefox, Safari, Edge)
- Camera support
- HTTPS connection
- JavaScript enabled

## File Structure

```
components/photobooth/
├── README.md (this file)
├── index.ts                    # Exports
├── PhotoboothEmbed.tsx         # Main component
├── PhotoboothCore.tsx          # Core logic
├── PhotoboothConfig.tsx        # Config panel
├── Photobooth.module.css       # Styles
└── PhotoboothConfig.module.css # Config styles
```

## Support Libraries

```
lib/photobooth/
├── types.ts                    # TypeScript types
├── layouts.ts                  # Layout configs
├── defaults.ts                 # Defaults
├── camera.ts                   # Camera manager
└── canvas-generator.ts         # Canvas rendering
```

## Need Help?

Start with the [Documentation Index](../../PHOTOBOOTH_INDEX.md) to find the right guide for your needs.

---

**Built with:** React • TypeScript • Next.js • HTML Canvas • WebRTC
