import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { code?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ valid: false, reason: 'invalid_request' }, { status: 400 }); }

  const code = (body?.code || '').trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{4,16}$/.test(code)) {
    return NextResponse.json({ valid: false, reason: 'invalid_format' }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: cert, error } = await admin
    .from('certificates')
    .select('id, amount, certificate_type, product_name, valid_until, redeemed')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('certificates/validate lookup error:', error);
    return NextResponse.json({ valid: false, reason: 'server_error' }, { status: 500 });
  }
  if (!cert) return NextResponse.json({ valid: false, reason: 'not_found' });
  if (cert.redeemed) return NextResponse.json({ valid: false, reason: 'redeemed' });
  if (cert.valid_until && new Date(cert.valid_until) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' });
  }

  return NextResponse.json({
    valid: true,
    amount: cert.amount,
    type: cert.certificate_type,
    product_name: cert.product_name || null,
  });
}
