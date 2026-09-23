import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Каталог готових обкладинок тревелбука для адмінки.
 *
 * Чому окремий маршрут, а не читання таблиці з браузера: на
 * `travelbook_covers` стоїть RLS, де публіці дозволено лише читати активні
 * рядки, а писати може тільки сервісна роль. Тобто сторінка адмінки фізично не
 * може зберегти колір напряму — шлях лежить через цей маршрут із
 * `requireAdmin`.
 *
 * Публічний `/api/travelbook-covers` лишається окремо і навмисно: він віддає
 * лише активні обкладинки, кешується на CDN і ходить до нього конструктор.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
const FIELDS = 'id, name, name_en, image_url, thumbnail_url, kind, sort_order, active, background_color, created_at';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  // Сто рядків із запасом на зростання; тисяча — стеля PostgREST, і свідомий
  // ліміт тут чесніший за мовчазний обрив (гоча 14 у CLAUDE.md).
  const { data, error } = await admin
    .from('travelbook_covers')
    .select(FIELDS)
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ covers: data || [] });
}

/** Нова обкладинка. Картинка вже лежить у сховищі — сюди приходить її адреса. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const name = String(body.name || '').trim();
  const imageUrl = String(body.image_url || '').trim();
  if (!name) return NextResponse.json({ error: 'Потрібна назва' }, { status: 400 });
  if (!imageUrl) return NextResponse.json({ error: 'Потрібна картинка' }, { status: 400 });

  const bg = String(body.background_color || '').trim();
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('travelbook_covers')
    .insert({
      name,
      name_en: String(body.name_en || '').trim() || null,
      image_url: imageUrl,
      kind: body.kind === 'country' ? 'country' : 'city',
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
      active: body.active !== false,
      background_color: HEX.test(bg) ? bg.toLowerCase() : null,
    })
    .select(FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cover: data });
}

/**
 * Зміна однієї обкладинки.
 *
 * `background_color` приймає порожній рядок як «прибрати колір»: порожнє
 * значення означає, що кольору ніхто не задавав, і конструктор порахує
 * підказку сам. Саме тому тут null, а не мовчазне ігнорування — інакше
 * помилково поставлений колір неможливо було б зняти.
 */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Потрібен id' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if (typeof body.name_en === 'string') patch.name_en = body.name_en.trim() || null;
  if (typeof body.kind === 'string') patch.kind = body.kind === 'country' ? 'country' : 'city';
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) patch.sort_order = Number(body.sort_order);
  if (typeof body.background_color === 'string') {
    const bg = body.background_color.trim();
    if (!bg) patch.background_color = null;
    else if (HEX.test(bg)) patch.background_color = bg.toLowerCase();
    else return NextResponse.json({ error: 'Колір має бути у форматі #rrggbb' }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Нічого міняти' }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('travelbook_covers')
    .update(patch)
    .eq('id', id)
    .select(FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cover: data });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Потрібен id' }, { status: 400 });

  const admin = getAdminClient();
  const { error } = await admin.from('travelbook_covers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
