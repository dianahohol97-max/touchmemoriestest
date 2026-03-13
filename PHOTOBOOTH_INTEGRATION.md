# Photobooth Integration Guide

This guide shows how to integrate the Online Photobooth into different platforms and frameworks.

## Table of Contents

- [Next.js / React Integration](#nextjs--react-integration)
- [HTML / Static Sites](#html--static-sites)
- [WordPress](#wordpress)
- [Shopify](#shopify)
- [Wix](#wix)
- [Custom Backend Integration](#custom-backend-integration)

---

## Next.js / React Integration

### Method 1: Direct Component Import (Recommended)

```tsx
// app/my-page/page.tsx
'use client';

import { PhotoboothEmbed, LAYOUTS } from '@/components/photobooth';

export default function MyPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PhotoboothEmbed
        initialConfig={{
          layout: LAYOUTS.photostrip_2x6,
          capture: { numberOfPhotos: 3 },
        }}
        allowConfiguration={true}
      />
    </div>
  );
}
```

### Method 2: As a Modal

```tsx
'use client';

import { useState } from 'react';
import { PhotoboothEmbed } from '@/components/photobooth';

export default function EventPage() {
  const [showPhotobooth, setShowPhotobooth] = useState(false);

  return (
    <>
      <button onClick={() => setShowPhotobooth(true)}>
        Open Photobooth
      </button>

      {showPhotobooth && (
        <div className="photobooth-modal">
          <PhotoboothEmbed />
          <button onClick={() => setShowPhotobooth(false)}>Close</button>
        </div>
      )}
    </>
  );
}
```

### Method 3: Conditional Rendering

```tsx
export default function ProductPage() {
  const [step, setStep] = useState<'product' | 'photobooth'>('product');

  if (step === 'photobooth') {
    return <PhotoboothEmbed onComplete={() => setStep('product')} />;
  }

  return (
    <div>
      <h1>Add Your Photo</h1>
      <button onClick={() => setStep('photobooth')}>
        Take Photo
      </button>
    </div>
  );
}
```

---

## HTML / Static Sites

### Using iframe (Simplest Method)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Photobooth</title>
  <style>
    body { margin: 0; padding: 0; }
    #photobooth {
      width: 100vw;
      height: 100vh;
      border: none;
    }
  </style>
</head>
<body>
  <iframe
    id="photobooth"
    src="https://yourdomain.com/photobooth"
    allow="camera; microphone"
  ></iframe>
</body>
</html>
```

### Embedded in a Page Section

```html
<div class="event-section">
  <h2>Take a Photo!</h2>
  <div style="height: 600px;">
    <iframe
      src="https://yourdomain.com/photobooth"
      width="100%"
      height="100%"
      frameborder="0"
      allow="camera"
    ></iframe>
  </div>
</div>
```

### With URL Parameters

```html
<iframe
  src="https://yourdomain.com/photobooth?layout=photostrip_2x6&photos=4&event=Wedding"
  width="100%"
  height="600px"
  allow="camera"
></iframe>
```

---

## WordPress

### Method 1: Using Shortcode

Add to your theme's `functions.php`:

```php
function photobooth_shortcode($atts) {
    $atts = shortcode_atts(array(
        'layout' => 'photostrip_2x6',
        'photos' => '3',
        'event' => '',
    ), $atts);

    $url = 'https://yourdomain.com/photobooth';
    $url .= '?layout=' . urlencode($atts['layout']);
    $url .= '&photos=' . urlencode($atts['photos']);
    if ($atts['event']) {
        $url .= '&event=' . urlencode($atts['event']);
    }

    return '<div class="photobooth-wrapper" style="width:100%; height:600px;">
        <iframe src="' . esc_url($url) . '"
                width="100%"
                height="100%"
                frameborder="0"
                allow="camera">
        </iframe>
    </div>';
}
add_shortcode('photobooth', 'photobooth_shortcode');
```

Usage in posts/pages:

```
[photobooth layout="photostrip_2x6" photos="4" event="Wedding 2026"]
```

### Method 2: Gutenberg Block

```html
<!-- wp:html -->
<div style="height: 600px;">
  <iframe
    src="https://yourdomain.com/photobooth"
    width="100%"
    height="100%"
    frameborder="0"
    allow="camera"
  ></iframe>
</div>
<!-- /wp:html -->
```

### Method 3: Page Template

Create a custom page template `page-photobooth.php`:

```php
<?php
/*
Template Name: Photobooth
*/
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Photobooth</title>
    <style>
        body { margin: 0; padding: 0; }
        #photobooth { width: 100vw; height: 100vh; border: none; }
    </style>
</head>
<body>
    <iframe
        id="photobooth"
        src="https://yourdomain.com/photobooth"
        allow="camera"
    ></iframe>
</body>
</html>
```

---

## Shopify

### Method 1: Custom Page

1. Go to **Online Store** → **Pages** → **Add page**
2. Click **Show HTML** button
3. Paste:

```html
<div style="width: 100%; height: 600px;">
  <iframe
    src="https://yourdomain.com/photobooth"
    width="100%"
    height="100%"
    frameborder="0"
    allow="camera"
  ></iframe>
</div>
```

### Method 2: Product Page Integration

In your theme's `product-template.liquid`:

```liquid
{% if product.tags contains 'photobooth' %}
  <div class="photobooth-section">
    <h3>Customize with Your Photo</h3>
    <div style="height: 600px;">
      <iframe
        src="https://yourdomain.com/photobooth?product={{ product.handle }}"
        width="100%"
        height="100%"
        frameborder="0"
        allow="camera"
      ></iframe>
    </div>
  </div>
{% endif %}
```

### Method 3: App Embed

Create a custom app that embeds the photobooth in your checkout flow.

---

## Wix

### Method 1: HTML iframe Widget

1. Click **Add** → **Embed** → **HTML iframe**
2. Paste this code:

```html
<iframe
  src="https://yourdomain.com/photobooth"
  width="100%"
  height="600"
  frameborder="0"
  allow="camera"
></iframe>
```

3. Adjust size and position

### Method 2: Custom Element

1. Add **Custom Element** to your page
2. Set **Tag Name** to: `iframe`
3. Add attributes:
   - `src`: `https://yourdomain.com/photobooth`
   - `allow`: `camera`
   - `width`: `100%`
   - `height`: `600`

---

## Custom Backend Integration

### Saving Photos to Your Server

When a user completes a photobooth session, you can save the photo:

#### Next.js API Route

```typescript
// app/api/photobooth/save/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No photo provided' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads
    const filename = `photobooth-${Date.now()}.png`;
    const filepath = path.join(process.cwd(), 'public/uploads', filename);
    await writeFile(filepath, buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/${filename}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save photo' },
      { status: 500 }
    );
  }
}
```

#### Client-side Upload

```typescript
// In your PhotoboothEmbed component
const handleComplete = async (imageDataUrl: string) => {
  // Convert data URL to blob
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();

  // Create form data
  const formData = new FormData();
  formData.append('photo', blob, 'photobooth.png');

  // Upload to server
  const uploadResponse = await fetch('/api/photobooth/save', {
    method: 'POST',
    body: formData,
  });

  const result = await uploadResponse.json();
  console.log('Photo saved:', result.url);
};
```

### Database Integration

```typescript
// Save to database (Supabase example)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('photo') as File;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('photobooth')
    .upload(`photos/${Date.now()}.png`, file);

  if (error) throw error;

  // Save metadata to database
  await supabase.from('photobooth_sessions').insert({
    photo_url: data.path,
    created_at: new Date().toISOString(),
    event_id: request.headers.get('event-id'),
  });

  return NextResponse.json({ success: true });
}
```

### Email Integration

```typescript
// Send photo via email (using Resend)
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const { imageDataUrl, email } = await request.json();

  // Convert to buffer
  const base64Data = imageDataUrl.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');

  await resend.emails.send({
    from: 'Photobooth <noreply@yourdomain.com>',
    to: email,
    subject: 'Your Photobooth Photos!',
    html: '<h1>Thank you!</h1><p>Your photos are attached.</p>',
    attachments: [
      {
        filename: 'photobooth.png',
        content: buffer,
      },
    ],
  });

  return NextResponse.json({ success: true });
}
```

---

## URL Parameters

You can customize the photobooth via URL parameters:

| Parameter | Values | Example |
|-----------|--------|---------|
| `layout` | `photostrip_2x6`, `print_4x6_grid`, `square_instagram` | `?layout=photostrip_2x6` |
| `photos` | `1-10` | `?photos=4` |
| `countdown` | `1-10` | `?countdown=5` |
| `camera` | `user`, `environment` | `?camera=environment` |
| `event` | Any string | `?event=Wedding%202026` |

Example:
```
https://yourdomain.com/photobooth?layout=photostrip_2x6&photos=4&event=My%20Event
```

---

## Cross-Origin Communication

If embedding via iframe, you can communicate between the parent page and the photobooth:

### Parent Page (Receiving Messages)

```javascript
window.addEventListener('message', (event) => {
  // Verify origin in production!
  if (event.origin !== 'https://yourdomain.com') return;

  if (event.data.type === 'photobooth-complete') {
    console.log('Photo ready!', event.data.imageDataUrl);
    // Handle the completed photo
  }
});
```

### Photobooth (Sending Messages)

```typescript
// In PhotoboothEmbed component
const handleComplete = (imageDataUrl: string) => {
  // Send to parent window
  window.parent.postMessage({
    type: 'photobooth-complete',
    imageDataUrl: imageDataUrl,
  }, '*'); // Replace '*' with specific origin in production
};
```

---

## Security Considerations

1. **HTTPS Required** - Camera access only works over HTTPS
2. **Origin Verification** - Always verify `event.origin` when using `postMessage`
3. **Content Security Policy** - Add camera permissions to CSP headers
4. **File Upload Validation** - Validate file type and size on server
5. **Rate Limiting** - Implement rate limiting on photo upload endpoints

---

## Performance Tips

1. **Lazy Loading** - Load photobooth component only when needed
2. **Image Compression** - Compress images before upload
3. **CDN** - Serve static assets via CDN
4. **Caching** - Cache layout configurations
5. **Progressive Enhancement** - Show fallback for unsupported browsers

---

## Browser Support

The photobooth requires:
- Modern browser with camera support
- JavaScript enabled
- HTTPS connection (for camera access)

Tested on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14.3+
- ✅ Edge 90+
- ✅ iOS Safari 14.3+
- ✅ Chrome Android 90+

---

## Troubleshooting

### Camera not working in iframe

Add `allow="camera"` attribute:
```html
<iframe src="..." allow="camera"></iframe>
```

### CORS errors

Ensure your Next.js app allows embedding:
```typescript
// next.config.ts
const config = {
  async headers() {
    return [
      {
        source: '/photobooth',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // or remove entirely
          },
        ],
      },
    ];
  },
};
```

### Photos not saving

Check:
1. Server has write permissions
2. Upload directory exists
3. File size limits not exceeded
4. API route is accessible

---

## Support

For issues or questions, refer to the main [PHOTOBOOTH_README.md](./PHOTOBOOTH_README.md) documentation.
