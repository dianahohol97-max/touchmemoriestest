import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
async function requireStaff(): Promise<boolean> {
  const cookieClient = await createClient();
  const { data: { user } } = await cookieClient.auth.getUser();
  if (!user?.email) return false;
  const admin = getAdminClient();
  const [{ data: adminRow }, { data: staffRow }] = await Promise.all([
    admin.from('admin_users').select('id').eq('email', user.email).maybeSingle(),
    admin.from('staff').select('id').eq('email', user.email).maybeSingle(),
  ]);
  return Boolean(adminRow || staffRow);
}

/**
 * GET /api/orders/[id]/print-sheets — staff-only. Lists the generated
 * imposition sheets for an order with signed download URLs.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireStaff())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = getAdminClient();
  const { data: files } = await admin
    .from('order_files')
    .select('file_path, file_name, bucket_name, product_type, page_number')
    .eq('order_id', id)
    .eq('file_category', 'print_sheet')
    .order('page_number', { ascending: true });
  const sheets: { name: string; product_type: string; url: string | null }[] = [];
  for (const f of files || []) {
    const { data: signed } = await admin.storage.from(f.bucket_name || 'order-files').createSignedUrl(f.file_path, 60 * 60);
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
  if (force && !(await requireStaff())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await generateOrderPrintSheets(id, { force });
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[print-sheets] generation failed', e);
    return NextResponse.json({ ok: false, error: e?.message || 'generation_failed' }, { status: 500 });
  }
}
