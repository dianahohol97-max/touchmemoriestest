import { getAdminClient } from '@/lib/supabase/admin';
import { planLimitBytes, getPlan } from './plans';

/**
 * How much gallery storage a photographer occupies right now, and what their
 * plan allows. Sizes come from photographer_gallery_photos.size_bytes, which
 * every upload path records, so no storage listing is needed.
 *
 * Purged galleries no longer hold files, but their rows are deleted by the
 * retention cron anyway, so summing all rows of the photographer's galleries
 * is exact.
 */
export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  planId: string;
  planName: string;
  /** 0–1, clamped; 1 means the cap is reached. */
  ratio: number;
  over: boolean;
}

export async function getStorageUsage(photographer: { id: string; plan?: string | null }): Promise<StorageUsage> {
  const admin = getAdminClient();
  const plan = getPlan(photographer.plan);
  const limitBytes = planLimitBytes(photographer.plan);

  const { data: galleries } = await admin
    .from('photographer_galleries')
    .select('id')
    .eq('photographer_id', photographer.id);
  const ids = (galleries || []).map(g => g.id);
  if (ids.length === 0) {
    return { usedBytes: 0, limitBytes, planId: plan.id, planName: plan.name, ratio: 0, over: false };
  }

  // One flat read of the sizes; a photographer has at most a few thousand
  // rows, and Postgres has no cheap SUM through PostgREST without a view.
  let usedBytes = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data: rows } = await admin
      .from('photographer_gallery_photos')
      .select('size_bytes')
      .in('gallery_id', ids)
      .range(from, from + PAGE - 1);
    if (!rows || rows.length === 0) break;
    for (const r of rows) usedBytes += r.size_bytes || 0;
    if (rows.length < PAGE) break;
  }

  return {
    usedBytes,
    limitBytes,
    planId: plan.id,
    planName: plan.name,
    ratio: limitBytes > 0 ? Math.min(1, usedBytes / limitBytes) : 0,
    over: usedBytes >= limitBytes,
  };
}

/** Guard for upload routes: refuse when the incoming file would exceed the
 *  plan's storage cap. Returns an error message or null. */
export async function checkQuota(
  photographer: { id: string; plan?: string | null },
  incomingBytes: number,
): Promise<string | null> {
  const usage = await getStorageUsage(photographer);
  if (usage.usedBytes + incomingBytes <= usage.limitBytes) return null;
  const plan = getPlan(photographer.plan);
  return `Досягнуто ліміт вашого тарифу «${plan.name}» — ${plan.storageGb} ГБ. Видаліть непотрібні галереї або перейдіть на більший тариф.`;
}
