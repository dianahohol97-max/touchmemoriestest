import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeInstagram } from '@/lib/leads/contacts';

/**
 * Хто привів партнера, який зареєструвався сам (Diana, 2026-08-06).
 *
 * Частина партнерів приходить не через менеджера, а через форму на сайті або
 * через власний кабінет фотографа. Менеджер при цьому міг місяць вести цю
 * студію в директі — але в момент реєстрації система про нього не знала
 * нічого, партнер створювався з порожнім sales_manager_id, і робота менеджера
 * не приносила йому нічого.
 *
 * Тепер кожен шлях створення партнера спершу шукає лід із тими самими
 * контактами. Знайшли лід із менеджером — менеджер записується автоматично.
 * Привʼязка лишається зворотною: у списку партнерів в адмінці менеджера видно
 * і можна змінити.
 */

export interface LeadAttribution {
  leadId: string;
  managerId: string;
  managerName: string | null;
  leadCreatedAt: string;
  matchedBy: 'email' | 'instagram';
}

/**
 * Шукає лід менеджера за контактами майбутнього партнера. website перевіряємо
 * теж: у формі на сайті люди часто дають саме посилання на Instagram, і воно
 * приводиться до нікнейма тим самим правилом, що й поле instagram.
 */
export async function findLeadAttribution(
  admin: SupabaseClient,
  contacts: { email?: string | null; instagram?: string | null; website?: string | null },
): Promise<LeadAttribution | null> {
  const email = String(contacts.email || '').trim().toLowerCase();
  const handles = [contacts.instagram, contacts.website]
    .map(normalizeInstagram)
    .filter((h): h is string => Boolean(h));

  const attempts: { column: string; value: string; matchedBy: 'email' | 'instagram' }[] = [];
  if (email) attempts.push({ column: 'email', value: email, matchedBy: 'email' });
  handles.forEach(h => attempts.push({ column: 'instagram', value: h, matchedBy: 'instagram' }));

  for (const attempt of attempts) {
    const { data: lead } = await admin
      .from('leads')
      .select('id, created_at, sales_manager_id')
      .ilike(attempt.column, attempt.value)
      .not('sales_manager_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!lead?.sales_manager_id) continue;

    // Неактивного менеджера не зараховуємо: він уже не працює, а комісія
    // нараховувалась би далі.
    const { data: manager } = await admin
      .from('sales_managers')
      .select('id, name, is_active')
      .eq('id', lead.sales_manager_id)
      .maybeSingle();
    if (!manager?.is_active) continue;

    return {
      leadId: lead.id,
      managerId: manager.id,
      managerName: manager.name || null,
      leadCreatedAt: lead.created_at,
      matchedBy: attempt.matchedBy,
    };
  }
  return null;
}

/**
 * Записує менеджера партнеру, який уже існує, і всьому, що з ним повʼязано:
 * рядку фотографа (з нього йде комісія з тарифів памʼяті) та ліду, який стає
 * закритою угодою. Чужу привʼязку не чіпає — перезаписати менеджера може
 * тільки адміністратор у списку партнерів.
 */
export async function attachManagerToPartner(
  admin: SupabaseClient,
  opts: { partnerId: string; managerId: string; email?: string | null; leadId?: string | null },
) {
  await admin
    .from('agency_partners')
    .update({ sales_manager_id: opts.managerId })
    .eq('id', opts.partnerId)
    .is('sales_manager_id', null);

  if (opts.email) {
    const { data: photographer } = await admin
      .from('photographers')
      .select('id, sales_manager_id')
      .ilike('email', opts.email)
      .maybeSingle();
    if (photographer && !photographer.sales_manager_id) {
      await admin.from('photographers')
        .update({ sales_manager_id: opts.managerId })
        .eq('id', photographer.id);
    }
  }

  if (opts.leadId) {
    await admin.from('leads')
      .update({ status: 'won', updated_at: new Date().toISOString() })
      .eq('id', opts.leadId);
  }
}

/**
 * Слід в історії заявок: хто, кого і коли зарахував собі без окремого
 * підтвердження. Рядок одразу 'approved' — це не черга на рішення, а журнал,
 * який видно в адмінці серед опрацьованих заявок.
 */
export async function logAttributionClaim(
  admin: SupabaseClient,
  row: {
    leadId?: string | null; managerId: string; partnerId: string;
    businessName: string; email: string; comment?: string | null;
  },
) {
  await admin.from('partner_activation_requests').insert({
    kind: 'claim',
    lead_id: row.leadId || null,
    manager_id: row.managerId,
    partner_id: row.partnerId,
    business_name: row.businessName,
    email: row.email,
    comment: row.comment || null,
    status: 'approved',
    decided_at: new Date().toISOString(),
  });
}
