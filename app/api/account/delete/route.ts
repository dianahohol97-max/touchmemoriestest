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
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const ua = req.headers.get('user-agent') || null;

  // Anonymize customer record (preserve orders for tax compliance)
  await admin.from('customers').update({
    email: `deleted+${user.id}@touchmemories.deleted`,
    name: 'Deleted user',
    first_name: null,
    last_name: null,
    phone: null,
    consent_marketing_at: null,
  }).eq('auth_user_id', user.id);

  // Log deletion event
  await admin.from('consent_log').insert({
    customer_id: user.id,
    email: user.email,
    consent_type: 'account_deleted',
    granted: true,
    policy_version: 1,
    ip_address: ip,
    user_agent: ua,
    source: 'account_privacy',
  });

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
