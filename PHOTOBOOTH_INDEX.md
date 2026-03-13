# 📸 Online Photobooth - Complete Documentation Index

## Overview

A modular, embeddable web component for taking photos and generating printable layouts. Built with React, TypeScript, Next.js, and HTML Canvas.

**Status:** ✅ Production Ready
**Version:** 1.0
**Created:** March 2026

---

## 📚 Documentation Files

### 1. Quick Start Guide
**File:** [`PHOTOBOOTH_QUICK_START.md`](./PHOTOBOOTH_QUICK_START.md)
**Purpose:** Get up and running in 5 minutes
**Contents:**
- Basic usage examples
- Common configurations
- Layout reference
- Quick troubleshooting

**Start here if you want to:** Use the photobooth immediately

---

### 2. Complete User Guide
**File:** [`PHOTOBOOTH_README.md`](./PHOTOBOOTH_README.md)
**Purpose:** Comprehensive feature documentation
**Contents:**
- All features explained
- Configuration options
- API reference
- Complete examples
- Browser compatibility
- Troubleshooting guide

**Start here if you want to:** Understand all features and capabilities

---

### 3. Integration Guide
**File:** [`PHOTOBOOTH_INTEGRATION.md`](./PHOTOBOOTH_INTEGRATION.md)
**Purpose:** Platform-specific integration instructions
**Contents:**
- Next.js / React integration
- HTML / Static sites
- WordPress integration
- Shopify integration
- Wix integration
- Backend integration (saving photos, email, database)
- Cross-origin communication
- Security considerations

**Start here if you want to:** Embed the photobooth in your platform

---

### 4. Architecture Overview
**File:** [`PHOTOBOOTH_ARCHITECTURE.md`](./PHOTOBOOTH_ARCHITECTURE.md)
**Purpose:** Technical architecture and design
**Contents:**
- System overview diagrams
- Component hierarchy
- Data flow
- State machine
- Module dependencies
- API specifications
- Performance optimizations
- Extension points

**Start here if you want to:** Understand how it works internally or extend functionality

---

### 5. Implementation Summary
**File:** [`PHOTOBOOTH_SUMMARY.md`](./PHOTOBOOTH_SUMMARY.md)
**Purpose:** Project overview and completion summary
**Contents:**
- What was built
- Features list
- File structure
- Use cases
- Technical specifications
- Testing checklist
- Future enhancements

**Start here if you want to:** Overview of the entire project

---

### 6. Integration Example (HTML)
**File:** [`public/photobooth/integration-example.html`](./public/photobooth/integration-example.html)
**Purpose:** Live HTML integration example
**Contents:**
- iframe embedding
- URL parameters
- WordPress/Shopify examples
- postMessage communication

**Start here if you want to:** See a working HTML example

---

## 🗂️ Code Structure

### Components
```
components/photobooth/
├── index.ts                    Main exports
├── PhotoboothEmbed.tsx         Embeddable wrapper
├── PhotoboothCore.tsx          Core component
├── PhotoboothConfig.tsx        Config panel
├── Photobooth.module.css       Main styles
└── PhotoboothConfig.module.css Config styles
```

### Libraries
```
lib/photobooth/
├── index.ts                    Utility exports
├── types.ts                    TypeScript types
├── layouts.ts                  Layout configs
├── defaults.ts                 Default values
├── camera.ts                   Camera manager
└── canvas-generator.ts         Canvas rendering
```

### Demo Pages
```
app/photobooth/
├── page.tsx                    Basic demo
├── layout.tsx                  Page layout
└── demo/
    ├── page.tsx                Interactive demo
    └── demo.module.css         Demo styles
```

---

## 🚀 Quick Access

### Live Demos

1. **Basic Photobooth**
   URL: `/photobooth`
   Simple, ready-to-use implementation

2. **Interactive Demo**
   URL: `/photobooth/demo`
   Explore presets and configurations

### Code Examples

