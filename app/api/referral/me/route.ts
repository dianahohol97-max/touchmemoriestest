import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureReferralCode, REFERRAL_REWARD, REFERRAL_MIN_ORDER } from '@/lib/referral/referral';

export const dynamic = 'force-dynamic';

// GET /api/referral/me → { code, link, bonusBalance, invitedCount, rewardedCount, earned }
export async function GET(request: Request) {
    const guard = await requireAuth();
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();

    // Resolve the customer row for this auth user (id or auth_user_id).
    const { data: customer } = await admin
        .from('customers')
        .select('id, bonus_balance, referral_code')
        .or(`auth_user_id.eq.${guard.userId},id.eq.${guard.userId}`)
        .maybeSingle();

    if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const code = customer.referral_code || await ensureReferralCode(admin, customer.id);

    // Referral stats
    const { count: invitedCount } = await admin
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', customer.id);
    const { count: rewardedCount } = await admin
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', customer.id)
        .eq('status', 'rewarded');

    const origin = new URL(request.url).origin;
    const link = code ? `${origin}/?ref=${code}` : null;

    return NextResponse.json({
        code,
        link,
        bonusBalance: Number(customer.bonus_balance || 0),
        invitedCount: invitedCount ?? 0,
        rewardedCount: rewardedCount ?? 0,
        earned: (rewardedCount ?? 0) * REFERRAL_REWARD,
        reward: REFERRAL_REWARD,
        minOrder: REFERRAL_MIN_ORDER,
    });
}
