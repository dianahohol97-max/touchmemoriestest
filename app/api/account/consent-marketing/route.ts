import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cookieClient = await createClient();
  const { data: { user } } = await cookieClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { granted } = await req.json();
  const admin = getAdminClient();

  await admin.from('customers').update({
    consent_marketing_at: granted ? new Date().toISOString() : null,
  }).eq('auth_user_id', user.id);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const ua = req.headers.get('user-agent') || null;

  // consent_type і source мусять збігатися з CHECK-обмеженнями таблиці:
  // дозволені лише назви категорій ('marketing') і чотири джерела
  // ('web' / 'mobile' / 'api' / 'admin'). Раніше сюди йшли 'marketing_accepted'
  // і 'account_privacy', тож кожна вставка відхилялася, помилку ніхто не читав,
  // а відповідь була успішна — за весь час у журналі не зʼявилося жодного
  // рядка. Сам факт «згоду дали чи забрали» тепер несе granted, а не назва
  // типу; звідки саме прийшла дія, видно з customer_id і часу.
  //
  // customer_id має FK на customers(id), тож перевіряємо, що рядок клієнта
  // існує: неіснуючий id відхилив би вставку так само тихо, як раніше.
  const { data: known } = await admin.from('customers').select('id').eq('id', user.id).maybeSingle();

  const { error } = await admin.from('consent_log').insert({
    customer_id: known ? user.id : null,
    email: user.email,
    consent_type: 'marketing',
    granted,
    policy_version: '1.0',
    ip_address: ip,
    user_agent: ua,
    source: 'web',
  });

  // Журнал згод — це доказ, тож мовчати про його відмову не можна: сторінка
  // «Мої дані» показує клієнтові саме цю історію.
  if (error) {
    console.error('[consent-marketing] consent_log insert failed', { error: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
