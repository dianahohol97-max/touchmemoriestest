'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BookPreviewModal } from '@/components/BookPreviewModal';
import CalendarPrintPage from '@/components/CalendarPrintPage';

/**
 * /print/[projectId] — clean, controls-free render of a saved book design.
 *
 * This page exists for the print pipeline: the headless render service opens it,
 * waits for fonts + images, and screenshots each page at the exact print size.
 * It is NOT meant for humans — it shows only the finished pages on a plain
 * background, with no editor chrome.
 *
 * Auth: the project data comes from /api/print/[projectId], which requires the
 * PRINT_RENDER_TOKEN. The token is passed through as ?token=... on this page and
 * forwarded to the API, so a random visitor without the token sees nothing.
 *
 * This first version reuses BookPreviewModal to prove the data round-trips and
 * renders. Pixel-exact sizing, photo-URL restoration from storage, and per-page
 * screenshotting come in the next steps.
 */
export default function PrintPage() {
  const params = useParams();
  const search = useSearchParams();
  const projectId = String(params.projectId || '');
  const token = search.get('token') || '';

  const [project, setProject] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/print/${projectId}?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body?.error || `HTTP ${res.status}`);
          return;
        }
        const body = await res.json();
        if (!cancelled) setProject(body.project);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, token]);

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#64748b' }}>
        Print render unavailable: {error}
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#94a3b8' }}>
        Loading design…
      </div>
    );
  }

  // Unpack the saved design into the shape BookPreviewModal expects.
  const pages = project.pages_data || [];

  // ── Wall calendar branch ────────────────────────────────────────────────
  // Calendars are an HTML/SVG composition, not book spreads. Render one page
  // (cover or a month) per [data-print-page] using the saved config + signed
  // photo URLs, sized to the exact print pixels the render service requests.
  if (project.product_type === 'wall-calendar') {
    const cfg = Array.isArray(pages) ? pages[0] : pages;
    const calPhotos = (project.uploaded_photos || []).map((p: any) => ({
      id: p.id, preview: p.preview || '', width: p.width || 0, height: p.height || 0,
    }));
    const monthCount = Array.isArray(cfg?.pages) ? cfg.pages.length : 12;
    const totalPages = monthCount + 1; // cover + months
    const fmt = String(project.format || '').toLowerCase();
    const isA3 = fmt.includes('a3') || fmt.includes('29.7×42') || fmt.includes('29,7');
    const aspect = isA3 ? 297 / 420 : 210 / 297;

    const pageParam = search.get('page');
    const single = pageParam !== null ? parseInt(pageParam, 10) : null;
    const wParam = search.get('w');
    const printW = wParam ? parseInt(wParam, 10) : 1240;
    const printH = Math.round(printW / aspect);
    const toRender = single !== null ? [single] : Array.from({ length: totalPages }, (_, i) => i);

    return (
      <div style={{ background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: single !== null ? 0 : 24 }}>
        <style>{`[class*="cookie" i],[class*="newsletter" i],[class*="toast" i],[aria-label*="Notification" i]{display:none!important;}`}</style>
        {toRender.map((idx) => (
          <CalendarPrintPage key={idx} config={cfg} photos={calPhotos} W={printW} H={printH} pageIndex={idx} />
        ))}
      </div>
    );
  }

  const coverState = project.cover_data || {};
  const overlays = project.overlays_data || {};
  const config = overlays.config || {};
  const photos = (project.uploaded_photos || []).map((p: any) => ({
    id: p.id,
    preview: p.preview || '', // photo URLs are restored from storage in the next step
    width: p.width || 0,
    height: p.height || 0,
  }));

  // Derive the proportion (page aspect) the editor used, from the size in config.
  const sizeKey = String(config.selectedSize || '20x20').replace(/[×х]/g, 'x');
  const [pw, ph] = sizeKey.split('x').map((n: string) => parseInt(n, 10) || 20);

  // Spread count mirrors BookPreviewModal: cover (0) + content spreads.
  const spreadCount = Math.ceil((pages.length - 1) / 2) + 1;

  // ?page=N renders just that spread (what the render service requests per
  // screenshot). No page param → render every spread stacked, for human review.
  const pageParam = search.get('page');
  const singleSpread = pageParam !== null ? parseInt(pageParam, 10) : null;
  // ?w=N fixes the exact pixel width PER HALF PAGE — the render service passes
  // the 300-DPI print width so the screenshot comes out at print resolution.
  const wParam = search.get('w');
  const printPageW = wParam ? parseInt(wParam, 10) : undefined;
  const spreadsToRender = singleSpread !== null
    ? [singleSpread]
    : Array.from({ length: spreadCount }, (_, i) => i);

  // isPrinted may not be saved as a flag in older/newer configs — derive it from
  // the cover type ("Друкована" = printed cover) too, otherwise the printed-cover
  // photo renders down the wrong (velour/fabric) branch and the cover looks empty.
  const coverTypeStr = String(config.selectedCoverType || config.coverType || '');
  const isPrintedCover = !!config.isPrinted || /друков|printed/i.test(coverTypeStr);

  const common = {
    pages, photos, propW: pw, propH: ph,
    freeSlots: overlays.freeSlots || {},
    coverState,
    isPrinted: isPrintedCover,
    selectedCoverType: config.selectedCoverType || '',
    effectiveCoverColor: config.effectiveCoverColor || '',
    onClose: () => {},
    pageBgs: overlays.pageBgs || {},
    pageFrames: overlays.pageFrames || {},
    pageShapes: overlays.pageShapes || {},
    pageStickers: overlays.pageStickers || {},
    qrOverlays: overlays.qrOverlays || {},
    slotGap: config.slotGap ?? 4,
    pageGap: config.pageGap ?? 0,
    pageBorder: config.pageBorder || { width: 0, color: '#e2e8f0' },
    isSpreadMode: config.isSpreadMode ?? true,
    hasKalka: !!config.hasKalka,
  };

  return (
    <div data-print-root style={{ background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 24 }}>
      {/* The print surface must contain only the book. The cookie banner hides
          itself on /print (see CookieBanner). This also hides newsletter popups
          and toasts as a safety net so nothing floats into the screenshot. */}
      <style>{`
        [class*="newsletter" i], [class*="toast" i],
        [aria-label*="Notification" i] { display: none !important; }
      `}</style>
      {spreadsToRender.map((idx) => (
        <BookPreviewModal key={idx} {...common} printSpreadIndex={idx} printPageW={printPageW} />
      ))}
    </div>
  );
}
