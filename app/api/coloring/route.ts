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

// Replicate line art. Opt-in only: the caller has to ask for it by name, so
// nothing here ever spends money on its own. The model is a small purpose
// built network rather than a diffusion model — roughly two kopiykas per
// photo against a hryvnia and a half for Gemini — and it draws clean even
// strokes, but it only redraws what the photo already contains. Cartoon eyes
// or invented decorations are outside what it does.
// Confirmed to exist by asking Replicate itself — the previous name was written
// from memory and did not. Each entry is a different bargain between price and
// how much the model is allowed to reinvent:
//   qwen-image-edit-plus  — follows a written instruction, so it can actually
//                           redraw a face into colouring-book line art;
//   retro-coloring-book   — purpose-built for colouring pages;
//   controlnet-scribble   — the cheap one, extracts an outline and nothing more.
const REPLICATE_MODELS: Record<string, string> = {
  edit: 'qwen/qwen-image-edit-plus',
  coloring: 'paappraiser/retro-coloring-book',
  outline: 'jagilley/controlnet-scribble',
};

/* Input field names differ from model to model, so they are read from the
   model's own schema instead of guessed. One wrong key is the difference
   between a drawing and a 422. */
function buildInput(props: Record<string, any>, dataUrl: string): Record<string, unknown> {
  const keys = Object.keys(props);
  const imageKey =
    ['image', 'input_image', 'image_1', 'images', 'img', 'image_path'].find(k => keys.includes(k)) ||
    keys.find(k => /image/i.test(k));
  const input: Record<string, unknown> = {};
  if (imageKey) {
    input[imageKey] = props[imageKey]?.type === 'array' ? [dataUrl] : dataUrl;
  }
  const promptKey = ['prompt', 'instruction', 'text'].find(k => keys.includes(k));
  if (promptKey) input[promptKey] = PROMPT;
  return input;
}

function firstImageUrl(output: unknown): string | null {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const found = output.find(v => typeof v === 'string');
    return typeof found === 'string' ? found : null;
  }
  if (output && typeof output === 'object') {
    const values = Object.values(output as Record<string, unknown>);
    return firstImageUrl(values.find(v => typeof v === 'string' || Array.isArray(v)));
  }
  return null;
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`output fetch ${res.status}`);
  const buf = await res.arrayBuffer();
  const mime = res.headers.get('content-type') || 'image/png';
  return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
}

// When the model call fails, ask Replicate itself what exists. The name below
// was written from memory and could not be verified from the build environment,
// where api.replicate.com is blocked — this turns a dead end into an answer the
// page can show, instead of another round of guessing.
async function replicateDiagnostics(token: string): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };
  const notes: string[] = [];

  const candidates = [
    'carolineec/informativedrawings',
    'jagilley/controlnet-scribble',
    'rossjillian/controlnet',
    'catacolabs/cartoonify',
    'fofr/style-transfer',
  ];
  const alive: string[] = [];
  for (const name of candidates) {
    try {
      const res = await fetch(`https://api.replicate.com/v1/models/${name}`, { headers });
      if (res.ok) alive.push(name);
    } catch {
      /* a probe that cannot reach the API tells us nothing, so skip it */
    }
  }
  notes.push(alive.length ? `існують: ${alive.join(', ')}` : 'жодна з відомих назв не існує');

  try {
    const res = await fetch('https://api.replicate.com/v1/models', {
      method: 'QUERY',
      headers: { ...headers, 'Content-Type': 'text/plain' },
      body: 'photo to line drawing coloring book',
    });
    if (res.ok) {
      const data = await res.json();
      const names = (data?.results || [])
        .slice(0, 8)
        .map((m: any) => `${m.owner}/${m.name}`)
        .join(', ');
      if (names) notes.push(`пошук: ${names}`);
    } else {
      notes.push(`пошук недоступний (${res.status})`);
    }
  } catch (err: any) {
    notes.push(`пошук не вдався: ${err?.message || 'помилка'}`);
  }

  return notes.join(' · ');
}

