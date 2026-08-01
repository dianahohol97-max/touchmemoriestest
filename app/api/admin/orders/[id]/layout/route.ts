import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders/[id]/layout
 *
 * Summary of the customer's saved constructor layout(s) for this order, so the
 * admin can SEE that a design exists — and how complete it is — without first
 * rendering it through Railway.
 *
 * Why: the order page only ever displayed rendered print files. A design that
 * was linked but not yet rendered looked identical to "no design at all"
 * (TM-001106: a full 36-page layout sat on the order while the page said
 * «Макет ще не створено»), and the only way to look at it was to clone it into
 * your personal drafts. This returns the facts that matter — pages, how many
 * photo slots are actually filled, and whether every referenced photo is really
 * in storage — plus the /print URL staff can open to view the spreads.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = getAdminClient();

  const { data: projects, error } = await admin
    .from('projects')
    .select('id, name, product_type, format, cover_type, total_pages, pages_data, uploaded_photos, updated_at')
    .eq('order_id', id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!projects || projects.length === 0) return NextResponse.json({ layouts: [] });

  const layouts = [] as any[];
  for (const p of projects as any[]) {
    const pages: any[] = Array.isArray(p.pages_data) ? p.pages_data : [];
    const photos: any[] = Array.isArray(p.uploaded_photos) ? p.uploaded_photos : [];

    // How many photo slots actually carry a photo — an empty draft has pages
    // but zero filled slots, which is exactly how a blank book gets printed.
    let filledSlots = 0;
    for (const pg of pages) {
      for (const s of (Array.isArray(pg?.slots) ? pg.slots : [])) {
        if (s?.photoId) filledSlots++;
      }
    }

    // Are the referenced files really in storage? A layout whose photos lost
    // their paths renders blank, so surface that here rather than at the печать.
    const withPath = photos.filter((u) => u?.path);
    let presentInStorage = 0;
    if (withPath.length > 0) {
      const byBucket = new Map<string, string[]>();
      for (const u of withPath) {
        const b = u.bucket || 'photobook-uploads';
        if (!byBucket.has(b)) byBucket.set(b, []);
        byBucket.get(b)!.push(u.path);
      }
      for (const [bucket, paths] of byBucket) {
        // createSignedUrls returns an entry per path; a missing object errors
        // on its own entry, so a successful signedUrl means the file is there.
        const { data: signed } = await admin.storage.from(bucket).createSignedUrls(paths, 60);
        presentInStorage += (signed || []).filter((s: any) => s?.signedUrl).length;
      }
    }

    layouts.push({
      id: p.id,
      name: p.name,
      productType: p.product_type,
      format: p.format,
      coverType: p.cover_type,
      totalPages: p.total_pages,
      spreads: Math.max(0, pages.length),
      photos: photos.length,
      photosWithPath: withPath.length,
      photosPresentInStorage: presentInStorage,
      filledSlots,
      updatedAt: p.updated_at,
      // Staff-viewable now that /api/print/[projectId] accepts a staff session.
      previewUrl: `/uk/print/${p.id}`,
      // The honest verdict, so nobody prints an empty draft by mistake.
      ready: filledSlots > 0 && withPath.length > 0 && presentInStorage === withPath.length,
    });
  }

  return NextResponse.json({ layouts });
}
