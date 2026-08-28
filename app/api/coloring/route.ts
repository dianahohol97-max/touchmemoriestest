import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';

// Photo → colouring page through Replicate.
//
// One model, chosen because it is the only one of the four tried that actually
// answered with a drawing: an instruction-following image editor, so the level
// of detail is set by rewording the instruction rather than by a slider over
// pixels. Everything else that was tried is documented at the bottom of this
// file so the next person does not repeat it.
//
// Auth is required: this is an internal tool, and every run is charged to the
// owner's Replicate account.

export const maxDuration = 60;

const MODEL = 'qwen/qwen-image-edit-plus';

// Shared spine of the instruction. Every level names the same forbidden
// things — grey, shading, filled black — because those are what the model
// reaches for by default and what makes a page impossible to colour in.
const BASE =
  'Create a black and white coloring book page from this photo. Pure white background, ' +
  'clean black outlines of even thickness, closed shapes that can be filled in with pencils. ' +
  'No shading, no grey tones, no hatching, no solid black areas, no photographic texture. ' +
  'Keep the same pose, composition and faces so the people stay recognisable.';

const LEVELS: Record<string, string> = {
  simple:
    `${BASE} Draw it very simply, the way a colouring book for a three year old is drawn: ` +
    'thick bold outlines, only the main shapes, large open areas to colour, ' +
    'faces reduced to a few simple lines, background almost empty.',
  normal:
    `${BASE} Draw it the way a classic children's colouring book is drawn: medium weight ` +
    'outlines, the main shapes plus the details that make the picture readable, ' +
    'simple hair strands, a light suggestion of the background.',
  detailed:
    `${BASE} Draw it the way a colouring book for adults is drawn: fine outlines, plenty of ` +
    'detail in hair, clothing folds, plants and background, many small areas to colour, ' +
    'while every line stays a clean contour rather than shading.',
};

interface Failure {
  status: number;
  detail: string;
}

/* Input field names differ between models and between versions of the same
   model, so they are read from the model's own schema instead of guessed. One
   wrong key is the difference between a drawing and a 422. */
