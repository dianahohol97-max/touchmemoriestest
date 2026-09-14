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

  // Видалення акаунта більше НЕ пишеться в consent_log (Diana, 14.09.2026).
  // Це подія аудиту, а не згода, і рядок із consent_type = 'account_deleted'
  // усе одно відхилявся CHECK-ом таблиці — за весь час не записався жодного
  // разу. Окрема іронія в тому, що запис про видалення лишав би пошту людини
  // в базі рівно тоді, коли вона попросила її прибрати.

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
