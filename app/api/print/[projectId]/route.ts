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
  // render the real customer photos (not placeholders). Paths were saved into
  // uploaded_photos[i].path at checkout. Signed URLs are valid for 1 hour, long
  // enough for the render service to screenshot every page.
  const photos = Array.isArray(data.uploaded_photos) ? data.uploaded_photos : [];
  const withUrls = await Promise.all(
    photos.map(async (p: any) => {
      if (!p?.path) return { ...p, preview: '' };
      try {
        const { data: signed } = await supabase.storage
          .from('photobook-uploads')
          .createSignedUrl(p.path, 3600);
        return { ...p, preview: signed?.signedUrl || '' };
      } catch {
        return { ...p, preview: '' };
      }
    }),
  );

  return NextResponse.json({ project: { ...data, uploaded_photos: withUrls } });
}
