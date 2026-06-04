//
// Server-side reader for the buffered EUR↔UAH rate.
//
// The rate lives in the `settings` table under key 'eur_rate' and is refreshed
// twice a month (1st & 15th) by /api/cron/update-exchange-rate from the NBU
// official rate, with a margin buffer applied. We store it in the DB (not a
// hardcoded constant) so it can move without a deploy and so each order can
// freeze the exact rate it was sold at.
//
// `value` shape: { rate, base_rate, buffer_pct, source, updated_at }
//   - rate      = buffered UAH-per-EUR actually used for display/freezing
//   - base_rate = raw NBU UAH-per-EUR (audit)
//   - buffer_pct= margin buffer applied to derive `rate` from `base_rate`
//
import { getAdminClient } from '@/lib/supabase/admin';
import { EXCHANGE_RATES } from '@/lib/i18n/currency';

export interface EurRateRecord {
  rate: number;
  base_rate: number;
  buffer_pct: number;
  source: string;
  updated_at: string;
}

// Light in-process cache so order submission / invoice creation don't hit the
// settings table on every request. The rate only changes twice a month.
let cache: { value: EurRateRecord; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getEurRateRecord(): Promise<EurRateRecord> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const fallback: EurRateRecord = {
    rate: EXCHANGE_RATES.EUR,
    base_rate: EXCHANGE_RATES.EUR,
    buffer_pct: 0,
    source: 'fallback_constant',
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = getAdminClient();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'eur_rate')
      .maybeSingle();

    const v = data?.value as Partial<EurRateRecord> | undefined;
    if (v && typeof v.rate === 'number' && v.rate > 0) {
      const value: EurRateRecord = {
        rate: v.rate,
        base_rate: typeof v.base_rate === 'number' ? v.base_rate : v.rate,
        buffer_pct: typeof v.buffer_pct === 'number' ? v.buffer_pct : 0,
        source: v.source || 'settings',
        updated_at: v.updated_at || new Date().toISOString(),
      };
      cache = { value, at: Date.now() };
      return value;
    }
  } catch (e) {
    console.warn('getEurRateRecord: settings read failed, using fallback', e);
  }

  cache = { value: fallback, at: Date.now() };
  return fallback;
}

/** Just the buffered UAH-per-EUR number. */
export async function getEurRate(): Promise<number> {
  return (await getEurRateRecord()).rate;
}

/** Invalidate the in-process cache (called by the cron after an update). */
export function clearEurRateCache(): void {
  cache = null;
}
