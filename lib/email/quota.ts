import { getAdminClient } from '@/lib/supabase/admin';

export type EmailKind = 'transactional' | 'marketing';

/**
 * Thrown when the daily budget is spent. Callers looping over recipients should
 * catch this and STOP rather than continue — every further attempt would fail
 * the same way and only burn time.
 */
export class EmailQuotaError extends Error {
    readonly code = 'EMAIL_QUOTA_EXCEEDED';
    constructor(kind: EmailKind) {
        super(
            kind === 'marketing'
                ? 'Денний ліміт розсилки вичерпано. Решта листів піде завтра.'
                : 'Денний ліміт відправки листів вичерпано.',
        );
    }
}

/**
 * Reserve up to `count` sends against today's budget. Returns how many were
 * granted, which may be fewer than asked or zero.
 *
 * On a database failure the two kinds part ways deliberately. Transactional
 * mail fails OPEN — a customer must get proof of their order even if the
 * counter is briefly unreachable, and the risk is overshooting the cap by a
 * few. Marketing fails CLOSED, because a newsletter that ignores the budget is
 * exactly what starves the transactional reserve.
 */
export async function reserveEmailQuota(count: number, kind: EmailKind): Promise<number> {
    if (count <= 0) return 0;
    try {
        const admin = getAdminClient();
        const { data, error } = await admin.rpc('email_quota_reserve', { p_count: count, p_kind: kind });
        if (error) throw error;
        return Number(data) || 0;
    } catch (e: any) {
        console.error('[email-quota] reserve failed:', e?.message || e);
        return kind === 'transactional' ? count : 0;
    }
}

export interface EmailQuotaStatus {
    daily_cap: number;
    transactional_reserve: number;
    transactional_used: number;
    marketing_used: number;
    marketing_left: number;
    total_left: number;
}

export async function getEmailQuotaStatus(): Promise<EmailQuotaStatus | null> {
    try {
        const admin = getAdminClient();
        const { data, error } = await admin.rpc('email_quota_status');
        if (error) throw error;
        return (Array.isArray(data) ? data[0] : data) || null;
    } catch {
        return null;
    }
}
