import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cookieClient = await createClient();
  const { data: { user } } = await cookieClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email } = await req.json();
  if (email !== user.email) {
    return NextResponse.json({ error: 'Email does not match' }, { status: 400 });
  }

  const admin = getAdminClient();

  // Anonymize customer record (preserve orders for tax compliance)
  await admin.from('customers').update({
    email: `deleted+${user.id}@touchmemories.deleted`,
    name: 'Deleted user',
    first_name: null,
    last_name: null,
    phone: null,
    consent_marketing_at: null,
  }).eq('auth_user_id', user.id);

  // Подія аудиту йде в account_audit_log — БЕЗ будь-якого посилання на людину.
  // Тут лише те, що видалення сталося, і коли. Ні пошти, ні customer_id:
  // зберігати ідентифікатор у рядку про прохання стерти дані означало б робити
  // протилежне до проханого, і саме так поводився старий запис у consent_log.
  // Заборона структурна — CHECK таблиці не дасть записати customer_id для цієї
  // події, навіть якщо хтось колись спробує.
  //
  // Яке саме замовлення на видалення виконано, доводить не журнал, а стан
  // акаунта: рядок customers знеособлюється нижче.
  const { error: auditError } = await admin.from('account_audit_log').insert({
    event_type: 'account_deletion',
  });
  if (auditError) console.error('[account-delete] audit log insert failed (deletion unaffected)', { error: auditError.message });

  // Ban user from logging in again (set banned_until to far future)
  try {
    await admin.auth.admin.updateUserById(user.id, {
      ban_duration: '876000h',
    });
  } catch (e) {
    console.error('Failed to ban deleted user:', e);
  }

  return NextResponse.json({ ok: true });
}
