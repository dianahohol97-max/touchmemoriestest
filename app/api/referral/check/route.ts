import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { REFERRAL_FRIEND_REWARD, REFERRAL_MIN_ORDER } from '@/lib/referral/referral';

export const dynamic = 'force-dynamic';

/**
 * GET /api/referral/check?code=ABC12345 → { referral: boolean, ... }
 *
 * Public, and deliberately says nothing except whether the code belongs to a
 * customer referral. The invite banner needs this because ?ref= is overloaded:
 * the very same parameter also carries AGENCY and blog promo codes, which give
 * a discount rather than a friend bonus. Showing «Вас запросив друг» to someone
 * who arrived on an agency link would simply be a lie, so the banner asks here
 * first and stays hidden for anything that is not a referral code.
 *
 * No referrer identity is ever returned — only the boolean and the public terms
 * — so this cannot be used to look up who owns a code.
 */
export async function GET(request: Request) {
    const raw = new URL(request.url).searchParams.get('code');
    const code = raw?.trim().toUpperCase() || '';
    // The generator uses an unambiguous 8-char A-Z2-9 alphabet; anything that
    // can't be one of ours is rejected before it reaches the database.
    if (!/^[A-Z0-9]{4,16}$/.test(code)) {
        return NextResponse.json({ referral: false });
    }

    const admin = getAdminClient();
    const { data } = await admin
        .from('customers')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle();

    return NextResponse.json({
        referral: !!data,
        friendReward: REFERRAL_FRIEND_REWARD,
        minOrder: REFERRAL_MIN_ORDER,
    });
}
