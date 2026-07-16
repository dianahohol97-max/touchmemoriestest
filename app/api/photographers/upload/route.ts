import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken, brandingPath, publicUrl, GALLERY_BUCKET, MAX_PHOTO_BYTES } from '@/lib/photographers/helpers';

export const dynamic = 'force-dynamic';

const KINDS = ['logo', 'avatar', 'portfolio'] as const;
const MAX_PORTFOLIO = 24;

/**
 * Branding upload for the photographer cabinet. Multipart: token, kind, file.
 * logo/avatar overwrite the profile field; portfolio appends to the jsonb
 * array (used by the public landing page).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Очікується multipart/form-data' }, { status: 400 });

  const photographer = await getPhotographerByToken(String(form.get('token') || ''));
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const kind = String(form.get('kind') || '') as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'kind: logo | avatar | portfolio' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Немає файлу' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Файл не є зображенням' }, { status: 400 });
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'Файл більший за 25 МБ' }, { status: 400 });

  const portfolio: string[] = Array.isArray(photographer.portfolio) ? photographer.portfolio : [];
  if (kind === 'portfolio' && portfolio.length >= MAX_PORTFOLIO) {
    return NextResponse.json({ error: `Ліміт ${MAX_PORTFOLIO} фото у портфоліо` }, { status: 400 });
  }

  const admin = getAdminClient();
  const path = brandingPath(photographer.id, kind, file.name);
  const { error: upErr } = await admin.storage
    .from(GALLERY_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const url = publicUrl(path);
  const patch =
    kind === 'logo' ? { logo_url: url } :
    kind === 'avatar' ? { avatar_url: url } :
    { portfolio: [...portfolio, url] };

  const { error } = await admin
    .from('photographers')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', photographer.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ url });
}
