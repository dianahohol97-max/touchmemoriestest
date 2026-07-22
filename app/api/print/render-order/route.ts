import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
// The Railway render of every spread can take 1–2 min for a large book; give the
// route room so a fire-and-forget trigger actually completes and registers files.
export const maxDuration = 300;

/**
 * Trigger the print render for a paid order.
 *
 * Called fire-and-forget from the Monobank webhook on the first transition to
 * paid (and reusable from an admin "re-render" button). It finds the saved
 * constructor project for this order, then asks the Railway render service to
 * screenshot every spread at 300 DPI and upload the JPEGs to Supabase storage.
 *
 * Guarded by CRON_SECRET like the other internal on-payment routes. Always
 * returns 200-ish JSON describing what happened; the caller ignores the body
 * and never lets a render problem break payment confirmation.
 */
export async function POST(request: NextRequest) {
  // Internal auth — same secret the webhook uses for fiscalize / email.
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== (process.env.CRON_SECRET || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orderId } = await request.json().catch(() => ({ orderId: undefined }));
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const renderUrl = process.env.RENDER_SERVICE_URL;       // https://...up.railway.app
  const renderToken = process.env.RENDER_SERVICE_TOKEN;   // shared secret with the service
  if (!renderUrl || !renderToken) {
    // Not configured yet — treat as a no-op so payment flow is unaffected.
    console.warn('[render-order] RENDER_SERVICE_URL/TOKEN not set, skipping render', { orderId });
    return NextResponse.json({ ok: false, skipped: 'service-not-configured' });
  }

  const admin = getAdminClient();

  // Find the design saved for this order. saveDesignToProjects writes order_id
  // onto the project at checkout. If a single order ever has multiple book
  // items, there can be multiple projects — render them all.
  const { data: projects, error } = await admin
    .from('projects')
    .select('id, name, product_type')
    .eq('order_id', orderId);

  if (error) {
    console.error('[render-order] project lookup failed', { orderId, error: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!projects || projects.length === 0) {
    // No constructor project for this order (e.g. a non-book product, or an
    // order placed before order_id linking shipped). Nothing to render.
    return NextResponse.json({ ok: true, rendered: 0, note: 'no project for order' });
  }

  const results: Array<{ projectId: string; ok: boolean; detail?: unknown }> = [];
  const allUploaded: string[] = []; // every path the render produced, across projects
  for (const project of projects) {
    try {
      const res = await fetch(`${renderUrl.replace(/\/$/, '')}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-render-token': renderToken,
        },
        body: JSON.stringify({ projectId: project.id }),
      });
      const detail = await res.json().catch(() => ({}));
      results.push({ projectId: project.id, ok: res.ok, detail });
      if (!res.ok) {
        console.error('[render-order] render failed', { orderId, projectId: project.id, status: res.status, detail });
        continue;
      }

      // Register the rendered JPEGs in order_files so the admin panel and the
      // designer cabinet show THESE 300-DPI layouts (file_type 'export') instead
      // of the old html2canvas snapshots. The render service uploads to the
      // photobook-uploads bucket; we record that bucket + path here (variant A:
      // keep the files where the service put them, just index them in the DB).
      const uploaded: string[] = Array.isArray(detail?.uploaded) ? detail.uploaded : [];
      if (uploaded.length) {
        allUploaded.push(...uploaded);

        const rows = uploaded.map((path) => {
          const fileName = path.split('/').pop() || path;
          const isCover = /(^|\/)00_cover\.jpg$/i.test(path) || /cover/i.test(fileName);
          // Travel books / magazines export one file per page (NN_page.jpg);
          // photobooks export 2-page spreads (NN_spread.jpg).
          const isPage = /_page\.jpg$/i.test(fileName);
          // 00_cover -> page 1, 01_spread -> page 2, ... (cover first).
          const m = fileName.match(/^(\d+)_/);
          const pageNumber = m ? parseInt(m[1], 10) + 1 : null;
          return {
            order_id: orderId,
            file_path: path,
            file_name: fileName,
            file_type: 'export',
            file_category: isCover ? 'book-cover' : isPage ? 'book-page' : 'book-spread',
            product_type: project.product_type || 'photobook',
            bucket_name: 'photobook-uploads',
            mime_type: 'image/jpeg',
            page_number: pageNumber,
          };
        });

        const { error: ofErr } = await admin.from('order_files').insert(rows);
        if (ofErr) {
          console.error('[render-order] order_files insert failed', { orderId, projectId: project.id, error: ofErr.message });
          // The render itself succeeded; surface the indexing problem but don't
          // fail the whole call — files exist in storage and can be re-indexed.
          results[results.length - 1] = { projectId: project.id, ok: true, detail: { ...detail, orderFilesError: ofErr.message } };
        }
      }
    } catch (e: any) {
      console.error('[render-order] render request threw', { orderId, projectId: project.id, error: e?.message });
      results.push({ projectId: project.id, ok: false, detail: e?.message });
    }
  }

  // Replace mode: once the fresh render exists, remove EVERY older export file
  // for this order that isn't part of the new set — both the client html2canvas
  // drafts (pb-…) and any previous Railway render — from storage AND the DB, so
  // the admin shows only the new spreads and no orphans pile up in storage.
  // Guarded by allUploaded.length so a failed render never deletes the old files.
  if (allUploaded.length) {
    const newSet = new Set(allUploaded);
    const { data: oldFiles } = await admin
      .from('order_files')
      .select('id, file_path, bucket_name')
      .eq('order_id', orderId)
      .eq('file_type', 'export');
    const stale = (oldFiles || []).filter((f: any) => !newSet.has(f.file_path));
    if (stale.length) {
      const byBucket = new Map<string, string[]>();
      for (const f of stale) {
        const b = f.bucket_name || 'photobook-uploads';
        if (!byBucket.has(b)) byBucket.set(b, []);
        byBucket.get(b)!.push(f.file_path);
      }
      for (const [bucket, paths] of byBucket) {
        try { await admin.storage.from(bucket).remove(paths); }
        catch (e: any) { console.error('[render-order] storage cleanup failed', { orderId, bucket, error: e?.message }); }
      }
      await admin.from('order_files').delete().in('id', stale.map((f: any) => f.id));
    }
  }

  const okCount = results.filter(r => r.ok).length;
  return NextResponse.json({ ok: okCount === results.length, rendered: okCount, total: results.length, results });
}