#### Minimal Usage
```tsx
import { PhotoboothEmbed } from '@/components/photobooth';

export default function Page() {
  return <PhotoboothEmbed />;
}
```

#### With Configuration
```tsx
import { PhotoboothEmbed, LAYOUTS } from '@/components/photobooth';

export default function Page() {
  return (
    <PhotoboothEmbed
      initialConfig={{
        layout: LAYOUTS.photostrip_2x6,
        capture: { numberOfPhotos: 4 },
        customization: { eventName: 'My Event' },
      }}
      onComplete={(imageUrl) => console.log('Done!', imageUrl)}
      allowConfiguration={true}
    />
  );
}
```

#### Save to Backend
```tsx
const handleComplete = async (imageDataUrl: string) => {
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();

  const formData = new FormData();
  formData.append('photo', blob, 'photo.png');

  await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
};

<PhotoboothEmbed onComplete={handleComplete} />
```

---

## 📋 Reference Tables

### Available Layouts

| ID | Display Name | Size | Photos | DPI |
|----|-------------|------|--------|-----|
| `photostrip_2x6` | 2×6" Photo Strip | 2×6" | 3 | 300 |
| `print_4x6_grid` | 4×6" Print | 4×6" | 4 | 300 |
| `photostrip_5x15cm` | 5×15cm Photo Strip | 5×15cm | 3 | 300 |
| `print_6x4_landscape` | 6×4" Landscape | 6×4" | 2 | 300 |
| `square_instagram` | Square 4×4" | 4×4" | 4 | 300 |

### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `layout` | `LayoutConfig` | photostrip_2x6 | Print layout |
| `capture.numberOfPhotos` | `number` | 3 | Photos to capture (1-10) |
| `capture.countdownSeconds` | `number` | 3 | Countdown time (1-10) |
| `capture.delayBetweenShots` | `number` | 1000 | Delay in ms |
| `capture.cameraFacing` | `'user' \| 'environment'` | 'user' | Camera selection |
| `capture.resolution` | `{width, height}` | 1920×1080 | Camera resolution |
| `customization.eventName` | `string` | - | Event name text |
| `customization.eventDate` | `string` | - | Event date text |
| `customization.textColor` | `string` | '#ffffff' | Text color |
| `customization.fontSize` | `number` | 24 | Font size |
| `customization.overlayImage` | `string` | - | Overlay PNG URL |
| `customization.logo` | `string` | - | Logo URL |

### Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ 90+ | ✅ 90+ |
| Firefox | ✅ 88+ | ✅ 88+ |
| Safari | ✅ 14+ | ✅ 14.3+ |
| Edge | ✅ 90+ | ✅ 90+ |
| IE11 | ❌ | ❌ |

---

## 🎯 Use Case Guide

### Wedding Photography
- **Best Layout:** `photostrip_2x6`
- **Photos:** 3
- **Customization:** Bride & groom names, wedding date, gold text
- **See:** Quick Start Guide, Wedding example

### Corporate Events
- **Best Layout:** `print_4x6_grid`
- **Photos:** 4
- **Customization:** Company logo, event name, professional colors
- **See:** Integration Guide, Corporate example

### Birthday Parties
- **Best Layout:** `square_instagram`
- **Photos:** 4
- **Customization:** Colorful text, fun overlay
- **See:** Quick Start Guide, Birthday example

### Festivals
- **Best Layout:** `print_6x4_landscape`
- **Photos:** 2
- **Customization:** Festival branding, bold colors
- **See:** Demo page, Festival preset

### E-commerce
- **Best Layout:** Custom (create your own)
- **Integration:** Save photos, attach to orders
- **See:** Integration Guide, Backend Integration

---

## 🔧 Common Tasks

### Task: Add to existing page
1. Import component
2. Add to JSX
3. Configure as needed
**See:** Quick Start Guide → Basic Usage

### Task: Customize appearance
1. Choose layout from LAYOUTS
2. Set customization options
3. Test in demo page
**See:** README → Configuration

