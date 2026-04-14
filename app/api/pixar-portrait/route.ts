import { NextResponse } from 'next/server';

// Replicate API — PhotoMaker Style model for Pixar/cartoon portrait
// Model: tencentarc/photomaker-style
// Docs: https://replicate.com/tencentarc/photomaker-style

const STYLE_PRESETS: Record<string, { prompt: string; negative: string }> = {
  pixar: {
    prompt: 'img pixar 3d animated movie character, vibrant colors, smooth 3d render, expressive big eyes, Pixar animation style, cinematic lighting, high quality, detailed face',
    negative: 'ugly, deformed, nsfw, low quality, blurry, bad anatomy, extra fingers, mutation, watermark, text',
  },
  anime: {
    prompt: 'img anime style portrait, detailed anime face, studio ghibli inspired, soft colors, beautiful artwork, high quality illustration',
    negative: 'ugly, deformed, nsfw, low quality, blurry, bad anatomy, watermark, text, realistic',
  },
  cartoon: {
    prompt: 'img cartoon portrait, fun colorful cartoon character, Disney animated style, bright colors, clean lines, professional cartoon art',
    negative: 'ugly, deformed, nsfw, low quality, blurry, bad anatomy, watermark, text, realistic, photo',
  },
  watercolor: {
    prompt: 'img beautiful watercolor portrait painting, soft watercolor brush strokes, artistic, pastel colors, fine art, professional illustration',
    negative: 'ugly, deformed, nsfw, low quality, blurry, bad anatomy, watermark, text, digital, 3d',
  },
  sketch: {
    prompt: 'img pencil sketch portrait, detailed charcoal drawing, artistic sketch, black and white, fine art portrait drawing, professional artist',
    negative: 'ugly, deformed, nsfw, low quality, blurry, bad anatomy, watermark, color, digital',
  },
  oilpainting: {
    prompt: 'img oil painting portrait, classical oil painting style, rich colors, painterly brushstrokes, fine art, museum quality portrait painting',
    negative: 'ugly, deformed, nsfw, low quality, blurry, bad anatomy, watermark, text, digital, modern',
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

    // Convert file to base64 data URL for Replicate
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Start prediction on Replicate
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60', // wait up to 60s for result
      },
      body: JSON.stringify({
        version: 'b2085f21e8c0c4d3f0dcd2f3c6b0b9e3f3f7c7a2c3b4d5e6f7a8b9c0d1e2f3',
        // Use photomaker-style latest version
        model: 'tencentarc/photomaker-style',
        input: {
          input_image: dataUrl,
          style_name: 'Pixar/Disney Character',
          prompt: preset.prompt,
          negative_prompt: preset.negative,
          num_outputs: 1,
          guidance_scale: 5,
          num_inference_steps: 25,
          style_strength_ratio: 35,
        },
      }),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error('Replicate create error:', createResponse.status, errText);
      
      // Try alternative model version
      return await tryAlternativeModel(apiToken, dataUrl, preset);
    }

    const prediction = await createResponse.json();

    // If already completed (Prefer: wait worked)
    if (prediction.status === 'succeeded' && prediction.output?.[0]) {
      return NextResponse.json({ success: true, url: prediction.output[0], predictionId: prediction.id });
    }

    // Return prediction ID for polling
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

async function tryAlternativeModel(apiToken: string, dataUrl: string, preset: { prompt: string; negative: string }) {
  // Fallback: use stable-diffusion-img2img for cartoon effect
  const response = await fetch('https://api.replicate.com/v1/predictions', {
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
        prompt: preset.prompt,
        negative_prompt: preset.negative,
        num_outputs: 1,
        guidance_scale: 5,
        num_inference_steps: 25,
        style_strength_ratio: 35,
        style_name: 'Pixar/Disney Character',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Replicate API error: ${response.status} — ${err.slice(0, 200)}`);
  }

  const prediction = await response.json();
  if (prediction.status === 'succeeded' && prediction.output?.[0]) {
    return NextResponse.json({ success: true, url: prediction.output[0], predictionId: prediction.id });
  }
  return NextResponse.json({ success: true, predictionId: prediction.id, status: prediction.status, polling: true });
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

  if (prediction.status === 'succeeded' && prediction.output?.[0]) {
    return NextResponse.json({ success: true, url: prediction.output[0], status: 'succeeded' });
  } else if (prediction.status === 'failed') {
    return NextResponse.json({ error: prediction.error || 'Prediction failed', status: 'failed' }, { status: 500 });
  }

  return NextResponse.json({ status: prediction.status, polling: true });
}
