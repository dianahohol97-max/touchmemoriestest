import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { streamFromBucket } from '@/lib/wedding/serve';
import { HERO_PLACEHOLDER } from '@/lib/wedding/config';

export const dynamic = 'force-dynamic';

// Фото пари для шапки.
//
// Окремий роут існує рівно заради однієї обіцянки: замінити фото можна без
// правок коду. Файл кладеться в бакет, шлях записується в hero_photo_path — і
// сторінка бере нове фото з наступного ж відкриття. Поки в hero_photo_path
// порожньо, роут відправляє на тимчасову заглушку з репозиторію, щоб шапка
// ніколи не була порожньою прямокутною дірою.

const SLUG_RE = /^[a-z0-9-]{3,80}$/;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!SLUG_RE.test(slug)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const supabase = getAdminClient();

  const { data: event, error } = await supabase
    .from('wedding_events')
    .select('hero_photo_path')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[wedding/hero] не вдалося прочитати подію:', error);
    return new NextResponse('Error', { status: 500 });
  }
  if (!event) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (!event.hero_photo_path) {
    // Заглушка лежить у public, тобто роздається статикою. Перенаправлення
    // тимчасове (307), бо hero_photo_path заповнять, і постійне застрягло б у
    // кеші браузерів уже після того, як справжнє фото з'явилося.
    return NextResponse.redirect(new URL(HERO_PLACEHOLDER, req.url), 307);
  }

  return streamFromBucket(event.hero_photo_path);
}
