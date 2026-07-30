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

// ── Universal print-artifact audit ──────────────────────────────────────────
// Runs for EVERY paid order (this route fires on the first paid transition and
// from the render-paid-orders backstop cron). For each order item it knows the
// class of print artifact production needs, and flags the order the moment a
// paid item has none — so a lost design/export surfaces in the admin within
// seconds of payment instead of at the print shop. This is deliberately
// server-side and constructor-agnostic: it does not trust any client-side
// save/upload code, so a bug in ANY current or future constructor is caught
// here as long as its product name matches a class below. Unknown products are
// not flagged (no false alarms), known ones fail LOUD.
const MARKER = 'бракує файлів для друку';
const LEGACY_MARKER = 'дизайн не збережено';
const RX = {
  // no customer artwork needed at all
  exclude: /сертифікат|certificate|gift.?card/i,
  // books & calendars — rendered by Railway from a saved projects row
  book: /photobook|fotoknig|фотокниг|travel|тревел|magazine|журнал|zhurnal|journal|planner|планер|wish|побажан|альбом|книг|календар|calendar|kalendar/i,
  // client-composed single-file products — their print file is an export row
  self: /постер|poster|мапа|map\b|зорян|star.?map|монограм|monogram|зодіак|zodiac|портрет|portrait|cartoon|мультяш|pixar|піксар/i,
  // photo sets — customer photos as uploads (files may live only in storage)
  photoset: /фотодрук|фото.?друк|photo.?print|полароїд|polaroid|магніт|magnet|пазл|puzzle/i,
};

