import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cookieClient = await createClient();
  const { data: { user } } = await cookieClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getAdminClient();

  const [customerRes, ordersRes, consentRes] = await Promise.all([
    admin.from('customers').select('*').eq('auth_user_id', user.id).maybeSingle(),
    admin.from('orders').select('id, order_number, total, items, order_status, payment_status, created_at').eq('customer_email', user.email).order('created_at', { ascending: false }),
    admin.from('consent_log').select('*').or(`customer_id.eq.${user.id},email.eq.${user.email}`).order('created_at', { ascending: false }),
  ]);

  // Факт вивантаження даних більше НЕ пишеться в consent_log (Diana,
  // 14.09.2026). Це подія аудиту, а не згода: людина нічого не дозволяла і
  // нічого не забирала, вона скористалася своїм правом. Рядок із
  // consent_type = 'data_export_requested' усе одно відхилявся CHECK-ом
  // таблиці, тож за весь час не записався жодного разу — прибрано, а не
  // полагоджено. Де фіксувати такі події, якщо знадобиться, — окреме рішення.
  const exportData = {
    exported_at: new Date().toISOString(),
    profile: customerRes.data || { email: user.email },
    orders: ordersRes.data || [],
    consent_history: consentRes.data || [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="my-data-touchmemories.json"',
    },
  });
}
