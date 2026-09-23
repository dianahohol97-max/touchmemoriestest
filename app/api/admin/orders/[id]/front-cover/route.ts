import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { DPI, resolveProjectSizeKey } from '@/lib/print/geometry';
import { frontCoverCropPx, type FrontCoverCropMode } from '@/lib/print/cover-fold';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/orders/[id]/front-cover?project=<uuid>&mode=trimmed|bleed
 *
 * Передня обкладинка одного виробу окремим файлом.
 *
 * ЧОМУ ВИРІЗАННЯ, А НЕ ОКРЕМИЙ РЕНДЕР. Готовий cover.jpg — це весь аркуш:
 * зліва задня обкладинка, справа передня. Вирізання працює для всіх уже
 * відрендерених замовлень одразу, тоді як окремий рендер дав би файл лише
 * тим, кого перерендерять. Вирізаний файл до пікселя збігається з тим, що
 * поїде в друкарню, тож менеджерка дивиться саме на друковане. І головне —
 * тут нічого не пишеться: друкований набір, order_files і ZIP лишаються як є,
 * це лише додаткова кнопка скачування.
 *
 * ДВА РЕЖИМИ. `bleed` віддає всю праву половину аркуша разом із полем загину і
 * половиною корінця — цим звіряються з друкарнею. `trimmed` віддає видиму
 * площину, тобто те, як обкладинка виглядатиме в руках; це те, що зазвичай і
 * потрібно. Геометрія обох живе в lib/print/cover-fold.ts разом із рештою
 * друкарських чисел.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const url = new URL(req.url);
  const projectId = (url.searchParams.get('project') || '').trim();
  const mode: FrontCoverCropMode = url.searchParams.get('mode') === 'bleed' ? 'bleed' : 'trimmed';
  if (!projectId) return NextResponse.json({ error: 'Потрібен параметр project' }, { status: 400 });

  const admin = getAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select('id, order_number')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

  // Розмір виробу резолвиться тим самим шляхом, яким його бере /print і
  // рендер-сервіс. Своя копія цієї логіки вже одного разу коштувала замовлення
  // без файлів (TM-001108), тож тут саме resolveProjectSizeKey.
  const { data: project } = await admin
    .from('projects')
    .select('id, product_type, format, overlays_data, created_at')
    .eq('id', projectId)
    .eq('order_id', id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: 'Макет не належить цьому замовленню' }, { status: 404 });

  const sizeKey = resolveProjectSizeKey({
    product_type: project.product_type,
    format: project.format,
    config: (project as any)?.overlays_data?.config || null,
  });
  if (!sizeKey) {
    return NextResponse.json({ error: 'У макеті не збережено розмір виробу — різати наосліп не буду' }, { status: 400 });
  }

  // Обкладинка цього макета. Тревелбуки й журнали звуть її cover.jpg,
  // фотокниги — 00_cover.jpg; обидві назви реєструються як book-cover.
  //
  // Належність макетові стоїть У ЗАПИТІ, а не у відсіві після нього: замовлення
  // на пʼять книг несе понад триста файлів, і «взяти перші N, а тоді відсіяти»
  // — це лотерея, на якій уже спинялася звірка з KeyCRM (гоча 13 у CLAUDE.md).
  const { data: files } = await admin
    .from('order_files')
    .select('file_name, file_path, bucket_name, file_category')
    .eq('order_id', id)
    .eq('file_type', 'export')
    .like('file_path', `%${projectId}%`)
    .limit(50);

  const cover = (files || []).find((f: any) =>
    String(f.file_category || '') === 'book-cover' || /cover/i.test(String(f.file_name || '')));
  if (!cover) {
    return NextResponse.json({ error: 'У цього виробу ще немає файлу обкладинки — перегенеруйте макет' }, { status: 404 });
  }

  const bucket = cover.bucket_name || 'photobook-uploads';
  const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(cover.file_path);
  if (dlErr || !blob) {
    return NextResponse.json({ error: `Не вдалося прочитати обкладинку зі сховища: ${dlErr?.message || 'файл недоступний'}` }, { status: 500 });
  }

  const input = Buffer.from(await blob.arrayBuffer());
  const meta = await sharp(input).metadata();
  const crop = frontCoverCropPx(sizeKey, mode, meta.width || 0, meta.height || 0);
  if (!crop) {
    return NextResponse.json({ error: `Не вдалося порахувати виріз для розміру «${sizeKey}»` }, { status: 400 });
  }

  const out = await sharp(input)
    .extract(crop)
    // Якість 95 і повна колірна роздільність: файл дивляться очима і показують
    // клієнтці, а смуга рівного кольору на задньому плані перша страждає від
    // проріджування кольору.
    .withMetadata({ density: DPI })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toBuffer();

  // Порядковий номер виробу в замовленні — той самий, яким книги підписані в
  // картці: за часом створення макета.
  const { data: siblings } = await admin
    .from('projects')
    .select('id, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: true })
    .limit(100);
  const idx = (siblings || []).findIndex((p: any) => String(p.id) === projectId);
  const bookPart = (siblings || []).length > 1 && idx >= 0 ? `-книга-${idx + 1}` : '';
  const suffix = mode === 'bleed' ? '-з-полями' : '';
  const fileName = `${order.order_number || id}${bookPart}-передня-обкладинка${suffix}.jpg`;

  return new NextResponse(new Uint8Array(out), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Назва українською, тож лише filename* у UTF-8: голий filename тут
      // браузери читають як latin-1 і показують кашу.
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'no-store',
    },
  });
}
