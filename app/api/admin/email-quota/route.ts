import { NextResponse } from 'next/server';
import { requireStaff, requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { getEmailQuotaStatus } from '@/lib/email/quota';

export const dynamic = 'force-dynamic';

/**
 * Today's send budget, plus how much of the newsletter queue is still waiting.
 * Read by any staff member; only an admin may change the caps.
 */
export async function GET() {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const [quota, { count: queued }] = await Promise.all([
        getEmailQuotaStatus(),
        admin.from('email_campaign_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    return NextResponse.json({ quota, queued: queued || 0 });
}

export async function PATCH(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const patch: Record<string, number> = {};
    if (body?.daily_cap !== undefined) {
        const v = Number(body.daily_cap);
        if (!Number.isFinite(v) || v < 1 || v > 1000000) {
            return NextResponse.json({ error: 'Денний ліміт має бути числом від 1' }, { status: 400 });
        }
        patch.daily_cap = Math.floor(v);
    }
    if (body?.transactional_reserve !== undefined) {
        const v = Number(body.transactional_reserve);
        if (!Number.isFinite(v) || v < 0) {
            return NextResponse.json({ error: 'Резерв має бути числом від 0' }, { status: 400 });
        }
        patch.transactional_reserve = Math.floor(v);
    }
    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Нічого змінювати' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: current } = await admin
        .from('email_quota_config')
        .select('daily_cap, transactional_reserve')
        .eq('id', true)
        .maybeSingle();

    const cap = patch.daily_cap ?? (current as any)?.daily_cap ?? 300;
    const reserve = patch.transactional_reserve ?? (current as any)?.transactional_reserve ?? 120;
    // A reserve at or above the cap would leave marketing permanently at zero
    // and look like a silent failure rather than a setting.
    if (reserve >= cap) {
        return NextResponse.json({ error: 'Резерв має бути меншим за денний ліміт' }, { status: 400 });
    }

    const { error } = await admin
        .from('email_quota_config')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ quota: await getEmailQuotaStatus() });
}
