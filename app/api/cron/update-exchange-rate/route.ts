import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { clearEurRateCache } from '@/lib/i18n/exchangeRate';

export const dynamic = 'force-dynamic';

// NBU official rate directory. Free, no key. Returns UAH per 1 EUR.
const NBU_EUR_URL =
  'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=EUR&json';

/**
 * Refresh the buffered EUR↔UAH rate stored in settings('eur_rate').
 *
 * Scheduled twice a month (1st & 15th) via vercel.json so storefront prices in
 * EUR change on predictable dates rather than drifting daily — this is the
 * "раз на 2 тижні" cadence Diana asked for.
 *
 * Buffer: we keep the existing buffer_pct from settings and apply it so the
 * displayed EUR price is slightly conservative (protects margin against UAH
 * strengthening between refreshes). buffered = base × (1 - buffer_pct/100).
 * Set buffer_pct = 0 in settings to track NBU exactly.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();

  try {
    // Preserve the operator-configured buffer.
    const { data: current } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'eur_rate')
      .maybeSingle();
    const bufferPct =
      typeof (current?.value as any)?.buffer_pct === 'number'
        ? (current!.value as any).buffer_pct
        : 0;

    const res = await fetch(NBU_EUR_URL, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `NBU API ${res.status}` },
        { status: 502 },
      );
    }
    const rows = (await res.json()) as Array<{ rate?: number; cc?: string }>;
    const baseRate = rows.find((r) => r.cc === 'EUR')?.rate ?? rows[0]?.rate;

    if (!baseRate || !Number.isFinite(baseRate) || baseRate <= 0) {
      return NextResponse.json({ error: 'NBU rate missing/invalid' }, { status: 502 });
    }

    const buffered = Math.round(baseRate * (1 - bufferPct / 100) * 10000) / 10000;

    const value = {
      rate: buffered,
      base_rate: baseRate,
      buffer_pct: bufferPct,
      source: 'nbu',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'eur_rate', value }, { onConflict: 'key' });
    if (error) throw error;

    clearEurRateCache();
    console.log('[Cron] EUR rate updated', value);
    return NextResponse.json({ success: true, ...value });
  } catch (err: any) {
    console.error('[Cron] update-exchange-rate failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 },
    );
  }
}
