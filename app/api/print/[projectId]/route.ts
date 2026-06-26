import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

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
  // --- auth: shared secret ---
  const expected = process.env.PRINT_RENDER_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'PRINT_RENDER_TOKEN not configured on the server' },
      { status: 500 },
    );
  }
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || req.headers.get('x-print-token');
  if (token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  return NextResponse.json({ project: { ...data, uploaded_photos: withUrls }, printSpec });
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
