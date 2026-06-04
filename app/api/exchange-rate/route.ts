import { NextResponse } from 'next/server';
import { getEurRate, getIntlShippingConfig } from '@/lib/i18n/exchangeRate';

export const dynamic = 'force-dynamic';

/**
 * Public, read-only pricing context for the storefront client: the buffered
 * EUR rate and the international shipping policy. The checkout uses these so
 * its displayed totals (markup, EUR conversion, free-shipping threshold) match
 * exactly what /api/orders/submit will charge. No secrets here.
 */
export async function GET() {
  try {
    const [rate, ship] = await Promise.all([getEurRate(), getIntlShippingConfig()]);
    return NextResponse.json(
      {
        rate,
        freeThresholdEur: ship.freeThresholdEur,
        flatFeeEur: ship.flatFeeEur,
      },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  }
}
