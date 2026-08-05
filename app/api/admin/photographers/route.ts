import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('photographers')
    .select('*, photographer_galleries(count)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Скільки місця займає кожен фотограф (Diana, 2026-08-06). Сума size_bytes
  // усіх фото його галерей — постранично, бо PostgREST віддає максимум 1000
  // рядків за запит, і без циклу сума була б занижена мовчки.
  const bytesByPhotographer: Record<string, number> = {};
  for (let from = 0; ; from += 1000) {
    const { data: photos } = await admin
      .from('photographer_gallery_photos')
      .select('size_bytes, photographer_galleries!inner(photographer_id)')
      .range(from, from + 999);
    (photos || []).forEach((ph: any) => {
      const pid = ph.photographer_galleries?.photographer_id;
      if (pid) bytesByPhotographer[pid] = (bytesByPhotographer[pid] || 0) + Number(ph.size_bytes || 0);
    });
    if (!photos || photos.length < 1000) break;
  }

  /**
   * Скільки кожен фотограф замовив і скільки заплатив за тарифи памʼяті
   * (Diana, 2026-08-06). Замовлення матчаться за customer_id або поштою —
   * фотограф замовляє на сайті зі свого звичайного акаунта, окремого звʼязку
   * «замовлення → фотограф» у базі немає. Рахуються лише оплачені.
   */
  const paidOrders: { customer_id: string | null; customer_email: string | null; total: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: rows } = await admin
      .from('orders')
      .select('customer_id, customer_email, total')
      .eq('payment_status', 'paid')
      .range(from, from + 999);
    (rows || []).forEach((r: any) => paidOrders.push(r));
    if (!rows || rows.length < 1000) break;
  }

  const { data: subs } = await admin
    .from('photographer_subscriptions')
    .select('photographer_id, amount_uah, status')
    .eq('status', 'paid');
  const subsByPhotographer: Record<string, { count: number; sum: number }> = {};
  (subs || []).forEach((s: any) => {
    const cur = subsByPhotographer[s.photographer_id] || { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += Number(s.amount_uah || 0);
    subsByPhotographer[s.photographer_id] = cur;
  });

  return NextResponse.json({
    photographers: (data || []).map((p: any) => {
      const email = String(p.email || '').toLowerCase();
      const own = paidOrders.filter(o =>
        (p.customer_id && o.customer_id === p.customer_id) ||
        (email && String(o.customer_email || '').toLowerCase() === email));
      const subsInfo = subsByPhotographer[p.id] || { count: 0, sum: 0 };
      return {
        ...p,
        gallery_count: p.photographer_galleries?.[0]?.count || 0,
        storage_bytes: bytesByPhotographer[p.id] || 0,
        orders_count: own.length,
        orders_total: Math.round(own.reduce((s, o) => s + Number(o.total || 0), 0)),
        paid_subs_count: subsInfo.count,
        paid_subs_total: subsInfo.sum,
        photographer_galleries: undefined,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const slug = String(body?.slug || '').trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!name || !email || !slug) {
    return NextResponse.json({ error: "Обов'язкові поля: name, email, slug" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('photographers')
    .insert({ name, email, slug, phone: body?.phone || null, instagram: body?.instagram || null })
    .select('*')
    .single();
  if (error) {
    const msg = error.code === '23505' ? 'Такий slug або домен уже існує' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ photographer: data });
}
