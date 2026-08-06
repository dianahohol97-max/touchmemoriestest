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

/**
 * Report finished uploads back to the app. The app's render-order route awaits
 * this service, but a 40+ spread book renders longer than that route's
 * maxDuration — Vercel kills it mid-await and the finished files were never
 * indexed in order_files (TM-001113: 85 files in storage, zero rows). This
 * callback makes indexing independent of the awaiting function's lifetime;
 * registration on the app side is idempotent, so double delivery is safe.
 */
async function reportRenderComplete(projectId: string, uploaded: string[]): Promise<void> {
  if (!uploaded.length) return;
  try {
    const res = await fetch(`${APP_BASE_URL}/api/print/render-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-render-token': PRINT_RENDER_TOKEN },
      body: JSON.stringify({ projectId, uploaded, serviceCommit: SERVICE_COMMIT }),
    });
    console.log(`[render] completion callback: ${res.status} (${uploaded.length} files)`);
  } catch (e: any) {
    console.error('[render] completion callback failed:', e?.message || e);
  }
}
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
// Page size (mm) per dims key. Numeric keys ('20x30') are centimetres and are
// parsed directly; named keys need this table so bleed can be derived.
const PAGE_MM: Record<string, { w: number; h: number }> = {
  'A4': { w: 210, h: 297 },
  'magazine-A4': { w: 210, h: 297 },
};

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
// Above this surface, recycle after EVERY spread. A 20×30 travel book renders
// 4961×3602 = 17.9 MP per page; TM-001096 killed Chromium on page 2
// ('Target page, context or browser has been closed') and then took the whole
// service down with it (502 'Application failed to respond'). Five spreads
// between relaunches is too many at that size — the ~1 s relaunch is far
// cheaper than a dead container.
const HEAVY_SURFACE_PX = 12_000_000;
let spreadsOnCurrentBrowser = 0;

export async function recycleBrowserIfNeeded(surfacePx = 0): Promise<void> {
  spreadsOnCurrentBrowser++;
  const heavy = surfacePx >= HEAVY_SURFACE_PX;
  if (!heavy && spreadsOnCurrentBrowser < SPREADS_PER_BROWSER) return;
  spreadsOnCurrentBrowser = 0;
  if (browser) {
    try { await browser.close(); } catch { /* already gone */ }
    browser = null;
    console.log(`[render] browser recycled${heavy ? ` (heavy surface ${surfacePx} px)` : ''}`);
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

// Which build is actually running. A stale Railway deploy is invisible from
// the outside and cost most of a day of debugging (2026-08-05/06: форзац-skip,
// callback and folder fixes were merged but the service kept running old
// code). Railway injects its git metadata; expose it so «яка версія на
// Railway?» is one request, and the completion callback carries it too.
const SERVICE_COMMIT = process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown';
const SERVICE_STARTED = new Date().toISOString();
app.get('/health', (_req, res) => res.json({ ok: true, commit: SERVICE_COMMIT, started: SERVICE_STARTED }));

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
    const { project, printSpec, geometry } = await metaRes.json();
    const config = project?.overlays_data?.config || {};

    // Travel books and magazines are printed page-by-page (one file per physical
    // page) rather than as the 2-page spreads photobooks use. Detected the same
    // way resolveSizeKey picks the size — by product slug.
    const _slug = String(config?.productSlug || '').toLowerCase();
    const splitToPages =
      _slug.includes('travel') ||
      _slug.includes('magazine') ||
      _slug.includes('journal') ||
      _slug.includes('zhurnal') ||
      _slug.includes('fotozhurnal');

    // SOFT-cover magazines are printed fully page-by-page — the COVER too
    // (Diana, 2026-08-05): its front and back go to the workshop as separate
    // pages, not one wide sheet. Hard covers (travel books, тверда обкладинка
    // journals) stay a single sheet — their fold-in wraps a board and must
    // never be cut apart.
    const _productName = String(config?.productName || '').toLowerCase();
    const _coverType = String(config?.selectedCoverType || '').toLowerCase();
    const _isMagazineLike =
      _slug.includes('magazine') || _slug.includes('zhurnal') ||
      _slug.includes('fotozhurnal') || _slug.includes('journal') ||
      _productName.includes('журнал');
    const _isHardCover =
      _slug.includes('tverd') || _slug.includes('hard-cover') ||
      _productName.includes('твердою') || _coverType.includes('тверд');
    const splitCoverPages = splitToPages && _isMagazineLike && !_isHardCover;

    // ── Empty forzats stay out of the print files ─────────────────────────
    // Travel books / magazines carry 2 EXTRA physical pages for the forzats
    // (endpapers): content pages 1 and last. Printing on them is a paid
    // option; when the customer left them untouched, the workshop must not
    // receive blank page files for them («якщо форзаців немає — щоб взагалі
    // не вантажилися», Diana 2026-08-05). Detect the forzats-extra shape the
    // same way the editor does (content == ordered + 2), check the pages are
    // genuinely empty (no slots, texts or overlays), and renumber the
    // remaining pages so the workshop still gets a continuous 01..NN set.
    const pagesData: any[] = Array.isArray(project?.pages_data) ? project.pages_data : [];
    const overlaysData = project?.overlays_data || {};
    const contentPageCount = Math.max(0, pagesData.length - 1);
    const orderedPages = parseInt(String(config?.selectedPageCount || '').match(/\d+/)?.[0] || '0', 10) || 0;
    const hasForzatExtra = splitToPages && orderedPages > 0 && contentPageCount >= orderedPages + 2;
    const pageHasContent = (idx: number) => {
      const p = pagesData[idx];
      if (!p) return false;
      if ((p.slots || []).some((s: any) => s?.photoId)) return true;
      if ((p.textBlocks || []).length > 0) return true;
      if (((overlaysData.freeSlots || {})[idx] || []).length > 0) return true;
      if (((overlaysData.pageStickers || {})[idx] || []).length > 0) return true;
      if (((overlaysData.pageShapes || {})[idx] || []).length > 0) return true;
      if (((overlaysData.qrOverlays || {})[idx] || []).length > 0) return true;
      if ((overlaysData.pageBgs || {})[idx]) return true;
      return false;
    };
    const skipPageNos = new Set<number>();
    if (hasForzatExtra) {
      for (const idx of [1, contentPageCount]) {
        if (!pageHasContent(idx)) skipPageNos.add(idx);
      }
      if (skipPageNos.size > 0) {
        console.log(`[render] empty forzat pages excluded from export: ${Array.from(skipPageNos).join(', ')}`);
      }
    }
    const renumberPage = (pageNo: number) => {
      let shift = 0;
      for (const s of skipPageNos) if (s < pageNo) shift++;
      return pageNo - shift;
    };

    // Derive the user/order path so we store next to the originals. Books store
    // under .../originals/...; calendars store originals in order-files under
    // {user}/{cartItemId}/... — handle both so output lands in a sane folder.
    const firstPath: string | undefined = project?.uploaded_photos?.find((p: any) => p?.path)?.path;
    let orderPrefix: string;
    if (firstPath && firstPath.includes('/originals/')) {
      // guest/pb-<ts>-<rand>/originals/… — already unique per cart item.
      orderPrefix = firstPath.split('/originals/')[0];
    } else if (firstPath) {
      // drafts/<uid>/<draftId>/photo.jpg — the draft tree has no /originals/
      // segment. Taking just drafts/<uid> collapsed EVERY order of that user
      // into ONE shared print folder: regenerating TM-001124 physically
      // overwrote the 00_cover.jpg that TM-001123's order_files rows point
      // at («обкладинка продублювалася»). Scope by project id so no two
      // orders can ever share print files.
      orderPrefix = `${firstPath.split('/').slice(0, 2).join('/')}/${projectId}`;
    } else {
      orderPrefix = `unknown/${projectId}`;
    }

    await getBrowser(); // warm up; each page fetches a fresh handle (recycling)
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
        const page = await (await getBrowser()).newPage({
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
          await page.close().catch(() => { /* the browser may already be gone */ });
          await recycleBrowserIfNeeded(pxW * pxH);
        }
      }
      await reportRenderComplete(projectId, uploaded);
      return res.json({ ok: true, projectId, pages: printSpec.pages.length, uploaded, failed });
    }

    // ── Book path (spreads) ─────────────────────────────────────────────────
    const sizeKey = resolveSizeKey(config).replace(/\s*см.*/i, '').trim();
    // Sheet size comes from the app, derived from photobook_sizes, so the
    // editor, /print and this service all read ONE table. PRINT_DIMS_MM below
    // stays as a fallback for an app deploy that predates `geometry` — it is a
    // hand-copy of the printer's spec and has drifted from the DB before.
    const sheetDims = geometry?.sheet?.w > 0 && geometry?.cover?.w > 0
      ? { spread: { ...geometry.sheet }, cover: { ...geometry.cover } }
      : (PRINT_DIMS_MM[sizeKey] || PRINT_DIMS_MM['A4']);
    if (!geometry) {
      console.warn(`[render] app sent no geometry for '${sizeKey}' — falling back to the local table`);
    }

    // NO BLEED on inner spreads and pages. The sheet size (420×305 for a 20×30)
    // is bigger than the finished spread (400×300), and the difference was
    // filled with pixels this service invented — first a shifted copy of the
    // whole spread, then a mirrored edge. Neither is the customer's design, and
    // both reached print. The file is now exactly the finished size: what the
    // customer laid out, nothing added.
    //
    // The COVER keeps its sheet size. Its extra 35 mm per side is not bleed —
    // it is the fold-in that physically wraps the board, so cutting it would
    // ruin the binding. It is still padded here, which is wrong in its own way
    // (TM-001101's wrap carries a squashed second copy of the artwork); the
    // real fix is rendering the cover natively at 470×328 so the artwork itself
    // reaches into the fold. Until then it is loud, not silent.
    const dims = {
      spread: geometry?.finished?.w > 0
        ? { ...geometry.finished }
        : sheetDims.spread,
      cover: sheetDims.cover,
    };
    if (!(geometry?.finished?.w > 0)) {
      console.warn(`[render] no finished size for '${sizeKey}' — spreads keep the sheet size and WILL be padded`);
    }
    const pages = project?.pages_data || [];
    const spreadCount = Math.ceil((pages.length - 1) / 2) + 1; // cover + content spreads

    // Soft-material covers (велюр / тканина / шкірзамінник) DO get a cover
    // file, per production requirements: a clean layout at the physical cover
    // sheet size (300 DPI, fold-in included) that encodes the exact material
    // colour, the decoration footprint (plate / insert) and the inscription
    // in the chosen font at the chosen position — same contract as the
    // wishbook cover generator (lib/print/wishbook-cover.tsx). The preview
    // artifacts that used to pollute this file (spine gradient bands, «ЗАДНЯ»
    // label) are stripped by BookPreviewModal's print mode.

    // 2. Render each spread (0 = cover) at the exact print pixel size.
    for (let spread = 0; spread < spreadCount; spread++) {
      const isCover = spread === 0;
      const mm = isCover ? dims.cover : dims.spread;
      const pxW = mmToPx(mm.w);
      const pxH = mmToPx(mm.h);

      // The /print page sizes one spread to printPageW per HALF page. A spread is
      // two halves, so each half is pxW/2. The page reads ?w to fix that width.
      const halfW = Math.round(pxW / 2);

      // Fetch the browser per spread: recycleBrowserIfNeeded() may have closed
      // the one captured before the loop, and a stale handle throws
      // 'Target page, context or browser has been closed'.
      const page = await (await getBrowser()).newPage({
        viewport: { width: pxW + 40, height: pxH + 40 },
        deviceScaleFactor: 1,
      });
      try {
        const url = `${APP_BASE_URL}/uk/print/${projectId}?token=${encodeURIComponent(PRINT_RENDER_TOKEN)}&page=${spread}&w=${halfW}`;
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        // Wait for the spread element + all images decoded + fonts ready.
        await page.waitForSelector('[data-print-spread]', { timeout: 30000 });
        const imgReport = await page.evaluate(async () => {
          await (document as any).fonts?.ready;
          const imgs = Array.from(document.images);
          // Wait for every photo to LOAD (bounded so one dead signed URL can't
          // hang the render forever), then force a full DECODE. A screenshot
          // taken while a large JPEG is still streaming sees a wrong intrinsic
          // size — objectFit:cover then lays the photo out distorted with a
          // blank band (the «видовжене фото» on TM-001113's page files).
          await Promise.all(imgs.map(img => (img.complete && img.naturalWidth > 0)
            ? Promise.resolve()
            : new Promise(r => {
                const done = () => r(null);
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
                if (img.complete) done(); // failed before we attached — don't hang
                setTimeout(done, 45000);
              })));
          await Promise.all(imgs.map(img => (img as any).decode ? (img as any).decode().catch(() => {}) : Promise.resolve()));
          const broken = imgs.filter(img => !(img.complete && img.naturalWidth > 0)).length;
          return { total: imgs.length, broken };
        });
        if (imgReport.broken > 0) {
          console.warn(`[render] spread ${spread}: ${imgReport.broken}/${imgReport.total} photos failed to load — the file may have blank slots`);
        }
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

        // ── BLEED, not stretch ────────────────────────────────────────────
        // The /print page draws the bare spread (two pages side by side), while
        // the print target is bigger: content + bleed, and for the cover also
        // the spine/wrap. fit:'fill' used to pull the capture onto that target,
        // so a 20x30 book was stretched 3.3% vertically and people got taller
        // ('captured 5563x4164 vs target 5551x3874').
        //
        // Correct behaviour: the capture is the CONTENT area. Scale it to the
        // content pixels (aspect preserved), then grow the edges outward by
        // replicating the border pixels — exactly what the client-side
        // extendBleed() does, and what a printer expects to trim away.
        const named = PAGE_MM[sizeKey];
        const sizeParts = sizeKey.split(/[x×]/).map((n) => parseFloat(n));
        // Same source as the sheet above: the app's derived geometry first, the
        // local parse only as a fallback. Deriving the finished page here and
        // the sheet there from two different tables is exactly how the two
        // drifted apart.
        const pageMm = (geometry?.page?.w > 0 && geometry?.page?.h > 0 ? { ...geometry.page } : null)
          || named
          || (sizeParts.length === 2 && sizeParts.every((n) => n > 0)
            ? { w: sizeParts[0] * 10, h: sizeParts[1] * 10 }   // '20x30' = centimetres
            : null);
        if (!pageMm) {
          throw new Error(`cannot derive page size from '${sizeKey}' — refusing to guess bleed`);
        }
        // The COVER is one sheet with its own proportion (470×328 for a 20×30),
        // NOT two pages side by side: the extra area is fold-in that wraps the
        // board, and the customer designs on that whole sheet. Treating it as
        // 2×page is what made this service shrink a 470×328 cover to 400×300
        // and then fill the fold with pixels it invented — TM-001101's wrap
        // carries a squashed second copy of the artwork. /print now lays the
        // cover out at its own size, so the capture already IS the target and
        // nothing is added.
        const contentMmW = isCover ? mm.w : 2 * pageMm.w;   // spread = two pages wide
        const contentMmH = isCover ? mm.h : pageMm.h;
        const contentPxW = mmToPx(contentMmW);
        const contentPxH = mmToPx(contentMmH);

        // The capture must match the CONTENT aspect (not the bleed target).
        const capturedAspect = (probe.width || 1) / (probe.height || 1);
        const contentAspect = contentPxW / contentPxH;
        const aspectDrift = Math.abs(capturedAspect - contentAspect) / contentAspect;
        if (aspectDrift > 0.01) {
          throw new Error(
            `aspect mismatch on spread ${spread}: captured ${probe.width}x${probe.height} ` +
            `(${capturedAspect.toFixed(3)}) vs page content ${contentPxW}x${contentPxH} ` +
            `(${contentAspect.toFixed(3)}). The /print page rendered the wrong page size.`
          );
        }

        const dx = pxW - contentPxW;
        const dy = pxH - contentPxH;
        if (dx < 0 || dy < 0) {
          throw new Error(`print target ${pxW}x${pxH} smaller than content ${contentPxW}x${contentPxH}`);
        }
        if (dx > 0 || dy > 0) {
          // Inner spreads must land here with dx = dy = 0. Anything else means
          // pixels are being invented, so name it in the log rather than let it
          // pass as a normal render.
          console.warn(
            `[render] ${isCover ? 'cover' : `spread ${spread}`}: padding ${dx}x${dy} px of SYNTHESIZED edge `
            + `(${(dx / 2 / 300 * 25.4).toFixed(1)}x${(dy / 2 / 300 * 25.4).toFixed(1)} mm per side) — `
            + (isCover ? 'fold-in, pending a sheet-native cover render' : 'THIS SHOULD BE ZERO'),
          );
        }

        const scaled = await sharp(raw)
          .resize(contentPxW, contentPxH, { fit: 'fill' })  // aspect already matches within 1%
          .png({ compressionLevel: 1 })                     // lossless intermediate — see bleedFill
          .toBuffer();

        const bx = Math.floor(dx / 2);   // per-side horizontal bleed
        const by = Math.floor(dy / 2);   // per-side vertical bleed

        // Mirrored bleed. Everything inside the trim line is pixel-for-pixel the
        // customer's layout (no zoom of the visible area); the bleed outside it
        // is each edge band mirrored outward — the same construction as the
        // client-side extendBleed(), and the standard fallback when the artwork
        // carries no bleed of its own. A mirrored band continues the image
        // across the cut by definition: the pixel just outside the trim is the
        // pixel just inside it.
        //
        // It used to scale the WHOLE spread up to the bleed size and paste the
        // exact content on top. That is seamless only for a single full-bleed
        // photo. On a collage the filler underneath is offset by the bleed width
        // (~10 mm at 20×30), so the strip outside the trim showed a DIFFERENT
        // photo than the one it borders, with a hard seam along the trim line —
        // that is the "незрозуміло обрізане" on TM-001094's 17_spread.jpg.
        const bleedFill = async (
          content: Buffer, cw: number, ch: number,
          left: number, right: number, top: number, bottom: number,
        ): Promise<Buffer> => {
          const l = Math.max(0, left), r = Math.max(0, right), t = Math.max(0, top), b = Math.max(0, bottom);
          const outW = cw + l + r;
          const outH = ch + t + b;
          if (outW === cw && outH === ch) return content;

          const band = async (x: number, y: number, w: number, h: number, flopIt: boolean, flipIt: boolean) => {
            let p = sharp(content).extract({ left: x, top: y, width: w, height: h });
            if (flopIt) p = p.flop();   // mirror horizontally
            if (flipIt) p = p.flip();   // mirror vertically
            return await p.png({ compressionLevel: 1 }).toBuffer();
          };

          // Bands are clamped to the content, so a bleed wider than the artwork
          // can never over-extract (sharp throws on an out-of-bounds region).
          const lw = Math.min(l, cw), rw = Math.min(r, cw);
          const th = Math.min(t, ch), bh = Math.min(b, ch);

          const layers: { input: Buffer; left: number; top: number }[] = [
            { input: await sharp(content).png({ compressionLevel: 1 }).toBuffer(), left: l, top: t },
          ];
          if (lw > 0) layers.push({ input: await band(0, 0, lw, ch, true, false), left: l - lw, top: t });
          if (rw > 0) layers.push({ input: await band(cw - rw, 0, rw, ch, true, false), left: l + cw, top: t });
          if (th > 0) layers.push({ input: await band(0, 0, cw, th, false, true), left: l, top: t - th });
          if (bh > 0) layers.push({ input: await band(0, ch - bh, cw, bh, false, true), left: l, top: t + ch });
          // Corners — mirrored on both axes.
          if (lw > 0 && th > 0) layers.push({ input: await band(0, 0, lw, th, true, true), left: l - lw, top: t - th });
          if (rw > 0 && th > 0) layers.push({ input: await band(cw - rw, 0, rw, th, true, true), left: l + cw, top: t - th });
          if (lw > 0 && bh > 0) layers.push({ input: await band(0, ch - bh, lw, bh, true, true), left: l - lw, top: t + ch });
          if (rw > 0 && bh > 0) layers.push({ input: await band(cw - rw, ch - bh, rw, bh, true, true), left: l + cw, top: t + ch });

          return await sharp({
            create: { width: outW, height: outH, channels: 3, background: '#ffffff' },
          })
            .composite(layers)
            // Keep the intermediate lossless. sharp's default toBuffer() on a
            // JPEG input re-encodes at q80 / 4:2:0, so every spread carried a
            // hidden extra generation of loss before the final q92 encode.
            .png({ compressionLevel: 1 })
            .toBuffer();
        };

        if (isCover && splitCoverPages) {
          // Soft-cover magazine: the cover sheet is cut down the middle and
          // each half is bled on all four sides — the workshop receives the
          // back and front covers as two standalone 300-DPI pages.
          const halfW = Math.floor(contentPxW / 2);
          const parts = [
            { left: 0, width: halfW, name: '00_cover_back.jpg' },
            { left: halfW, width: contentPxW - halfW, name: '00_cover_front.jpg' },
          ];
          for (const h of parts) {
            const half = await sharp(scaled)
              .extract({ left: h.left, top: 0, width: h.width, height: contentPxH })
              .png({ compressionLevel: 1 })
              .toBuffer();
            const filled = await bleedFill(half, h.width, contentPxH, bx, bx, by, by);
            const coverJpeg = await sharp(filled)
              .withMetadata({ density: DPI })
              .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
              .toBuffer();
            const storagePath = `${orderPrefix}/print/${h.name}`;
            const { error: upErr } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(storagePath, coverJpeg, { cacheControl: '31536000', upsert: true, contentType: 'image/jpeg' });
            if (upErr) throw new Error(`upload ${storagePath}: ${upErr.message}`);
            uploaded.push(storagePath);
          }
          console.log('[render] cover: split into back/front pages (soft-cover magazine)');
        } else if (splitToPages && !isCover) {
          // Travel books / magazines: cut the clean 2-page content down the
          // gutter and bleed each half on all four sides, so the workshop gets
          // one 300-DPI file per physical page instead of a 2-page spread.
          const halfW = Math.floor(contentPxW / 2);
          const leftPageNo = (spread - 1) * 2 + 1;   // spread 1 → pages 1,2; spread 2 → 3,4; …
          const halves = [
            { left: 0, width: halfW, pageNo: leftPageNo },
            { left: halfW, width: contentPxW - halfW, pageNo: leftPageNo + 1 },
          ];
          for (const h of halves) {
            if (skipPageNos.has(h.pageNo)) {
              console.log(`[render] page ${h.pageNo}: empty forzat — not exported`);
              continue;
            }
            const half = await sharp(scaled)
              .extract({ left: h.left, top: 0, width: h.width, height: contentPxH })
              .png({ compressionLevel: 1 })
              .toBuffer();
            const filled = await bleedFill(half, h.width, contentPxH, bx, bx, by, by);
            const pageJpeg = await sharp(filled)
              .withMetadata({ density: DPI })
              .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
              .toBuffer();
            const storagePath = `${orderPrefix}/print/${String(renumberPage(h.pageNo)).padStart(2, '0')}_page.jpg`;
            const { error: upErr } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(storagePath, pageJpeg, { cacheControl: '31536000', upsert: true, contentType: 'image/jpeg' });
            if (upErr) throw new Error(`upload ${storagePath}: ${upErr.message}`);
            uploaded.push(storagePath);
          }
          console.log(`[render] spread ${spread}: split into pages ${leftPageNo},${leftPageNo + 1}`);
        } else {
          const filled = await bleedFill(scaled, contentPxW, contentPxH, bx, dx - bx, by, dy - by);
          const jpeg = await sharp(filled)
            .withMetadata({ density: DPI })
            .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
            .toBuffer();

          console.log(`[render] spread ${spread}: content ${contentPxW}x${contentPxH} + bleed → ${pxW}x${pxH}`);

          const fileName = isCover ? '00_cover.jpg' : `${String(spread).padStart(2, '0')}_spread.jpg`;
          const storagePath = `${orderPrefix}/print/${fileName}`;
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, jpeg, { cacheControl: '31536000', upsert: true, contentType: 'image/jpeg' });
          if (upErr) throw new Error(`upload ${storagePath}: ${upErr.message}`);
          uploaded.push(storagePath);
        }
      } finally {
        await page.close().catch(() => { /* the browser may already be gone */ });
        await recycleBrowserIfNeeded(pxW * pxH);
      }
    }

    await reportRenderComplete(projectId, uploaded);
    return res.json({ ok: true, projectId, spreads: spreadCount, uploaded });
  } catch (e: any) {
    console.error('[render] failed', e);
    return res.status(500).json({ error: e?.message || 'render failed' });
  }
});

app.listen(PORT, () => console.log(`[render-service] listening on ${PORT}`));
