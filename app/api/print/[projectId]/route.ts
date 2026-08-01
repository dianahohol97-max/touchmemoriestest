import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { deriveGeometry, normalizeSizeKey, type SizeRow } from '@/lib/print/geometry';

export const dynamic = 'force-dynamic';

/**
 * Internal render-data endpoint for the print pipeline.
 *
 * Returns the full saved design of a `projects` row (pages, cover, overlays,
 * uploaded-photo metadata) so the /print page — and ultimately the headless
 * render service — can reconstruct the exact layout the customer built.
 *
 * Protected by PRINT_RENDER_TOKEN: only callers that present the shared secret
 * (the render service, or Diana testing) get the data. Without it, 401 — this
 * keeps other customers' designs private even though the route uses the service
 * role to read across all projects.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  // --- auth: the render service's shared secret, OR a logged-in staff member ---
  // Staff need to SEE a customer's layout. The admin order page only ever
  // showed RENDERED print files, so a linked-but-not-yet-rendered design read
  // as "макета немає" (TM-001106) even though it was there. Allowing a staff
  // session here makes the layout something you can simply look at — no render,
  // no cloning into personal drafts. Customers still get 401.
  const url = new URL(req.url);
  const expected = process.env.PRINT_RENDER_TOKEN;
  const token = url.searchParams.get('token') || req.headers.get('x-print-token');
  if (!expected || token !== expected) {
    const guard = await requireStaff();
    if (!guard.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { projectId } = await params;
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, product_type, format, cover_type, total_pages, pages_data, cover_data, overlays_data, uploaded_photos')
    .eq('id', projectId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Resolve each photo's storage path into a signed URL so the /print page can
  // render the real customer photos (not placeholders). Books store paths under
  // photobook-uploads; calendars/other products store them in order-files, so we
  // sign per the photo's own bucket (defaulting to photobook-uploads).
  const photos = Array.isArray(data.uploaded_photos) ? data.uploaded_photos : [];
  const withUrls = await Promise.all(
    photos.map(async (p: any) => {
      if (!p?.path) return { ...p, preview: p?.preview || '' };
      try {
        const { data: signed } = await supabase.storage
          .from(p.bucket || 'photobook-uploads')
          .createSignedUrl(p.path, 3600);
        return { ...p, preview: signed?.signedUrl || p?.preview || '' };
      } catch {
        return { ...p, preview: p?.preview || '' };
      }
    }),
  );

  // printSpec tells the render service how to screenshot this project without
  // hardcoding book logic: how many pages, each page's print size in mm, and the
  // DOM selector to capture. Books keep their existing behaviour (no printSpec →
  // service uses spread math); calendars describe themselves explicitly.
  const printSpec = buildPrintSpec(data);

  // Sheet geometry, derived from photobook_sizes. Serving it here makes the
  // /print page and the render service read the SAME numbers the editor drew
  // against, instead of each keeping its own copy of the printer's table —
  // which is how the render service ended up treating the customer's full
  // sheet as if it were only the finished page.
  const geometry = await resolveGeometry(supabase, data);

  return NextResponse.json({ project: { ...data, uploaded_photos: withUrls }, printSpec, geometry });
}

/** Look up the project's size in photobook_sizes and derive its geometry. */
async function resolveGeometry(supabase: ReturnType<typeof getAdminClient>, data: any) {
  const config = (data as any)?.overlays_data?.config || {};
  const PRODUCT_SIZE: Record<string, string> = { travelbook: '20x30' };
  const rawSize = String(
    config.selectedSize || data.format || PRODUCT_SIZE[String(data.product_type || '')] || ''
  );
  const sizeKey = normalizeSizeKey(rawSize);
  if (!sizeKey) return null;

  let row: SizeRow | null = null;
  try {
    const { data: sizes } = await supabase
      .from('photobook_sizes')
      .select('name, width_cm, height_cm, spread_width_mm, spread_height_mm, cover_width_mm, cover_height_mm, bleed_top_mm, bleed_bottom_mm, bleed_left_mm, bleed_right_mm, cover_fold_margin_mm');
    row = ((sizes || []) as SizeRow[]).find((s) => normalizeSizeKey(String(s.name || '')) === sizeKey) || null;
  } catch {
    /* fall through to the built-in table */
  }
  return deriveGeometry(sizeKey, row);
}

// Physical print sizes (mm) for non-book products that render via /print.
function buildPrintSpec(data: any): {
  productType: string;
  selector: string;
  pages: { w: number; h: number }[];
} | null {
  const pt = String(data.product_type || '').toLowerCase();

  if (pt === 'wall-calendar') {
    // A4 (210×297) or A3 (297×420) portrait. cover + 12 months.
    const fmt = String(data.format || '').toLowerCase();
    const isA3 = fmt.includes('a3') || fmt.includes('29.7×42') || fmt.includes('29,7');
    const page = isA3 ? { w: 297, h: 420 } : { w: 210, h: 297 };
    const cfg = Array.isArray(data.pages_data) ? data.pages_data[0] : null;
    const monthCount = Array.isArray(cfg?.pages) ? cfg.pages.length : 12;
    const pages = Array.from({ length: monthCount + 1 }, () => ({ ...page }));
    return { productType: 'wall-calendar', selector: '[data-print-page]', pages };
  }

  return null;
}
