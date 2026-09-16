import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { WEDDING_BUCKET } from './config';

/**
 * Витягує обʼєкт із приватного бакета і віддає його як відповідь.
 *
 * Живе окремо від роутів навмисно: у файлі маршруту Next.js дозволяє експорт
 * лише обробників методів і налаштувань, тож спільний помічник там зламав би
 * збірку перевіркою типів маршруту.
 *
 * Кеш річний і незмінний (immutable): шлях містить випадковий UUID, тож той
 * самий шлях завжди означає той самий файл, і перевіряти його свіжість нема
 * навіщо. private, бо файл не публічний і спільним кешам тримати його не слід;
 * кешу браузера і кешу оптимізатора зображень це не заважає.
 */
export async function streamFromBucket(path: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.storage.from(WEDDING_BUCKET).download(path);

  if (error || !data) {
    console.error('[wedding] бакет не віддав файл:', path, error);
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(data.stream() as unknown as BodyInit, {
    headers: {
      'Content-Type': data.type || 'image/jpeg',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Length': String(data.size),
    },
  });
}