async function auditPrintArtifacts(admin: ReturnType<typeof getAdminClient>, orderId: string) {
  try {
    const { data: ord } = await admin
      .from('orders')
      .select('items, notes, customer_id')
      .eq('id', orderId)
      .maybeSingle();
    const items = Array.isArray((ord as any)?.items) ? (ord as any).items : [];
    if (!items.length) return;
    const notes: string = (ord as any)?.notes || '';
    if (notes.includes(MARKER) || notes.includes(LEGACY_MARKER)) return; // already flagged

    const [{ data: files }, { count: projCount }] = await Promise.all([
      admin.from('order_files').select('file_type, product_type, file_category').eq('order_id', orderId),
      admin.from('projects').select('id', { count: 'exact', head: true }).eq('order_id', orderId),
    ]);
    const rows = files || [];
    const hasProject = (projCount ?? 0) > 0;
    const isBookFile = (f: any) =>
      RX.book.test(String(f.product_type || '')) || /^book-/.test(String(f.file_category || ''));
    // legacy rows without product_type count for everyone (lenient — no false alarms)
    const hasBookExport = rows.some(f => f.file_type === 'export' && (!f.product_type || isBookFile(f)));
    const hasOtherExport = rows.some(f => f.file_type === 'export' && (!f.product_type || !isBookFile(f)));
    const hasAnyRow = rows.length > 0;

    // Photo sets sometimes live ONLY in storage (order-files/{customer}/{item}/…)
    // with no order_files rows at all — scan before declaring them missing.
    let hasStorageFiles = false;
    const needsStorageScan = !hasAnyRow && items.some((it: any) =>
      RX.photoset.test(`${it?.slug || ''} ${it?.name || it?.product_name || ''}`));
    if (needsStorageScan && (ord as any)?.customer_id) {
      try {
        const folder = String((ord as any).customer_id);
        const { data: subdirs } = await admin.storage.from('order-files').list(folder, { limit: 100 });
        for (const d of (subdirs || []) as any[]) {
          if (!d?.name || d.id) continue; // folders have id === null
          const { data: entries } = await admin.storage.from('order-files').list(`${folder}/${d.name}`, { limit: 1 });
          if (((entries || []) as any[]).some(f => f?.id)) { hasStorageFiles = true; break; }
        }
      } catch { /* scan unavailable — stay lenient below */ }
    }

    const missing: string[] = [];
    for (const it of items) {
      const label = `${it?.slug || ''} ${it?.name || it?.product_name || ''}`.trim();
      if (!label || RX.exclude.test(label)) continue;
      if (RX.book.test(label)) {
        if (!hasProject && !hasBookExport) missing.push(label);
      } else if (RX.self.test(label)) {
        if (!hasOtherExport) missing.push(label);
      } else if (RX.photoset.test(label)) {
        if (!hasAnyRow && !hasStorageFiles) missing.push(label);
      }
      // unknown product classes: no requirement, no false alarm
    }
    if (!missing.length) return;

    const warn =
      `⚠️ УВАГА: ${MARKER} — оплачене замовлення, але для позицій нема макета/файлів: ` +
      `${missing.join('; ')}. НЕ ВІДПРАВЛЯТИ В ДРУК — перевірте файли і звʼяжіться з клієнтом. ` +
      `(автоперевірка при оплаті)`;
    await admin.from('orders')
      .update({ notes: notes.trim() ? `${warn}\n\n${notes.trim()}` : warn })
      .eq('id', orderId);
    console.warn('[render-order] flagged missing print artifacts', { orderId, missing });
  } catch (e) {
    console.error('[render-order] artifact audit failed', { orderId, e });
  }
}
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
    // No constructor project — audit whether that's legitimate (e.g. a poster
    // whose print file is an export row) or a real loss, and flag if so.
    await auditPrintArtifacts(admin, orderId);
    return NextResponse.json({ ok: true, rendered: 0, note: 'no project for order' });
  }

  // ALLOWLIST, on purpose. Only the book and calendar constructors have a
  // Railway render path (spreads / printSpec). Everything else — poster,
  // photo-print, photo-magnets, star map, and any FUTURE self-composed product
  // — builds its OWN print file client-side and uploads it as an export at
  // order time. Sending one of those to Railway screenshots the book /print
  // page with empty slots → a BLANK 00_cover.jpg, which "replace mode" below
  // then treats as the new export and DELETES the real client composite.
  //
  // A denylist would silently wreck the next new self-composed product the day
  // it ships. An allowlist fails SAFE instead: an unrecognised product_type is
  // skipped, and if it were actually a new BOOK type the design-loss safety net
  // above flags the order as "no print files" rather than replacing a good file
  // with a blank one.
  const RAILWAY_RENDERABLE = /photobook|fotoknig|travel|magazine|zhurnal|fotozhurnal|journal|planner|wish|calendar|kalendar/i;

  const results: Array<{ projectId: string; ok: boolean; detail?: unknown }> = [];
  const allUploaded: string[] = []; // every path the render produced, across projects
  for (const project of projects) {
    if (!RAILWAY_RENDERABLE.test(String(project.product_type || ''))) {
      console.log('[render-order] skipping non-renderable (self-composed) product', { orderId, projectId: project.id, product_type: project.product_type });
      results.push({ projectId: project.id, ok: true, detail: `skipped: not railway-renderable (${project.product_type})` });
      continue;
    }
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
      .select('id, file_path, bucket_name, product_type, file_category')
      .eq('order_id', orderId)
      .eq('file_type', 'export');
    // Only prune stale exports of RENDERABLE (book/calendar) products. A
    // self-composed export (poster/map/magnet) in a mixed order — or any export
    // whose product_type we don't recognise — is left untouched, so a book
    // render that triggered replace-mode can never wipe a poster's own file.
    const stale = (oldFiles || []).filter((f: any) =>
      !newSet.has(f.file_path) &&
      RAILWAY_RENDERABLE.test(String(f.product_type || '')),
    );
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

  // Even with projects present, individual items can still lack artifacts
  // (failed render, mixed order where the poster's export vanished, …) —
  // audit after rendering so freshly produced files count.
  await auditPrintArtifacts(admin, orderId);

  const okCount = results.filter(r => r.ok).length;
  return NextResponse.json({ ok: okCount === results.length, rendered: okCount, total: results.length, results });
}
