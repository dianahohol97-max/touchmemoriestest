import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { streamFromBucket } from '@/lib/wedding/serve';

export const dynamic = 'force-dynamic';

// Віддає один файл із приватного бакета.
//
// ЧОМУ БАКЕТ ПРИВАТНИЙ, А НЕ ПУБЛІЧНИЙ. Публічний віддавав би файли напряму з
// CDN і був би на крок швидшим, але тоді адреса кожного знімка працювала б
// вічно й сама по собі, поза нашим кодом: досить один раз десь її засвітити —
// у месенджері, в історії браузера, в журналі чужого проксі — і фото з чийогось
// весілля лишається відкритим назавжди, і відкликати його вже нічим. Тут
// натомість одна точка входу, якою ми керуємо: закрити подію чи прибрати фото
// означає, що адреса перестає працювати негайно.
//
// ЩО НЕ ВТРАТИЛИ. Перед цим роутом стоїть next/image: він тягне файл один раз,
// робить із нього WebP чи AVIF потрібного розміру і кешує результат на своєму
// боці. Тобто гість отримує зменшене прев'ю, а не повний файл, і цей роут
// викликається раз на фото, а не раз на показ.
//
// ЧОМУ БЕЗ ПІДПИСАНИХ ПОСИЛАНЬ. Підписане посилання протерміновується, а
// сторінка живе відкритою весь вечір і щоп'ятнадцять секунд додає нові фото:
// довелося б перевипускати посилання для всієї сітки, і будь-яке прострочене
// перетворювалося б на розбиту плитку в галереї.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Ідентифікатор мусить бути UUID. Без цієї перевірки будь-який рядок їхав би
  // в базу параметром запиту.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const supabase = getAdminClient();

  const { data: photo, error } = await supabase
    .from('wedding_photos')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[wedding/photo] не вдалося прочитати фото:', error);
    return new NextResponse('Error', { status: 500 });
  }
  if (!photo) {
    return new NextResponse('Not found', { status: 404 });
  }

  return streamFromBucket(photo.storage_path);
}
