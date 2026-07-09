/**
 * TouchMemories print render service (Railway + Playwright).
 *
 * Why this exists: the editor used html2canvas to "photograph" the on-screen
 * book, which is screen-resolution, browser-dependent, and bakes in UI. This
 * service instead opens the deterministic /print page in a real headless Chrome
 * and screenshots each spread at exactly the print pixel size (300 DPI), so the
 * printed result is pixel-identical to what the customer designed.
 *
 * Flow:
 *   POST /render  { projectId }   (auth via x-render-token)
 *     1. fetch /api/print/{projectId} to learn size + spread count
 *     2. for each spread: open /print/{projectId}?page=N at the exact px size,
 *        wait for fonts + images, screenshot to JPEG
 *     3. upload each JPEG to Supabase storage under {orderId}/print/NN.jpg
 *     4. return the list of uploaded paths
 *
 * Designed to run one project at a time; Railway keeps the Chromium warm.
 */

import express from 'express';
import { chromium, Browser } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import WebSocket from 'ws';

// Node 20 has no native WebSocket, and supabase-js initialises a realtime client
// in its constructor which needs one. We don't use realtime — polyfill it so the
// client can construct without crashing on boot.
(globalThis as any).WebSocket = (globalThis as any).WebSocket || WebSocket;

const PORT = process.env.PORT || 8080;
const APP_BASE_URL = process.env.APP_BASE_URL!;          // e.g. https://touchmemories.com.ua
const PRINT_RENDER_TOKEN = process.env.PRINT_RENDER_TOKEN!; // shared secret with the app
const RENDER_SERVICE_TOKEN = process.env.RENDER_SERVICE_TOKEN!; // secret to call THIS service
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'photobook-uploads';

const DPI = 300;
const mmToPx = (mm: number) => Math.round((mm * DPI) / 25.4);

// Spread/cover dimensions in millimetres per size key. Mirrors PRINT_DIMS_MM in
// the app (components/BookLayoutEditor.tsx). Keep these two in sync — including
// the Cyrillic × variants and the magazine / travelbook keys.
const PRINT_DIMS_MM: Record<string, { spread: { w: number; h: number }; cover: { w: number; h: number } }> = {
  '20x20':       { spread: { w: 405, h: 203 }, cover: { w: 457, h: 243 } },
  '20×20':       { spread: { w: 405, h: 203 }, cover: { w: 457, h: 243 } },
  '25x25':       { spread: { w: 500, h: 254 }, cover: { w: 566, h: 293 } },
  '25×25':       { spread: { w: 500, h: 254 }, cover: { w: 566, h: 293 } },
  '20x30':       { spread: { w: 420, h: 305 }, cover: { w: 470, h: 328 } },
  '20×30':       { spread: { w: 420, h: 305 }, cover: { w: 470, h: 328 } },
  '30x20':       { spread: { w: 610, h: 203 }, cover: { w: 646, h: 238 } },
  '30×20':       { spread: { w: 610, h: 203 }, cover: { w: 646, h: 238 } },
  '30x30':       { spread: { w: 610, h: 305 }, cover: { w: 646, h: 330 } },
  '30×30':       { spread: { w: 610, h: 305 }, cover: { w: 646, h: 330 } },
  // A4 hard-cover magazine — spread 420×307 mm, cover 470×328 mm.
  'A4':          { spread: { w: 420, h: 307 }, cover: { w: 470, h: 328 } },
  'magazine-A4': { spread: { w: 420, h: 307 }, cover: { w: 470, h: 328 } },
  // Travel Book — 20×30 cm portrait pages.
  'travelbook':  { spread: { w: 420, h: 305 }, cover: { w: 470, h: 328 } },
  '23x23':       { spread: { w: 460, h: 230 }, cover: { w: 506, h: 256 } },
  '23×23':       { spread: { w: 460, h: 230 }, cover: { w: 506, h: 256 } },
};

// Pick the size key the same way the app's getSizeKeyForProduct does: by product
// slug first (travel → 20x30, wishbook → selectedSize, magazine → A4), then fall
// back to the explicit selectedSize. Mirrors BookLayoutEditor so the render uses
// the exact same dimensions the customer designed against.
function resolveSizeKey(config: any): string {
  const slug = String(config?.productSlug || '').toLowerCase();
  if (slug.includes('travel')) return '20x30';
  if (slug.includes('wish') || slug.includes('guest') || slug.includes('pobazhan')) {
    return String(config?.selectedSize || '20x30').replace(/×/g, 'x');
  }
  if (slug.includes('magazine') || slug.includes('journal') || slug.includes('zhurnal') || slug.includes('fotozhurnal')) {
    return 'magazine-A4';
  }
  return String(config?.selectedSize || 'A4').replace(/×/g, 'x');
}

const app = express();
app.use(express.json());

