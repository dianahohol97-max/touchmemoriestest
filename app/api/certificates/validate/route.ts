import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { certReservationCutoffISO } from '@/lib/certificates/redeemCertificate';
import { clientIp, createRateLimiter } from '@/lib/security/guess-rate-limit';

export const dynamic = 'force-dynamic';

/*
 * Перебір коду тут коштує дорожче, ніж у промокодів, бо код сертифіката — це
 * гроші на пред'явника, а відповідь чесно каже і «дійсний», і на яку суму.
 *
 * Поки всі коди були 12-символьні випадкові, перебір був безнадійний. Із
 * друкованими сертифікатами в обіг зайшли короткі числові номери (13795 —
 * п'ять цифр, тобто сто тисяч комбінацій), і без обмеження весь діапазон
 * простукується за хвилини, після чого лишається піти на checkout і витратити
 * знайдене. Двадцять спроб на хвилину — це стеля, якої жодна жива людина з
 * папірцем у руках не дістане, а перебір стає марним.
 *
 * Лічильник у памʼяті інстансу, тож це подорожчання перебору, а не строга
 * квота — див. коментар у lib/security/guess-rate-limit.ts.
 */
const GUESSES = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function POST(req: NextRequest) {
  if (GUESSES.over(clientIp(req))) {
    return NextResponse.json(
      { valid: false, reason: 'rate_limited' },
      { status: 429 },
    );
  }

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
    .select('id, amount, certificate_type, product_name, valid_until, redeemed, reserved_order_id, reserved_at')
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
  // A live reservation means another pending order already applied this code
  // at checkout (reservations expire after 24h — see redeemCertificate.ts).
  if (cert.reserved_order_id && cert.reserved_at
      && new Date(cert.reserved_at).toISOString() >= certReservationCutoffISO()) {
    return NextResponse.json({ valid: false, reason: 'reserved' });
  }

  return NextResponse.json({
    valid: true,
    amount: cert.amount,
    type: cert.certificate_type,
    product_name: cert.product_name || null,
  });
}