async function generateWithReplicate(
  dataUrl: string,
  token: string,
  model: string,
): Promise<{ ok: true; url: string } | { ok: false; status: number; detail: string }> {
  const auth = { Authorization: `Bearer ${token}` };

  // Read the model's own input schema first, so the request uses the field
  // names the model actually declares.
  let props: Record<string, any> = {};
  try {
    const infoRes = await fetch(`https://api.replicate.com/v1/models/${model}`, { headers: auth });
    if (!infoRes.ok) {
      return { ok: false, status: infoRes.status, detail: `модель ${model}: ${(await infoRes.text()).slice(0, 200)}` };
    }
    const info = await infoRes.json();
    props = info?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || {};
  } catch (err: any) {
    return { ok: false, status: 0, detail: err?.message || 'schema fetch failed' };
  }

  const input = buildInput(props, dataUrl);
  if (Object.keys(input).length === 0) {
    return { ok: false, status: 422, detail: `у моделі ${model} немає поля для зображення` };
  }

  // The /models/{owner}/{name}/predictions form runs the model's current
  // version, which saves pinning a version hash that would go stale.
  let res: Response;
  try {
    res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'wait=55' },
      body: JSON.stringify({ input }),
    });
  } catch (err: any) {
    return { ok: false, status: 0, detail: err?.message || 'network error' };
  }

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, detail: text.slice(0, 300) };
  }

  let prediction = await res.json();
  // Prefer: wait usually returns a finished prediction, but a cold model can
  // still be running when the header times out, so poll a little.
  for (let i = 0; i < 12 && prediction?.status && prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled'; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const pollUrl = prediction?.urls?.get;
    if (!pollUrl) break;
    const pollRes = await fetch(pollUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!pollRes.ok) break;
    prediction = await pollRes.json();
  }

  if (prediction?.status !== 'succeeded' || !prediction?.output) {
    return {
      ok: false,
      status: 502,
      detail: `${prediction?.status || 'unknown'}: ${String(prediction?.error || '').slice(0, 200)}`,
    };
  }

  const outUrl = firstImageUrl(prediction.output);
  if (!outUrl) {
    return { ok: false, status: 502, detail: `модель повернула не зображення: ${JSON.stringify(prediction.output).slice(0, 200)}` };
  }
  try {
    // Proxied rather than handed over as a link on purpose: the page draws the
    // result on a canvas to lay it out on A4, and a cross origin image would
    // taint that canvas and break saving.
    return { ok: true, url: await fetchAsDataUrl(outUrl) };
  } catch (err: any) {
    return { ok: false, status: 502, detail: err?.message || 'output fetch failed' };
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  let imageFile: File | null = null;
  let provider = 'hf';
  let variant = 'edit';
  try {
    const formData = await request.formData();
    imageFile = formData.get('image') as File | null;
    provider = (formData.get('provider') as string) || 'hf';
    variant = (formData.get('model') as string) || 'edit';
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

  if (provider === 'replicate') {
    const rToken = process.env.REPLICATE_API_TOKEN;
    if (!rToken) {
      return NextResponse.json(
        { error: 'Платна модель не налаштована: у змінних оточення немає REPLICATE_API_TOKEN.' },
        { status: 500 },
      );
    }
    const model = REPLICATE_MODELS[variant];
    if (!model) {
      return NextResponse.json({ error: 'Невідома модель.' }, { status: 400 });
    }
    const mime = imageFile.type || 'image/jpeg';
    const result = await generateWithReplicate(`data:${mime};base64,${base64}`, rToken, model);
    if (result.ok) {
      return NextResponse.json({ success: true, url: result.url, provider: 'replicate', model });
    }
    console.warn('coloring: Replicate failed', result);
    let detail = `${result.status}: ${result.detail}`;
    if (result.status === 404) {
      detail += ` — ${await replicateDiagnostics(rToken)}`;
    }
    return NextResponse.json({ error: 'Replicate не повернув малюнок.', detail }, { status: 502 });
  }

  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Безкоштовна генерація не налаштована: у змінних оточення немає HUGGINGFACE_API_TOKEN.' },
      { status: 500 },
    );
  }

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
