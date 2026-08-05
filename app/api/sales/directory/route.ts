import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getManagerByToken } from '@/lib/sales/commission';
import { normalizeInstagram } from '@/lib/leads/contacts';

export const dynamic = 'force-dynamic';

/**
 * Спільний довідник зайнятих контактів (Diana, 2026-08-06).
 *
 * Перевірка на дублікати спрацьовувала лише в момент створення ліда: менеджер
 * вводив контакт і аж тоді дізнавався, що його веде хтось інший. Двоє людей
 * встигали написати одній студії ще до того — вона отримувала два однакові
 * листи від тієї самої компанії.
 *
 * Тепер менеджер бачить усі ліди, а не тільки свої, і може перевірити студію
 * перед тим, як писати.
 *
 * Що саме видно з чужого ліда: назва, тип, місто, нікнейм, сайт, статус, хто
 * веде і коли востаннє щось відбувалося. Пошта, телефон, нотатки й переписка
 * НЕ віддаються — вони тут не потрібні (щоб не написати двічі, досить знати,
 * що контакт зайнятий), а віддавати їх означало б робити з кабінету
 * вивантажувану базу контактів для будь-кого, хто пропрацював тут тиждень.
 */
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  const manager = await getManagerByToken(admin, req.nextUrl.searchParams.get('token') || '');
  if (!manager) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim();

  let query = admin
    .from('leads')
    .select('id, business_name, business_type, city, instagram, website, status, sales_manager_id, offer_sent_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500);

  if (q) {
    // Нікнейм шукаємо і як текст, і приведеним до канонічного вигляду — щоб
    // «@studio.svitlo» і посилання на профіль знаходили той самий контакт.
    const handle = normalizeInstagram(q);
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const parts = [`business_name.ilike.${like}`, `city.ilike.${like}`, `instagram.ilike.${like}`, `website.ilike.${like}`];
    if (handle) parts.push(`instagram.ilike.%${handle}%`);
    query = query.or(parts.join(','));
  }

  const { data: leads, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: managers } = await admin.from('sales_managers').select('id, name');
  const nameById: Record<string, string> = {};
  (managers || []).forEach((m: any) => { nameById[m.id] = m.name; });

  return NextResponse.json({
    leads: (leads || []).map((l: any) => ({
      id: l.id,
      business_name: l.business_name,
      business_type: l.business_type,
      city: l.city,
      instagram: l.instagram,
      website: l.website,
      status: l.status,
      mine: l.sales_manager_id === manager.id,
      manager_name: l.sales_manager_id ? (nameById[l.sales_manager_id] || 'Інший менеджер') : null,
      last_activity: l.updated_at || l.created_at,
      offer_sent_at: l.offer_sent_at,
    })),
  });
}
