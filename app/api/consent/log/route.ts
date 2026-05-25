import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { action?: string; categories?: Record<string, boolean> };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const action = body?.action || 'unknown';
  const categories = body?.categories || {};

  let customerId: string | null = null;
  let email: string | null = null;
  try {
    const cookieClient = await createClient();
    const { data: { user } } = await cookieClient.auth.getUser();
    if (user) {
      customerId = user.id;
      email = user.email || null;
    }
  } catch {}

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const ua = req.headers.get('user-agent') || null;

  const admin = getAdminClient();
  await admin.from('consent_log').insert({
    customer_id: customerId,
    email,
    consent_type: action,
    granted: action !== 'cookies_rejected',
    policy_version: 1,
    ip_address: ip,
    user_agent: ua,
    source: 'cookie_banner',
    metadata: categories,
  });

  return NextResponse.json({ ok: true });
}
