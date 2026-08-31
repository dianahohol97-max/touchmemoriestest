import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateOrderPrintSheets } from '@/lib/print/generate-sheets';

// jimp needs the Node runtime; sheet building can take a few seconds.
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/orders/[id]/print-sheets
 *
 * Builds print-ready imposition sheets (JPG) from the customer's uploaded
 * photos and attaches them to the order. Called automatically by checkout
 * once the export files are linked (idempotent — skips if already built), and
 * by staff from the admin order page with { force: true } to rebuild.
 */

/**
 * GET /api/orders/[id]/print-sheets — staff-only. Lists the generated
 * imposition sheets for an order with signed download URLs.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();
  const { data: files } = await admin
    .from('order_files')
    .select('file_path, file_name, bucket_name, product_type, page_number')
    .eq('order_id', id)
    .eq('file_category', 'print_sheet')
    .order('page_number', { ascending: true });
  const sheets: { name: string; product_type: string; url: string | null }[] = [];
  for (const f of files || []) {
    // download: the signed URL must carry Content-Disposition: attachment.
    // Without it the browser opens the JPG in a new tab, and the anchor's
    // `download` attribute is powerless cross-origin (Diana, 2026-08-11:
    // «натискаю скачати — дає в новій вкладці, а скачати неможливо»).
    const { data: signed } = await admin.storage
      .from(f.bucket_name || 'order-files')
      .createSignedUrl(f.file_path, 60 * 60, { download: f.file_name || true });
    sheets.push({ name: f.file_name, product_type: f.product_type, url: signed?.signedUrl || null });
  }
  return NextResponse.json({ sheets });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let force = false;
  try { force = (await req.json())?.force === true; } catch { /* no body */ }

  // Rebuilding (force) is staff-only; the automatic first build is not, since
  // it only composes the order's own already-uploaded files and is idempotent.
  if (force) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;
  }

  try {
    const result = await generateOrderPrintSheets(id, { force });
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[print-sheets] generation failed', e);
    return NextResponse.json({ ok: false, error: e?.message || 'generation_failed' }, { status: 500 });
  }
}
