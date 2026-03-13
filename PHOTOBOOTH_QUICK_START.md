# Photobooth Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: View the Demo
Visit: `http://localhost:3000/photobooth`

### Step 2: Basic Usage

```tsx
import { PhotoboothEmbed } from '@/components/photobooth';

export default function MyPage() {
  return <PhotoboothEmbed />;
}
```

### Step 3: Customize

```tsx
import { PhotoboothEmbed, LAYOUTS } from '@/components/photobooth';

export default function EventPage() {
  return (
    <PhotoboothEmbed
      initialConfig={{
        layout: LAYOUTS.photostrip_2x6,
        capture: { numberOfPhotos: 4 },
        customization: { eventName: 'My Event' },
      }}
      allowConfiguration={true}
    />
  );
}
```

---

## 📋 Common Configurations

### Wedding Photobooth
```tsx
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

### Birthday Party
```tsx
<PhotoboothEmbed
  initialConfig={{
    layout: LAYOUTS.square_instagram,
    capture: { numberOfPhotos: 4 },
    customization: {
      eventName: 'Happy Birthday!',
      textColor: '#FF1493',
    },
  }}
/>
```

---

## 🎨 Available Layouts

| ID | Name | Size | Photos |
|----|------|------|--------|
| `photostrip_2x6` | Photo Strip | 2×6" | 3 |
| `print_4x6_grid` | Grid Print | 4×6" | 4 |
| `photostrip_5x15cm` | Euro Strip | 5×15cm | 3 |
| `print_6x4_landscape` | Landscape | 6×4" | 2 |
| `square_instagram` | Square | 4×4" | 4 |

---

## ⚙️ Configuration Options

### Capture Settings
```tsx
capture: {
  numberOfPhotos: 3,        // 1-10
  countdownSeconds: 3,      // 1-10
  delayBetweenShots: 1000,  // milliseconds
  cameraFacing: 'user',     // 'user' or 'environment'
  resolution: {
    width: 1920,
    height: 1080,
  },
}
```

### Customization
```tsx
customization: {
  eventName: 'My Event',
  eventDate: 'March 2026',
  textColor: '#ffffff',
  fontSize: 24,
  fontFamily: 'Arial',
  overlayImage: '/frame.png',  // Optional
  logo: '/logo.png',           // Optional
}
```

---

## 🔌 Integration Methods

### 1. React Component
```tsx
import { PhotoboothEmbed } from '@/components/photobooth';
<PhotoboothEmbed />
```

### 2. iframe (Any Website)
```html
<iframe
  src="https://yourdomain.com/photobooth"
  width="100%"
  height="600px"
  allow="camera"
></iframe>
```

### 3. WordPress Shortcode
```
[iframe src="https://yourdomain.com/photobooth" allow="camera"]
```

---

## 📱 Device Requirements

- ✅ Modern browser (Chrome, Firefox, Safari, Edge)
- ✅ Camera access
- ✅ HTTPS connection
- ✅ JavaScript enabled

---

## 💾 Save Photos to Backend

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

## 🎯 User Flow

1. Click "Start Photobooth"
2. Allow camera access
3. Click "Start Session"
4. Countdown: 3... 2... 1...
5. Photo captured! (Flash effect)
6. Repeat for configured number of photos
7. Processing... Creating layout
8. Preview final result
9. Download PNG or JPG
10. Take new photos or close

---

## 🐛 Common Issues

### Camera not working?
- Ensure HTTPS is enabled
- Check browser permissions
- Add `allow="camera"` to iframe

### Photos look dark?
- Check lighting
- Try back camera (`cameraFacing: 'environment'`)

### Print quality issues?
- All layouts are 300 DPI
- Download PNG for best quality
- Print at actual size (no scaling)

---

## 📚 Full Documentation

- **User Guide**: [PHOTOBOOTH_README.md](./PHOTOBOOTH_README.md)
- **Integration**: [PHOTOBOOTH_INTEGRATION.md](./PHOTOBOOTH_INTEGRATION.md)
- **Summary**: [PHOTOBOOTH_SUMMARY.md](./PHOTOBOOTH_SUMMARY.md)

---

## 🎉 You're Ready!

Visit `/photobooth` or `/photobooth/demo` to get started!

**Questions?** Check the full documentation files above.
