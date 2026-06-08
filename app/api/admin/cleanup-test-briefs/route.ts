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

  // Enumerate each prefix via the Storage API (files are flat under the prefix),
  // then remove them. Reading storage.objects via PostgREST isn't available
  // (the storage schema isn't exposed), so we list through the Storage API.
  let deleted = 0;
  const report: Record<string, number> = {};
  const errors: string[] = [];

  for (const prefix of TEST_PREFIXES) {
    const { data: files, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 });
    if (listErr) { errors.push(`${prefix}: ${listErr.message}`); report[prefix] = -1; continue; }

    const paths = (files || [])
      .filter((f: any) => f && f.name)
      .map((f: any) => `${prefix}/${f.name}`);
    if (paths.length === 0) { report[prefix] = 0; continue; }

    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
    if (rmErr) { errors.push(`${prefix}: ${rmErr.message}`); report[prefix] = -2; continue; }
    deleted += paths.length;
    report[prefix] = paths.length;
  }

  return NextResponse.json({ ok: errors.length === 0, deleted, report, errors });
}
