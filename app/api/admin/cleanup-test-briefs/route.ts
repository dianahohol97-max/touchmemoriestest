import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// One-off cleanup: removes three known TEST magazine-brief folders that are
// pushing Supabase storage over the free 1GB quota (which blocks all photo
// uploads / order submissions). It only ever touches these exact prefixes, so
// it is harmless to anyone who hits it and is idempotent (re-running does
// nothing once they're gone). Delete this route after it has been run once.
const BUCKET = 'order-files';
const TEST_PREFIXES = [
  'magazine-brief-1780042667312',
  'magazine-brief-1780042840148',
  'magazine-brief-1780042975828',
];
const TOKEN = 'tm-cleanup-briefs-2026';

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: 'No admin client' }, { status: 500 });

  // Get the exact full object paths for the three prefixes (handles any nesting)
  // by reading the storage.objects table with the service-role client.
  const orFilter = TEST_PREFIXES.map(p => `name.like.${p}/%`).join(',');
  const { data: rows, error: selErr } = await supabase
    .schema('storage')
    .from('objects')
    .select('name')
    .eq('bucket_id', BUCKET)
    .or(orFilter);

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  const paths = (rows || []).map((r: any) => r.name).filter(Boolean);
  if (paths.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, note: 'Nothing to delete (already clean).' });
  }

  // Remove via the Storage API in chunks of 100.
  let deleted = 0;
  const errors: string[] = [];
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) errors.push(error.message);
    else deleted += chunk.length;
  }

  return NextResponse.json({ ok: errors.length === 0, deleted, total: paths.length, errors });
}
