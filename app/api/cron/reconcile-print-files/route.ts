import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { registerExportFiles } from '@/lib/print/register-export-files';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/cron/reconcile-print-files
 *
 * Self-healing for the print-file index. Rendered files live in storage; the
 * order_files rows that make them visible in the admin are written by whoever
 * survives long enough to do it — render-order's await (dies on big books),
 * the service's completion callback (needs a current Railway build). This day
 * alone produced two orders (TM-001113 twice) whose full render sat in
 * storage while the admin said «немає макета».
 *
 * This cron closes the loop deterministically: for every recent order with a
 * linked project, derive the project's print folder the SAME way the render
 * service does, list it, and register anything order_files doesn't know about.
 * Registration is idempotent, so overlap with the other two paths is harmless.
 *
 * Folder derivation mirrors render-service/server.ts:
 *   - originals-based projects → guest/pb-…/print (unique per cart item)
 *   - drafts-based projects → drafts/<uid>/<projectId>/print (unique)
 *   - the LEGACY shared drafts/<uid>/print folder is skipped on purpose: it
 *     can hold a DIFFERENT order's render for the same user (that collision is
 *     exactly why per-project folders exist now), so auto-registering from it
 *     could attach someone else's pages to an order.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: projects, error } = await admin
    .from('projects')
    .select('id, order_id, user_id, product_type, uploaded_photos, updated_at')
    .not('order_id', 'is', null)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: any[] = [];
  for (const p of (projects || []) as any[]) {
    try {
      // Wishbook print files are server-generated covers, never Railway page
      // renders — anything sitting in a wishbook project's print folder is
      // leftovers from a mistaken render (TM-001138) and must NOT be
      // re-registered as a макет.
      if (/wish|pobazhan|guest/i.test(String(p.product_type || ''))) continue;
      const firstPath: string | undefined = (Array.isArray(p.uploaded_photos) ? p.uploaded_photos : [])
        .find((x: any) => x?.path)?.path;
      if (!firstPath) continue;

      let prefix: string | null = null;
      if (firstPath.includes('/originals/')) {
        prefix = firstPath.split('/originals/')[0];
      } else if (firstPath.startsWith('drafts/') && p.user_id) {
        prefix = `drafts/${p.user_id}/${p.id}`; // per-project folder only — never the shared legacy one
      }
      if (!prefix) continue;

      const { data: objects } = await admin.storage
        .from('photobook-uploads')
        .list(`${prefix}/print`, { limit: 300 });
      const filePaths = ((objects || []) as any[])
        .filter((o) => o?.name && o.id) // folders have id === null
        .map((o) => `${prefix}/print/${o.name}`);
      if (!filePaths.length) continue;

      const { data: existing } = await admin
        .from('order_files')
        .select('file_path')
        .eq('order_id', p.order_id)
        .eq('file_type', 'export')
        .in('file_path', filePaths);
      const known = new Set(((existing || []) as any[]).map((f) => f.file_path));
      const missing = filePaths.filter((path) => !known.has(path));
      if (!missing.length) continue;

      const insertErr = await registerExportFiles(admin, p.order_id, p.product_type, missing);
      results.push({ orderId: p.order_id, projectId: p.id, registered: missing.length, insertErr });
      console.log('[reconcile-print-files] registered', { orderId: p.order_id, projectId: p.id, files: missing.length });
    } catch (e: any) {
      // One broken project must not stop the sweep.
      console.error('[reconcile-print-files] project failed', { projectId: p.id, error: e?.message });
    }
  }

  return NextResponse.json({ ok: true, checked: (projects || []).length, reconciled: results });
}
