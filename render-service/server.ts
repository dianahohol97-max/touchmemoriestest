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
// the app (components/BookLayoutEditor.tsx). Keep these two in sync.
const PRINT_DIMS_MM: Record<string, { spread: { w: number; h: number }; cover: { w: number; h: number } }> = {
  '20x20': { spread: { w: 405, h: 203 }, cover: { w: 457, h: 243 } },
  '25x25': { spread: { w: 500, h: 254 }, cover: { w: 566, h: 293 } },
  '20x30': { spread: { w: 420, h: 305 }, cover: { w: 470, h: 328 } },
  '30x20': { spread: { w: 610, h: 203 }, cover: { w: 646, h: 238 } },
  '30x30': { spread: { w: 610, h: 305 }, cover: { w: 646, h: 330 } },
  '23x23': { spread: { w: 460, h: 230 }, cover: { w: 506, h: 256 } },
};

const app = express();
app.use(express.json());

let browser: Browser | null = null;
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
    const { project } = await metaRes.json();
    const config = project?.overlays_data?.config || {};
    const sizeKey = String(config.selectedSize || '20x20').replace(/[×х]/g, 'x').replace(/\s*см.*/i, '').trim();
    const dims = PRINT_DIMS_MM[sizeKey] || PRINT_DIMS_MM['20x20'];

    const pages = project?.pages_data || [];
    const spreadCount = Math.ceil((pages.length - 1) / 2) + 1; // cover + content spreads

    // Derive the user/order path so we store next to the originals.
    const firstPath: string | undefined = project?.uploaded_photos?.find((p: any) => p?.path)?.path;
    // firstPath looks like {userId}/{orderId}/originals/{photoId}.jpg
    const orderPrefix = firstPath ? firstPath.split('/originals/')[0] : `unknown/${projectId}`;

    const b = await getBrowser();
    const uploaded: string[] = [];

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

        const raw = await el.screenshot({ type: 'png', animations: 'disabled', caret: 'hide', scale: 'css' });

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
      }
    }

    return res.json({ ok: true, projectId, spreads: spreadCount, uploaded });
  } catch (e: any) {
    console.error('[render] failed', e);
    return res.status(500).json({ error: e?.message || 'render failed' });
  }
});

app.listen(PORT, () => console.log(`[render-service] listening on ${PORT}`));
