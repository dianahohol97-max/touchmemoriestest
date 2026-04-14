import { NextResponse } from 'next/server';

// Replicate API — img2img style transfer for AI Portrait
// Using flux-1.1-pro with img2img support (correct params for 422 fix)
export const AI_PORTRAIT_PRICE = 75;

const STYLE_PRESETS: Record<string, { prompt: string }> = {
  pixar: {
    prompt: 'portrait in pixar 3d animation style, vibrant colors, smooth 3d render, expressive big eyes, cinematic lighting, high quality disney pixar character',
  },
  anime: {
    prompt: 'portrait in anime illustration style, studio ghibli inspired, soft colors, detailed anime face, beautiful manga artwork, high quality',
  },
  cartoon: {
    prompt: 'portrait as disney animated cartoon character, fun colorful cartoon style, clean lines, bright colors, expressive features',
  },
  watercolor: {
    prompt: 'portrait as beautiful watercolor painting, soft brush strokes, delicate color washes, artistic fine art illustration',
  },
  sketch: {
    prompt: 'portrait as detailed pencil sketch, fine charcoal drawing, black and white, professional fine art sketch',
  },
  oilpainting: {
    prompt: 'portrait as classical oil painting, rich textures, painterly brushstrokes, fine art museum quality portrait',
  },
};

export async function POST(request: Request) {
  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const style = (formData.get('style') as string) || 'pixar';

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 });
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 });
    }

    const preset = STYLE_PRESETS[style] || STYLE_PRESETS.pixar;

    // Convert file to base64
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Use tencentarc/photomaker-style — dedicated portrait style transfer model
    // This is the correct model for img2img face-preserving style transfer
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({
        model: 'tencentarc/photomaker-style',
        input: {
          input_image: dataUrl,
          style_name: style === 'pixar' ? 'Pixar/Disney Character' :
                      style === 'anime' ? 'Japanese Anime' :
                      style === 'watercolor' ? 'Digital/Oil Art' :
                      style === 'sketch' ? 'Neonpunk' :
                      'Photographic (Default)',
          prompt: `img ${preset.prompt}`,
          negative_prompt: 'ugly, deformed, nsfw, low quality, blurry, bad anatomy, watermark, text',
          num_outputs: 1,
          guidance_scale: 5,
          num_inference_steps: 25,
          style_strength_ratio: 35,
        },
      }),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error('Replicate error:', createResponse.status, errText);
      // Fallback to flux-1.1-pro img2img
      return await fallbackToFluxImg2Img(apiToken, dataUrl, preset.prompt);
    }

    const prediction = await createResponse.json();

    if (prediction.status === 'succeeded' && prediction.output?.[0]) {
      return NextResponse.json({ success: true, url: prediction.output[0], predictionId: prediction.id });
    }

    return NextResponse.json({
      success: true,
      predictionId: prediction.id,
      status: prediction.status,
      polling: true,
    });

  } catch (err: any) {
    console.error('pixar-portrait error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

async function fallbackToFluxImg2Img(apiToken: string, dataUrl: string, prompt: string) {
  // flux-1.1-pro supports image_prompt for img2img
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/flux-1.1-pro',
      input: {
        prompt: prompt,
        image_prompt: dataUrl,
        image_prompt_strength: 0.85,
        aspect_ratio: '1:1',
        output_format: 'jpg',
        output_quality: 90,
        safety_tolerance: 5,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Replicate API error: ${response.status} — ${err.slice(0, 200)}`);
  }

  const prediction = await response.json();
  if (prediction.status === 'succeeded' && prediction.output) {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return NextResponse.json({ success: true, url, predictionId: prediction.id });
  }
  return NextResponse.json({ success: true, predictionId: prediction.id, status: prediction.status, polling: true });
}

// GET — poll prediction status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const predictionId = searchParams.get('id');
  if (!predictionId) return NextResponse.json({ error: 'Prediction ID required' }, { status: 400 });

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });

  const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  if (!response.ok) return NextResponse.json({ error: 'Failed to get prediction status' }, { status: 500 });

  const prediction = await response.json();

  if (prediction.status === 'succeeded' && prediction.output) {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return NextResponse.json({ success: true, url, status: 'succeeded' });
  } else if (prediction.status === 'failed') {
    return NextResponse.json({ error: prediction.error || 'Failed', status: 'failed' }, { status: 500 });
  }

  return NextResponse.json({ status: prediction.status, polling: true });
}
