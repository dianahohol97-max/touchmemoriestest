import { NextResponse } from 'next/server';

export const AI_PORTRAIT_PRICE = 75;

const STYLE_PROMPTS: Record<string, string> = {
  pixar:      'pixar 3d animation style character portrait, vibrant colors, smooth render, expressive eyes, cinematic lighting, disney pixar quality',
  anime:      'anime illustration portrait, studio ghibli style, soft colors, detailed manga face, professional anime art',
  cartoon:    'disney animated cartoon portrait, bold lines, bright colors, fun expressive character',
  watercolor: 'watercolor portrait painting, soft washes, delicate brushwork, artistic fine art',
  sketch:     'detailed pencil sketch portrait, charcoal drawing, black and white, fine art',
  oilpainting:'classical oil painting portrait, rich textures, old masters style, museum quality',
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

    // Convert to base64
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Use flux-dev which correctly supports image (img2img) parameter
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/flux-dev',
        input: {
          image: dataUrl,        // flux-dev accepts base64 image for img2img
          prompt: stylePrompt,
          strength: 0.75,        // how much to change: 0=same, 1=ignore original
          num_inference_steps: 28,
          guidance: 3.5,
          output_format: 'jpg',
          output_quality: 90,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('Replicate flux-dev error:', createRes.status, errText.slice(0, 400));

      // Fallback: try sdxl-img2img
      return await fallbackSdxl(apiToken, dataUrl, stylePrompt);
    }

    const prediction = await createRes.json();
    console.log('flux-dev prediction:', prediction.id, prediction.status);

    if (prediction.status === 'succeeded' && prediction.output) {
      const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      return NextResponse.json({ success: true, url, predictionId: prediction.id });
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

async function fallbackSdxl(apiToken: string, dataUrl: string, prompt: string) {
  console.log('Falling back to lucataco/sdxl-img2img');
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify({
      model: 'lucataco/sdxl-img2img',
      input: {
        image: dataUrl,
        prompt: prompt,
        strength: 0.7,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: `AI generation failed: ${res.status}` },
      { status: res.status }
    );
  }

  const prediction = await res.json();
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

  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  if (!res.ok) return NextResponse.json({ error: 'Failed to poll' }, { status: 500 });

  const prediction = await res.json();

  if (prediction.status === 'succeeded' && prediction.output) {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return NextResponse.json({ success: true, url, status: 'succeeded' });
  }
  if (prediction.status === 'failed') {
    return NextResponse.json({ error: prediction.error || 'Failed', status: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ status: prediction.status, polling: true });
}
