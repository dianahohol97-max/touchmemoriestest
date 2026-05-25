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

  await admin.from('consent_log').insert({
    customer_id: user.id,
    email: user.email,
    consent_type: granted ? 'marketing_accepted' : 'marketing_withdrawn',
    granted,
    policy_version: 1,
    ip_address: ip,
    user_agent: ua,
    source: 'account_privacy',
  });

  return NextResponse.json({ ok: true });
}