let browser: Browser | null = null;
// Chromium leaks steadily when screenshotting 29-megapixel elements: the
// singleton survived 26 spreads on Jul 2 but the GPU process was OOM-killed
// (exit_code=9) on a heavier book. Recycle the browser every few spreads —
// a relaunch costs ~1s and resets the whole address space.
const SPREADS_PER_BROWSER = 5;
let spreadsOnCurrentBrowser = 0;

export async function recycleBrowserIfNeeded(): Promise<void> {
  if (++spreadsOnCurrentBrowser < SPREADS_PER_BROWSER) return;
  spreadsOnCurrentBrowser = 0;
  if (browser) {
    try { await browser.close(); } catch { /* already gone */ }
    browser = null;
    console.log('[render] browser recycled');
  }
}

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // The container has no GPU and limited shared memory, so GPU
        // compositing crashes (SIGSEGV) when screenshotting large print-size
        // elements. Force software rendering — slower but stable at 300 DPI.
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-features=VizDisplayCompositor',
        '--use-gl=swiftshader',
        '--force-color-profile=srgb',
      ],
    });
  }
  return browser;
}

// Node 20 has no native WebSocket, and supabase-js initialises a realtime client
// in its constructor which needs one. We don't use realtime (only storage), but
// the client still constructs it — the global WebSocket polyfill above handles it.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/render', async (req, res) => {
  // --- auth: only the app may call this service ---
  const token = req.headers['x-render-token'];
  if (token !== RENDER_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { projectId } = req.body || {};
  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  try {
    // 1. Learn the project's size + spread count from the app's print API.
    const metaRes = await fetch(
      `${APP_BASE_URL}/api/print/${projectId}?token=${encodeURIComponent(PRINT_RENDER_TOKEN)}`,
    );
    if (!metaRes.ok) {
      const body = await metaRes.text();
      return res.status(502).json({ error: `print API ${metaRes.status}`, body });
    }
    const { project, printSpec } = await metaRes.json();
    const config = project?.overlays_data?.config || {};

    // Derive the user/order path so we store next to the originals. Books store
    // under .../originals/...; calendars store originals in order-files under
    // {user}/{cartItemId}/... — handle both so output lands in a sane folder.
    const firstPath: string | undefined = project?.uploaded_photos?.find((p: any) => p?.path)?.path;
    let orderPrefix: string;
    if (firstPath && firstPath.includes('/originals/')) {
      orderPrefix = firstPath.split('/originals/')[0];
    } else if (firstPath) {
      orderPrefix = firstPath.split('/').slice(0, 2).join('/');
    } else {
      orderPrefix = `unknown/${projectId}`;
    }

    const b = await getBrowser();
    const uploaded: string[] = [];

    // Two render modes:
    //   • printSpec present (calendars, future products): one full page per
    //     [data-print-page], sized to printSpec.pages[i] mm, captured whole.
    //   • no printSpec (books): cover + spreads via [data-print-spread].
    if (printSpec && Array.isArray(printSpec.pages) && printSpec.pages.length) {
      const selector = printSpec.selector || '[data-print-page]';
      const failed: { page: number; error: string }[] = [];
      for (let i = 0; i < printSpec.pages.length; i++) {
        const mm = printSpec.pages[i];
        const pxW = mmToPx(mm.w);
        const pxH = mmToPx(mm.h);
        const page = await b.newPage({
          viewport: { width: pxW + 40, height: pxH + 40 },
          deviceScaleFactor: 1,
        });
        try {
          const url = `${APP_BASE_URL}/uk/print/${projectId}?token=${encodeURIComponent(PRINT_RENDER_TOKEN)}&page=${i}&w=${pxW}`;
          await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
          await page.waitForSelector(selector, { timeout: 30000 });
          await page.evaluate(async () => {
            await (document as any).fonts?.ready;
            const imgs = Array.from(document.images);
            // Bound image waiting so a single stalled/empty <img> can't hang the
            // whole page: resolve after 8s even if onload never fires.
            await Promise.all(imgs.map(img => img.complete && img.naturalWidth > 0
              ? Promise.resolve()
              : new Promise(r => {
                  const done = () => r(null);
                  img.onload = done; img.onerror = done;
                  setTimeout(done, 8000);
                })));
          });
          await page.waitForTimeout(300);
          const el = await page.$(selector);
          if (!el) throw new Error(`no print page element for page ${i}`);
          const raw = await el.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
          const probe = await sharp(raw).metadata();
          console.log(`[render] ${printSpec.productType} page ${i}: captured ${probe.width}x${probe.height}, target ${pxW}x${pxH}`);
          const jpeg = await sharp(raw)
            .resize(pxW, pxH, { fit: 'fill' })
            .withMetadata({ density: DPI })
            .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
            .toBuffer();
          const fileName = i === 0 ? '00_cover.jpg' : `${String(i).padStart(2, '0')}_page.jpg`;
          const storagePath = `${orderPrefix}/print/${fileName}`;
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, jpeg, { cacheControl: '31536000', upsert: true, contentType: 'image/jpeg' });
          if (upErr) throw new Error(`upload ${storagePath}: ${upErr.message}`);
          uploaded.push(storagePath);
        } catch (pageErr: any) {
          // One bad page (e.g. a missing photo) must not abort the whole
          // calendar. Log it, record it, and carry on with the rest.
          console.error(`[render] page ${i} failed, skipping:`, pageErr?.message || pageErr);
          failed.push({ page: i, error: String(pageErr?.message || pageErr) });
        } finally {
          await page.close();
        await recycleBrowserIfNeeded();
        }
      }
      return res.json({ ok: true, projectId, pages: printSpec.pages.length, uploaded, failed });
    }

    // ── Book path (spreads) ─────────────────────────────────────────────────
    const sizeKey = resolveSizeKey(config).replace(/\s*см.*/i, '').trim();
    const dims = PRINT_DIMS_MM[sizeKey] || PRINT_DIMS_MM['A4'];
    const pages = project?.pages_data || [];
    const spreadCount = Math.ceil((pages.length - 1) / 2) + 1; // cover + content spreads

    // 2. Render each spread (0 = cover) at the exact print pixel size.
    for (let spread = 0; spread < spreadCount; spread++) {
      const isCover = spread === 0;
      const mm = isCover ? dims.cover : dims.spread;
      const pxW = mmToPx(mm.w);
      const pxH = mmToPx(mm.h);

      // The /print page sizes one spread to printPageW per HALF page. A spread is
      // two halves, so each half is pxW/2. The page reads ?w to fix that width.
      const halfW = Math.round(pxW / 2);

      const page = await b.newPage({
        viewport: { width: pxW + 40, height: pxH + 40 },
        deviceScaleFactor: 1,
      });
      try {
        const url = `${APP_BASE_URL}/uk/print/${projectId}?token=${encodeURIComponent(PRINT_RENDER_TOKEN)}&page=${spread}&w=${halfW}`;
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        // Wait for the spread element + all images decoded + fonts ready.
        await page.waitForSelector('[data-print-spread]', { timeout: 30000 });
        await page.evaluate(async () => {
          await (document as any).fonts?.ready;
          const imgs = Array.from(document.images);
          await Promise.all(imgs.map(img => img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise(r => { img.onload = r; img.onerror = r; })));
        });
        await page.waitForTimeout(300); // settle

        const el = await page.$('[data-print-spread]');
        if (!el) throw new Error(`no spread element for page ${spread}`);

        // JPEG (q100) instead of PNG: a 29-megapixel PNG buffer is the single
        // biggest allocation in the loop and pushed Chromium into the OOM
        // killer (GPU process exit_code=9). Visually lossless at q100.
        const raw = await el.screenshot({ type: 'jpeg', quality: 100, animations: 'disabled', caret: 'hide' });

        // Diagnostic: log the real captured size vs the target print size. If the
        // captured width is far below pxW, the screenshot was upscaled (=blurry).
        const probe = await sharp(raw).metadata();
        console.log(`[render] spread ${spread}: captured ${probe.width}x${probe.height}, target ${pxW}x${pxH}`);

        // ASPECT GUARD. fit:'fill' stretches whatever was captured onto the
        // target box, so a layout rendered at the wrong page size came out
        // silently distorted (captured 4963x2481 stretched to 4961x3602 —
        // people got taller). Only a scale is acceptable; a different aspect
        // means the /print page built the wrong geometry, and a loud failure
        // beats a stretched book.
        const capturedAspect = (probe.width || 1) / (probe.height || 1);
        const targetAspect = pxW / pxH;
        const aspectDrift = Math.abs(capturedAspect - targetAspect) / targetAspect;
        if (aspectDrift > 0.01) {
          throw new Error(
            `aspect mismatch on spread ${spread}: captured ${probe.width}x${probe.height} ` +
            `(${capturedAspect.toFixed(3)}) vs target ${pxW}x${pxH} (${targetAspect.toFixed(3)}). ` +
            `The /print page rendered the wrong page size — refusing to stretch.`
          );
        }

        // Normalise to the EXACT print pixel size + 300 DPI metadata, JPEG q92.
        const jpeg = await sharp(raw)
          .resize(pxW, pxH, { fit: 'fill' })
          .withMetadata({ density: DPI })
          .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
          .toBuffer();

        const fileName = isCover ? '00_cover.jpg' : `${String(spread).padStart(2, '0')}_spread.jpg`;
        const storagePath = `${orderPrefix}/print/${fileName}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, jpeg, { cacheControl: '31536000', upsert: true, contentType: 'image/jpeg' });
        if (upErr) throw new Error(`upload ${storagePath}: ${upErr.message}`);
        uploaded.push(storagePath);
      } finally {
        await page.close();
        await recycleBrowserIfNeeded();
      }
    }

    return res.json({ ok: true, projectId, spreads: spreadCount, uploaded });
  } catch (e: any) {
    console.error('[render] failed', e);
    return res.status(500).json({ error: e?.message || 'render failed' });
  }
});

app.listen(PORT, () => console.log(`[render-service] listening on ${PORT}`));
