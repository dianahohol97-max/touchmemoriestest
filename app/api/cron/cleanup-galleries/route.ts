import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { GALLERY_BUCKET } from '@/lib/photographers/helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Nightly retention for photographer galleries: photos live 30 days
 * (photographer_galleries.expires_at), then the files are deleted from
 * storage. The gallery row is kept (the client link shows an "expired"
 * state with the photographer's contacts); files_purged_at marks it done
 * so a gallery is never processed twice. Same pattern as cleanup-order-files.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'No admin client' }, { status: 500 });

  const BATCH = 25;
  const { data: galleries, error } = await admin
    .from('photographer_galleries')
    .select('id')
    .lt('expires_at', new Date().toISOString())
    .is('files_purged_at', null)
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let purgedGalleries = 0;
  let purgedFiles = 0;
  for (const g of galleries || []) {
    const { data: photos } = await admin
      .from('photographer_gallery_photos')
      .select('storage_path')
      .eq('gallery_id', g.id);

    const paths = (photos || []).map(p => p.storage_path);
    // Remove in chunks of 100 (storage API limit safety).
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error: rmErr } = await admin.storage.from(GALLERY_BUCKET).remove(chunk);
      if (rmErr) {
        console.error('[cleanup-galleries] remove failed', { gallery: g.id, error: rmErr.message });
        return NextResponse.json({ error: rmErr.message, purgedGalleries, purgedFiles }, { status: 500 });
      }
      purgedFiles += chunk.length;
    }

    await admin.from('photographer_gallery_photos').delete().eq('gallery_id', g.id);
    await admin.from('photographer_galleries')
      .update({ files_purged_at: new Date().toISOString() })
      .eq('id', g.id);
    purgedGalleries++;
  }

  return NextResponse.json({ success: true, purgedGalleries, purgedFiles });
}
