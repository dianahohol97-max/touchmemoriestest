import { NextResponse } from 'next/server';

// Replicate API — FLUX 2 Pro for AI Portrait transformation
// Model: black-forest-labs/flux-2-pro
// Docs: https://replicate.com/black-forest-labs/flux-2-pro/api

export const AI_PORTRAIT_PRICE = 75; // UAH surcharge

const STYLE_PRESETS: Record<string, { prompt: string }> = {
  pixar: {
    prompt: 'Pixar 3D animated movie character portrait, vibrant colors, smooth 3D render, expressive big eyes, Pixar animation style, cinematic lighting, highly detailed face, Disney Pixar studio quality',
  },
  anime: {
    prompt: 'Anime style portrait illustration, Studio Ghibli inspired artwork, soft colors, detailed anime face, beautiful manga art, professional anime illustration, high quality',
  },
  cartoon: {
    prompt: 'Disney animated cartoon character portrait, fun colorful cartoon style, clean lines, bright colors, professional Disney animation quality, expressive features',
  },
  watercolor: {
    prompt: 'Beautiful watercolor portrait painting, soft watercolor brush strokes, delicate washes of color, artistic fine art illustration, professional watercolor technique',
  },
  sketch: {
    prompt: 'Detailed pencil sketch portrait, fine charcoal drawing, artistic pencil illustration, black and white, professional fine art sketch, realistic pencil technique',
  },
  oilpainting: {
    prompt: 'Classical oil painting portrait, rich oil paint textures, painterly brushstrokes, Renaissance style portrait, fine art museum quality oil painting',
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

    // Convert file to base64 data URL
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // FLUX 2 Pro — image-to-image with style transfer
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/flux-2-pro',
        input: {
          image: dataUrl,
          prompt: preset.prompt,
          image_prompt_strength: 0.3, // how much to preserve original face
          aspect_ratio: '1:1',
          output_format: 'jpg',
          output_quality: 90,
          safety_tolerance: 5,
        },
      }),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error('Replicate FLUX error:', createResponse.status, errText);
      return NextResponse.json(
        { error: `Replicate API error: ${createResponse.status}` },
        { status: createResponse.status }
      );
    }

    const prediction = await createResponse.json();

    if (prediction.status === 'succeeded' && prediction.output) {
      const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      return NextResponse.json({ success: true, url, predictionId: prediction.id });
    }

    // Need polling
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

// GET — poll prediction status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const predictionId = searchParams.get('id');

  if (!predictionId) {
    return NextResponse.json({ error: 'Prediction ID required' }, { status: 400 });
  }

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
  }

  const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to get prediction status' }, { status: 500 });
  }

  const prediction = await response.json();

  if (prediction.status === 'succeeded' && prediction.output) {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return NextResponse.json({ success: true, url, status: 'succeeded' });
  } else if (prediction.status === 'failed') {
    return NextResponse.json({ error: prediction.error || 'Failed', status: 'failed' }, { status: 500 });
  }

  return NextResponse.json({ status: prediction.status, polling: true });
}
// REPLICATE_API_TOKEN — add to Vercel env vars, never in code
