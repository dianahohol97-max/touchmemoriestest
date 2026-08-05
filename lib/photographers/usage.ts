import { getAdminClient } from '@/lib/supabase/admin';
import { planLimitBytes, getPlan, effectivePlanId } from './plans';

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
  /** True when photographers.storage_limit_mb overrides the plan's cap. */
  limitOverridden?: boolean;
}

/** The photographer this function needs — the plan fields plus the manual cap. */
type UsageSubject = {
  id: string;
  plan?: string | null;
  plan_expires_at?: string | null;
  storage_limit_mb?: number | null;
};

export async function getStorageUsage(photographer: UsageSubject): Promise<StorageUsage> {
  const admin = getAdminClient();
  // A paid plan that ran out counts as free — see effectivePlanId.
  const planId = effectivePlanId(photographer);
  const plan = getPlan(planId);
  // A manual cap on the account wins over the plan's. Used to test the
  // "storage full" flow without uploading gigabytes, and to grant an
  // exception without inventing a fake paid plan.
  const override = photographer.storage_limit_mb;
  const limitOverridden = typeof override === 'number' && override > 0;
  const limitBytes = limitOverridden ? override * 1024 * 1024 : planLimitBytes(planId);

  const { data: galleries } = await admin
    .from('photographer_galleries')
    .select('id')
    .eq('photographer_id', photographer.id);
  const ids = (galleries || []).map(g => g.id);
  if (ids.length === 0) {
    return { usedBytes: 0, limitBytes, planId: plan.id, planName: plan.name, ratio: 0, over: false, limitOverridden };
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
    limitOverridden,
  };
}

/** Human size for quota messages: МБ below a gigabyte, ГБ above it. */
function human(bytes: number): string {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(gb < 10 ? 1 : 0)} ГБ`;
  return `${Math.max(1, Math.round(bytes / (1024 ** 2)))} МБ`;
}

/** Guard for upload routes: refuse when the incoming file would exceed the
 *  plan's storage cap. Returns an error message or null. */
export async function checkQuota(
  photographer: UsageSubject,
  incomingBytes: number,
): Promise<string | null> {
  const usage = await getStorageUsage(photographer);
  if (usage.usedBytes + incomingBytes <= usage.limitBytes) return null;
  const plan = getPlan(effectivePlanId(photographer));
  // Show what is actually occupied out of what is actually allowed — the old
  // wording printed the plan size twice, so it read «зайнято 4 ГБ з 4 ГБ»
  // even when the account was nearly empty and a single huge file was the
  // reason for the refusal.
  return `Місце на тарифі «${plan.name}» закінчилося — зайнято ${human(usage.usedBytes)} з ${human(usage.limitBytes)}. Оберіть більший тариф у кабінеті або видаліть непотрібні галереї.`;
}