function buildInput(props: Record<string, any>, dataUrl: string, prompt: string): Record<string, unknown> {
  const keys = Object.keys(props);
  const imageKey =
    ['image', 'input_image', 'image_1', 'images', 'img', 'image_path'].find(k => keys.includes(k)) ||
    keys.find(k => /image/i.test(k));
  const input: Record<string, unknown> = {};
  if (imageKey) {
    input[imageKey] = props[imageKey]?.type === 'array' ? [dataUrl] : dataUrl;
  }
  const promptKey = ['prompt', 'instruction', 'text'].find(k => keys.includes(k));
  if (promptKey) input[promptKey] = prompt;
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

async function draw(
  dataUrl: string,
  prompt: string,
  token: string,
): Promise<{ ok: true; url: string } | { ok: false; fail: Failure }> {
  const auth = { Authorization: `Bearer ${token}` };

  let props: Record<string, any> = {};
  let versionId: string | undefined;
  try {
    const infoRes = await fetch(`https://api.replicate.com/v1/models/${MODEL}`, { headers: auth });
    if (!infoRes.ok) {
      return { ok: false, fail: { status: infoRes.status, detail: `опис моделі недоступний: ${(await infoRes.text()).slice(0, 200)}` } };
    }
    const info = await infoRes.json();
    props = info?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || {};
    versionId = info?.latest_version?.id;
  } catch (err: any) {
    return { ok: false, fail: { status: 0, detail: err?.message || 'schema fetch failed' } };
  }

  const input = buildInput(props, dataUrl, prompt);
  if (Object.keys(input).length === 0) {
    return { ok: false, fail: { status: 422, detail: 'у моделі немає поля для зображення' } };
  }

  // Two different endpoints, and picking the wrong one answers 404 even though
  // the model plainly exists: /models/{owner}/{name}/predictions runs only
  // official models, while a community model is started through /predictions
  // with the id of its current version.
  const url = versionId
    ? 'https://api.replicate.com/v1/predictions'
    : `https://api.replicate.com/v1/models/${MODEL}/predictions`;
  const body = versionId ? { version: versionId, input } : { input };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'wait=40' },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    return { ok: false, fail: { status: 0, detail: err?.message || 'network error' } };
  }

  if (!res.ok) {
    return { ok: false, fail: { status: res.status, detail: (await res.text()).slice(0, 300) } };
  }

  let prediction = await res.json();
  const deadline = Date.now() + 12_000;
  for (
    let i = 0;
    i < 6 &&
    Date.now() < deadline &&
    prediction?.status &&
    prediction.status !== 'succeeded' &&
    prediction.status !== 'failed' &&
    prediction.status !== 'canceled';
    i++
  ) {
    await new Promise(r => setTimeout(r, 2000));
    const pollUrl = prediction?.urls?.get;
    if (!pollUrl) break;
    const pollRes = await fetch(pollUrl, { headers: auth });
    if (!pollRes.ok) break;
    prediction = await pollRes.json();
  }

  if (prediction?.status !== 'succeeded' || !prediction?.output) {
    // Still running is a different answer from failed, and it is the one worth
    // telling apart: the model is warm now, so a second press usually lands.
    if (prediction?.status === 'starting' || prediction?.status === 'processing') {
      return {
        ok: false,
        fail: {
          status: 504,
          detail: 'модель малює довше, ніж дозволяє сервер. Вона щойно прокинулася, тож натисніть кнопку ще раз, друга спроба зазвичай встигає.',
        },
      };
    }
    return {
      ok: false,
      fail: { status: 502, detail: `${prediction?.status || 'unknown'}: ${String(prediction?.error || '').slice(0, 200)}` },
    };
  }

  const outUrl = firstImageUrl(prediction.output);
  if (!outUrl) {
    return { ok: false, fail: { status: 502, detail: `модель повернула не зображення: ${JSON.stringify(prediction.output).slice(0, 200)}` } };
  }

  try {
    // Proxied rather than handed over as a link: the page draws the result on a
    // canvas to lay it out on A4, and a cross origin image would taint that
    // canvas and break saving.
    const imgRes = await fetch(outUrl);
    if (!imgRes.ok) throw new Error(`output fetch ${imgRes.status}`);
    const buf = await imgRes.arrayBuffer();
    const mime = imgRes.headers.get('content-type') || 'image/png';
    return { ok: true, url: `data:${mime};base64,${Buffer.from(buf).toString('base64')}` };
  } catch (err: any) {
    return { ok: false, fail: { status: 502, detail: err?.message || 'output fetch failed' } };
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Генерація не налаштована: у змінних оточення немає REPLICATE_API_TOKEN.' },
      { status: 500 },
    );
  }

  let imageFile: File | null = null;
  let level = 'normal';
  try {
    const formData = await request.formData();
    imageFile = formData.get('image') as File | null;
    level = (formData.get('level') as string) || 'normal';
  } catch {
    return NextResponse.json({ error: 'Не вдалося прочитати завантажений файл.' }, { status: 400 });
  }

  const prompt = LEVELS[level];
  if (!prompt) {
    return NextResponse.json({ error: 'Невідомий рівень складності.' }, { status: 400 });
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

  const mime = imageFile.type || 'image/jpeg';
  const base64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64');
  const result = await draw(`data:${mime};base64,${base64}`, prompt, token);

  if (result.ok) {
    return NextResponse.json({ success: true, url: result.url, model: MODEL, level });
  }

  console.warn('coloring: Replicate failed', result.fail);

  // 402 is not a bug: the request was accepted and the model exists, the
  // account simply has no credit. Saying that plainly saves a round of
  // debugging something that is not broken.
  if (result.fail.status === 402) {
    return NextResponse.json(
      {
        error: 'На рахунку Replicate немає коштів, тому модель не запустилася.',
        detail: 'Поповніть баланс на replicate.com/account/billing і спробуйте за кілька хвилин.',
      },
      { status: 402 },
    );
  }

  return NextResponse.json(
    { error: 'Модель не повернула малюнок.', detail: `${result.fail.status}: ${result.fail.detail}` },
    { status: 502 },
  );
}

// Tried and rejected, so that nobody spends money learning it again:
//   jagilley/controlnet-scribble — answered with solid black masses instead of
//     line art, because it generates an image guided by a scribble rather than
//     extracting one.
//   paappraiser/retro-coloring-book — a community model that kept exceeding the
//     serverless time budget on a cold start.
//   openai/gpt-image-1.5 — dearest of the three and never needed once the
//     editor above produced usable pages.
//   carolineec/informativedrawings — does not exist under that name at all.
