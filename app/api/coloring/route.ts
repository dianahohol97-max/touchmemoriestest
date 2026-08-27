import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';

// Photo → colouring page through the free HuggingFace Inference tier.
//
// Deliberately HuggingFace only. The pixar-portrait route falls back to
// Replicate and then Gemini when a provider fails, and every one of those
// calls costs real money; this tool is meant to cost nothing, so a failure
// here returns an error and the page falls back to the in-browser filter
// rather than quietly spending on another provider.
//
// Auth is required because this is an internal tool rather than a public
// feature, and the guard keeps the free quota from being drained by anyone
// who finds the endpoint.

const PROMPT =
  'turn this photo into a black and white coloring book page: clean uniform black outlines, ' +
  'pure white background, no shading, no grey, no hatching, no solid black areas, ' +
  'simple closed shapes that can be filled in with pencils';

// Instruction-driven image editing. Of everything the free tier serves, this
// is the family of model that actually redraws a photo instead of filtering
// it. The router host is the current one, and the legacy host is kept as a
// second try because HuggingFace has been moving models between the two.
const HOSTS = [
  'https://router.huggingface.co/hf-inference/models/',
  'https://api-inference.huggingface.co/models/',
];
const MODELS = ['timbrooks/instruct-pix2pix'];

interface Attempt {
  model: string;
  host: string;
  status: number;
  detail: string;
}

type TryResult = { ok: true; dataUrl: string } | { ok: false; attempt: Attempt };

async function tryModel(host: string, model: string, base64: string, token: string): Promise<TryResult> {
  let res: Response;
  try {
    res = await fetch(host + model, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true',
      },
      body: JSON.stringify({
        inputs: base64,
        parameters: {
          prompt: PROMPT,
          num_inference_steps: 20,
          image_guidance_scale: 1.4,
          guidance_scale: 7,
        },
        options: { wait_for_model: true },
      }),
    });
  } catch (err: any) {
    return { ok: false, attempt: { model, host, status: 0, detail: err?.message || 'network error' } };
  }

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, attempt: { model, host, status: res.status, detail: text.slice(0, 300) } };
  }

  // A JSON body behind a 200 means the model answered with an error or a queue
  // notice instead of an image, so for us that is still a failure.
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const text = await res.text();
    return { ok: false, attempt: { model, host, status: 200, detail: text.slice(0, 300) } };
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength < 2000) {
    return { ok: false, attempt: { model, host, status: 200, detail: 'empty image' } };
  }
  const mime = type.startsWith('image/') ? type : 'image/jpeg';
  return { ok: true, dataUrl: `data:${mime};base64,${Buffer.from(buf).toString('base64')}` };
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Безкоштовна генерація не налаштована: у змінних оточення немає HUGGINGFACE_API_TOKEN.' },
      { status: 500 },
    );
  }

  let imageFile: File | null = null;
  try {
    const formData = await request.formData();
    imageFile = formData.get('image') as File | null;
  } catch {
    return NextResponse.json({ error: 'Не вдалося прочитати завантажений файл.' }, { status: 400 });
  }

  if (!imageFile) {
    return NextResponse.json({ error: 'Потрібен файл зображення.' }, { status: 400 });
  }
  if (!(imageFile.type || '').startsWith('image/')) {
    return NextResponse.json({ error: 'Приймаються тільки зображення.' }, { status: 400 });
  }
  if (imageFile.size > 6 * 1024 * 1024) {
    return NextResponse.json({ error: 'Зображення завелике, максимум шість мегабайтів.' }, { status: 400 });
  }

  const base64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64');
  const attempts: Attempt[] = [];

  for (const host of HOSTS) {
    for (const model of MODELS) {
      const result = await tryModel(host, model, base64, token);
      if (result.ok) {
        return NextResponse.json({ success: true, url: result.dataUrl, model });
      }
      attempts.push(result.attempt);
      console.warn('coloring: HF attempt failed', result.attempt);
    }
  }

  // The provider reply is passed back on purpose. The free tier answers
  // differently depending on quota, where the model currently lives and time
  // of day, and that message is the only way to tell those cases apart from
  // inside the browser.
  const first = attempts[0];
  return NextResponse.json(
    {
      error: 'Безкоштовна модель не відповіла малюнком, тому скористайтеся контурним фільтром у браузері.',
      detail: first ? `${first.status}: ${first.detail}` : 'no attempts',
      attempts,
    },
    { status: 502 },
  );
}
