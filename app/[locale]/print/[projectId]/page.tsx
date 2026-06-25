'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BookPreviewModal } from '@/components/BookPreviewModal';

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

  return (
    <div data-print-root style={{ background: '#fff', minHeight: '100vh' }}>
      <BookPreviewModal
        pages={pages}
        photos={photos}
        propW={pw}
        propH={ph}
        freeSlots={overlays.freeSlots || {}}
        coverState={coverState}
        isPrinted={!!config.isPrinted}
        selectedCoverType={config.selectedCoverType || ''}
        effectiveCoverColor={config.effectiveCoverColor || ''}
        onClose={() => { /* no-op: no chrome on the print page */ }}
        pageBgs={overlays.pageBgs || {}}
        pageFrames={overlays.pageFrames || {}}
        pageShapes={overlays.pageShapes || {}}
        pageStickers={overlays.pageStickers || {}}
        qrOverlays={overlays.qrOverlays || {}}
        slotGap={config.slotGap ?? 4}
        pageGap={config.pageGap ?? 0}
        pageBorder={config.pageBorder || { width: 0, color: '#e2e8f0' }}
        isSpreadMode={config.isSpreadMode ?? true}
        hasKalka={!!config.hasKalka}
      />
    </div>
  );
}
