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

// HuggingFace Inference API — primary (free tier ~1000 req/day)
async function generateWithHuggingFace(prompt: string): Promise<{ success: boolean; url?: string; error?: string; status?: number }> {
  const hfToken = process.env.HUGGINGFACE_API_TOKEN;
  if (!hfToken) return { success: false, error: 'HF token not configured', status: 500 };

  const model = 'stabilityai/stable-diffusion-xl-base-1.0';
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
      'x-wait-for-model': 'true',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { num_inference_steps: 28, guidance_scale: 7.5 },
      options: { wait_for_model: true },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('HF error:', res.status, errText.slice(0, 300));
    return { success: false, error: `HF ${res.status}: ${errText.slice(0, 200)}`, status: res.status };
  }

  const imageBuffer = await res.arrayBuffer();
  if (imageBuffer.byteLength < 1000) {
    return { success: false, error: 'HF returned empty image', status: 500 };
  }
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  return { success: true, url: dataUrl };
}

// Replicate fallback
async function generateWithReplicate(dataUrl: string, prompt: string): Promise<any> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) return { success: false, error: 'Replicate token not configured', status: 500 };

  const fluxRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json', 'Prefer': 'wait=60' },
    body: JSON.stringify({
      model: 'black-forest-labs/flux-dev',
      input: { image: dataUrl, prompt, strength: 0.75, num_inference_steps: 28, guidance: 3.5, output_format: 'jpg', output_quality: 90 },
    }),
  });

  if (fluxRes.ok) {
    const prediction = await fluxRes.json();
    if (prediction.status === 'succeeded' && prediction.output) {
      const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      return { success: true, url, predictionId: prediction.id };
    }
    return { success: true, predictionId: prediction.id, status: prediction.status, polling: true };
  }

  const sdxlRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json', 'Prefer': 'wait=60' },
    body: JSON.stringify({
      model: 'lucataco/sdxl-img2img',
      input: { image: dataUrl, prompt, strength: 0.7, num_inference_steps: 30, guidance_scale: 7.5 },
    }),
  });

  if (!sdxlRes.ok) {
    const err = await sdxlRes.text();
    return { success: false, error: `Replicate failed: ${sdxlRes.status} ${err.slice(0, 200)}`, status: sdxlRes.status };
  }

  const prediction = await sdxlRes.json();
  if (prediction.status === 'succeeded' && prediction.output) {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return { success: true, url, predictionId: prediction.id };
  }
  return { success: true, predictionId: prediction.id, status: prediction.status, polling: true };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const style = (formData.get('style') as string) || 'pixar';
    const provider = (formData.get('provider') as string) || 'auto';

    if (!imageFile) return NextResponse.json({ error: 'Image file required' }, { status: 400 });
    if (imageFile.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 });

    const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.pixar;
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Try HuggingFace first (free), fall back to Replicate on failure
    if (provider === 'auto' || provider === 'hf') {
      const hfResult = await generateWithHuggingFace(stylePrompt);
      if (hfResult.success) {
        return NextResponse.json({ success: true, url: hfResult.url, provider: 'hf' });
      }
      console.warn('HF failed, falling back to Replicate:', hfResult.error);
      if (provider === 'hf') {
        return NextResponse.json({ error: hfResult.error || 'HF generation failed' }, { status: hfResult.status || 500 });
      }
    }

    const result = await generateWithReplicate(dataUrl, stylePrompt);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'AI generation failed on all providers' }, { status: result.status || 500 });
    }
    return NextResponse.json({ ...result, provider: 'replicate' });

  } catch (err: any) {
    console.error('pixar-portrait error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

// GET — poll Replicate prediction (HF returns image immediately, no polling)
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