### Task: Save photos to server
1. Implement API endpoint
2. Add onComplete handler
3. Upload blob
**See:** Integration Guide → Backend Integration

### Task: Embed in WordPress
1. Create shortcode
2. Add to functions.php
3. Use in posts/pages
**See:** Integration Guide → WordPress

### Task: Create custom layout
1. Use createCustomLayout helper
2. Define canvas size and slots
3. Pass to PhotoboothEmbed
**See:** README → Creating Custom Layouts

### Task: Debug camera issues
1. Check HTTPS
2. Verify permissions
3. Test different cameras
**See:** Quick Start → Common Issues

---

## 📞 Support Resources

### For Users
- Quick Start Guide - Basic usage
- README - All features
- Demo pages - Live examples

### For Developers
- Architecture Guide - Technical details
- Integration Guide - Platform setup
- Type definitions - IntelliSense support

### For Integrators
- Integration Guide - Platform-specific
- HTML Example - iframe method
- Backend Integration - Save photos

---

## ✅ Checklists

### Before Using
- [ ] Review Quick Start Guide
- [ ] Visit demo page (/photobooth/demo)
- [ ] Choose a layout
- [ ] Test on mobile device

### Before Deploying
- [ ] HTTPS enabled
- [ ] Camera permissions tested
- [ ] Print output verified
- [ ] Mobile tested
- [ ] Error handling reviewed

### For Customization
- [ ] Event name/date set
- [ ] Colors chosen
- [ ] Layout selected
- [ ] Logo/overlay prepared (optional)
- [ ] Test print created

### For Integration
- [ ] Platform chosen (React/iframe/etc)
- [ ] Backend endpoint ready (if needed)
- [ ] CORS configured
- [ ] Security reviewed
- [ ] Analytics added (optional)

---

## 🎓 Learning Path

### Beginner
1. Read Quick Start Guide
2. Try basic demo (/photobooth)
3. Copy minimal usage example
4. Test on your page

### Intermediate
1. Read README
2. Explore all layouts
3. Configure capture settings
4. Add customizations
5. Try interactive demo

### Advanced
1. Read Architecture Guide
2. Read Integration Guide
3. Create custom layouts
4. Implement backend integration
5. Add analytics/tracking

---

## 📊 Statistics

- **Total Files:** 13 TypeScript/TSX files
- **Components:** 3 main components
- **Utilities:** 6 utility modules
- **Layouts:** 5 pre-configured
- **Documentation:** 6 comprehensive guides
- **Lines of Code:** ~2,500+
- **Type Safety:** 100% TypeScript

---

## 🎉 Getting Started

**Recommended Path:**

1. **First 5 minutes:**
   → Read Quick Start Guide
   → Visit /photobooth/demo
   → Try a preset

2. **Next 15 minutes:**
   → Read Integration Guide for your platform
   → Copy example code
   → Customize configuration

3. **Within an hour:**
   → Read README for all options
   → Create custom configuration
   → Test on mobile
   → Deploy to production

**You're ready to go!** 🚀

---

## 📝 Quick Links

- [Quick Start](./PHOTOBOOTH_QUICK_START.md) - 5-minute setup
- [User Guide](./PHOTOBOOTH_README.md) - Complete reference
- [Integration](./PHOTOBOOTH_INTEGRATION.md) - Platform guides
- [Architecture](./PHOTOBOOTH_ARCHITECTURE.md) - Technical details
- [Summary](./PHOTOBOOTH_SUMMARY.md) - Project overview
- [HTML Example](./public/photobooth/integration-example.html) - Live example

**Live Demos:**
- Basic: `/photobooth`
- Interactive: `/photobooth/demo`

---

**Questions?** Start with the Quick Start Guide or visit the demo pages!

**Need help?** Check the appropriate documentation file above based on your use case.

**Ready to customize?** The README has all configuration options documented.

**Want to integrate?** The Integration Guide covers all major platforms.

**Built with:** React • TypeScript • Next.js • HTML Canvas • WebRTC
