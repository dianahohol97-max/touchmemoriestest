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
 * Друга задача — ліди, які ми збираємо самі. Імпорт із Google Places (source
 * 'google_places') створює контакти без менеджера, і в кабінетах їх не було
 * видно взагалі: вони лежали тільки в адмінці. Тепер вони в спільному пулі, і
 * менеджер бере контакт у роботу одним натисканням (POST нижче).
 *
 * Що саме видно з ліда, який менеджеру не належить: назва, тип, місто,
 * нікнейм, сайт, статус, звідки контакт і хто його веде. Пошта, телефон,
 * нотатки й переписка НЕ віддаються — вони тут не потрібні (щоб не написати
 * двічі, досить знати, що контакт зайнятий), а віддавати їх означало б робити
 * з кабінету вивантажувану базу контактів для будь-кого, хто пропрацював тут
 * тиждень. Свої контакти менеджер бачить повністю у «Моїх лідах», щойно візьме
 * їх у роботу.
 */
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  const manager = await getManagerByToken(admin, req.nextUrl.searchParams.get('token') || '');
  if (!manager) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim();

  // free=1 — лише вільні контакти (пул), інакше всі.
  const onlyFree = req.nextUrl.searchParams.get('free') === '1';

  let query = admin
    .from('leads')
    .select('id, business_name, business_type, city, instagram, website, status, source, sales_manager_id, offer_sent_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (onlyFree) query = query.is('sales_manager_id', null);

  if (q) {
    // Нікнейм шукаємо і як текст, і приведеним до канонічного вигляду — щоб
    // «@studio.svitlo» і посилання на профіль знаходили той самий контакт.
    const handle = normalizeInstagram(q);
    // Кома й дужки — синтаксис .or() у PostgREST: без зачистки кома в полі
    // пошуку ламає весь фільтр і віддає 500 замість результатів. % і _ — LIKE-
    // шаблони, їх теж прибираємо.
    const like = `%${q.replace(/[%_,()*\\]/g, ' ').trim()}%`;
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
      source: l.source,
      free: !l.sales_manager_id,
      mine: l.sales_manager_id === manager.id,
      manager_name: l.sales_manager_id ? (nameById[l.sales_manager_id] || 'Інший менеджер') : null,
      last_activity: l.updated_at || l.created_at,
      offer_sent_at: l.offer_sent_at,
    })),
  });
}

/**
 * POST — взяти вільний контакт у роботу.
 *
 * Умова `sales_manager_id is null` стоїть у самому UPDATE, а не в окремій
 * перевірці перед ним: двоє менеджерів цілком можуть натиснути на той самий
 * контакт із пулу одночасно, і перевірка «чи вільний» окремим запитом обом
 * відповіла б «так». Тут другий просто не оновить жодного рядка й отримає
 * відмову.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const admin = getAdminClient();
  const manager = await getManagerByToken(admin, String(body?.token || ''));
  if (!manager) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const leadId = String(body?.lead_id || '');
  const { data, error } = await admin
    .from('leads')
    .update({ sales_manager_id: manager.id, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .is('sales_manager_id', null)
    .select('id, business_name')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: 'Цей контакт щойно взяв інший менеджер' }, { status: 409 });
  }
  return NextResponse.json({ lead: data });
}
