import { NextResponse } from 'next/server';
import { requireAdmin, likeEscape } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { findEmailOnSite } from '@/lib/leads/email-finder';

export const dynamic = 'force-dynamic';
// Кожен лід — це один-три запити до чужого сайту з таймаутом 8 секунд, тому
// пачка обробляється довше за типовий роут.
export const maxDuration = 60;

/**
 * Знайти пошту лідів на їхніх сайтах (Diana, 2026-08-06: «для мене емейли
 * найважливіші»).
 *
 * Google Places пошти не дає, тому зібрані контакти мають телефон і сайт. Цей
 * роут бере лідів без пошти, у яких є сайт, заходить на головну (а якщо там
 * нічого — на типові сторінки контактів) і забирає опубліковану адресу.
 *
 * Працює пачками: за один виклик проходить кілька лідів і повертає, скільки
 * лишилося. Сторінка в адмінці викликає його по колу, показуючи поступ — так
 * жоден окремий запит не впирається в ліміт часу.
 *
 * email_checked_at ставиться навіть тоді, коли пошту не знайшли: інакше кожен
 * наступний прохід витрачався б на ті самі безнадійні сайти.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit) || 8, 1), 20);

  const admin = getAdminClient();

  const { data: leads, error } = await admin
    .from('leads')
    .select('id, business_name, website')
    .is('email', null)
    .is('email_checked_at', null)
    .not('website', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const found: { business_name: string; email: string }[] = [];

  // Послідовно, а не всі одразу: пачка невелика, а рівний темп не виглядає
  // для чужих сайтів як напад.
  for (const lead of leads || []) {
    let email: string | null = null;
    try {
      const result = await findEmailOnSite(lead.website as string);
      email = result.email;
    } catch (e) {
      console.error('[find-emails] site failed', lead.website, e);
    }

    const patch: Record<string, any> = { email_checked_at: new Date().toISOString() };

    if (email) {
      // Та сама адреса вже може стояти в іншого ліда — мережа студій під одним
      // офісом трапляється часто. Дубль зламав би перевірку «цього вже хтось
      // веде», тому другий лишається без пошти.
      const { data: taken } = await admin
        .from('leads')
        .select('id')
        .ilike('email', likeEscape(email))
        .maybeSingle();
      if (!taken) {
        patch.email = email;
        found.push({ business_name: lead.business_name, email });
      }
    }

    await admin.from('leads').update(patch).eq('id', lead.id);
  }

  const { count: remaining } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .is('email', null)
    .is('email_checked_at', null)
    .not('website', 'is', null);

  return NextResponse.json({
    processed: (leads || []).length,
    found: found.length,
    examples: found.slice(0, 3),
    remaining: remaining || 0,
  });
}

/** GET — скільки лідів ще чекають на пошук пошти. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  const [{ count: pending }, { count: withEmail }, { count: total }] = await Promise.all([
    admin.from('leads').select('id', { count: 'exact', head: true })
      .is('email', null).is('email_checked_at', null).not('website', 'is', null),
    admin.from('leads').select('id', { count: 'exact', head: true }).not('email', 'is', null),
    admin.from('leads').select('id', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({ pending: pending || 0, with_email: withEmail || 0, total: total || 0 });
}
