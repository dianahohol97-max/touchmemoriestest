import { NextRequest, NextResponse } from 'next/server';
import { getPhotographerByToken } from '@/lib/photographers/helpers';
import {
  activeProvider, isR2Configured, r2ConfigProblem, r2Endpoint, r2AccountIdShape,
  putFile, fileUrl, fileExists, removeFiles,
} from '@/lib/photographers/storage';

export const dynamic = 'force-dynamic';

/**
 * Does storage actually work? A round trip beats reading env vars: it writes a
 * tiny file, checks it landed, fetches it over the public URL the way a client
 * browser would, then deletes it.
 *
 * Written after the first real R2 upload failed with a TLS handshake error
 * (Diana, 2026-08-05) — the config was accepted silently and only a photo
 * upload revealed the problem. Auth is the cabinet token; the response never
 * contains keys, only the endpoint host and a masked account id.
 */
export async function GET(req: NextRequest) {
  const photographer = await getPhotographerByToken(req.nextUrl.searchParams.get('token') || '');
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const configured = isR2Configured();
  const endpoint = r2Endpoint();
  // Any R2 variable present means R2 was MEANT to be on, so a config problem is
  // a failure rather than «we simply stayed on Supabase».
  const r2Intended = Boolean(
    process.env.R2_ACCOUNT_ID || process.env.R2_BUCKET || process.env.R2_PUBLIC_BASE_URL
  );
  const info: Record<string, any> = {
    active_provider: activeProvider(),
    r2_intended: r2Intended,
    r2_configured: configured,
    r2_problem: r2ConfigProblem() || null,
    // Shape of the account id, so a wrong paste names itself instead of just
    // failing the hex check.
    r2_account_id_shape: r2AccountIdShape(),
    // Host only — enough to spot a malformed account id, useless to an attacker.
    r2_endpoint_host: configured ? new URL(endpoint).host.replace(/^[0-9a-f]{6}/, m => `${m}…`) : null,
    r2_public_base_host: process.env.R2_PUBLIC_BASE_URL
      ? (() => { try { return new URL(process.env.R2_PUBLIC_BASE_URL!).host; } catch { return 'невалідний URL'; } })()
      : null,
  };

  const path = `_healthcheck/${photographer.id}/${Date.now()}.txt`;
  const body = Buffer.from(`storage-check ${new Date().toISOString()}`);

  const put = await putFile(path, body, 'text/plain');
  if ('error' in put) {
    return NextResponse.json({ ...info, write: 'помилка', error: put.error }, { status: 500 });
  }
  info.write = 'ок';
  info.written_to = put.provider;
  // putFile falls back to Supabase when R2 misbehaves, so a provider that does
  // not match the active one is exactly the symptom we are hunting.
  info.fell_back_to_supabase = configured && put.provider === 'supabase';

  const head = await fileExists(path, put.provider);
  info.head = head.ok ? 'ок' : 'файл не знайдено після запису';

  const url = fileUrl(path, put.provider);
  info.public_url_host = (() => { try { return new URL(url).host; } catch { return null; } })();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    info.public_read = res.ok ? 'ок' : `HTTP ${res.status}`;
    if (res.ok) {
      const text = await res.text();
      info.public_read_matches = text.startsWith('storage-check');
    }
  } catch (e: any) {
    info.public_read = `помилка: ${e?.message || e}`;
  }

  const delErr = await removeFiles([{ path, provider: put.provider }]);
  info.cleanup = delErr ? `помилка: ${delErr}` : 'ок';

  // Storage working is not the same as R2 working. When R2 is meant to be on
  // but is misconfigured, the round trip succeeds on Supabase and reporting
  // «healthy» would read as «переїзд відбувся» while nothing actually moved.
  const healthy = info.write === 'ок' && info.head === 'ок' && info.public_read === 'ок'
    && !info.fell_back_to_supabase && (!r2Intended || configured);
  return NextResponse.json({ ...info, healthy });
}
