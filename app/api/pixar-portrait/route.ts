import { NextResponse } from 'next/server';

export const AI_PORTRAIT_PRICE = 75;

const STYLE_PROMPTS: Record<string, string> = {
  pixar:      'pixar 3d animated movie character, vibrant colors, smooth 3d render, expressive big eyes, disney pixar studio quality, cinematic lighting',
  anime:      'anime illustration style, studio ghibli inspired, soft colors, detailed anime face, beautiful manga artwork',
  cartoon:    'disney animated cartoon character, fun colorful cartoon style, clean bold lines, bright cheerful colors',
  watercolor: 'beautiful watercolor portrait painting, soft watercolor washes, delicate artistic brush strokes, fine art illustration',
  sketch:     'detailed pencil sketch portrait, fine charcoal drawing, black and white, professional artistic sketch',
  oilpainting:'classical oil painting portrait, rich painterly textures, museum quality fine art portrait',
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

    const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.pixar;

    // Step 1: Upload image to Replicate to get a URL
    const uploadRes = await fetch('https://api.replicate.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': imageFile.type || 'image/jpeg',
      },
      body: imageFile,
    });

    let imageUrl: string;

    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.urls?.get || uploadData.url;
    } else {
      // Fallback: convert to base64 data URL
      const bytes = await imageFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      imageUrl = `data:${imageFile.type || 'image/jpeg'};base64,${base64}`;
    }

    // Step 2: Use flux-schnell with image_prompt for style transfer
    // This is the most reliable model available on Replicate for this use case
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/flux-1.1-pro',
        input: {
          prompt: `A portrait of a person in ${stylePrompt} style, maintaining facial features and likeness`,
          image_prompt: imageUrl,
          image_prompt_strength: 0.85,
          aspect_ratio: '1:1',
          output_format: 'jpg',
          output_quality: 90,
          safety_tolerance: 5,
          width: 1024,
          height: 1024,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('Replicate error:', createRes.status, errText.slice(0, 300));
      return NextResponse.json(
        { error: `Replicate API error: ${createRes.status}` },
        { status: createRes.status }
      );
    }

    const prediction = await createRes.json();

    if (prediction.status === 'succeeded' && prediction.output) {
      const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      return NextResponse.json({ success: true, url, predictionId: prediction.id });
    }

    return NextResponse.json({
      success: true,
      predictionId: prediction.id,
      status: prediction.status,
      polling: prediction.status === 'processing' || prediction.status === 'starting',
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
  if (!predictionId) return NextResponse.json({ error: 'Prediction ID required' }, { status: 400 });

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });

  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  if (!res.ok) return NextResponse.json({ error: 'Failed to poll prediction' }, { status: 500 });

  const prediction = await res.json();

  if (prediction.status === 'succeeded' && prediction.output) {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return NextResponse.json({ success: true, url, status: 'succeeded' });
  }
  if (prediction.status === 'failed') {
    return NextResponse.json({ error: prediction.error || 'Generation failed', status: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ status: prediction.status, polling: true });
}
