import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/referral/capture  { code }
 *
 * Called from the client right after a referred user signs up / first logs in,
 * passing the ref code that was stored in localStorage when they landed via a
 * referral link. Links the current customer to the referrer and creates a
 * pending referral. Idempotent: does nothing if the customer is already
 * referred or the code is invalid/self.
 */
export async function POST(request: Request) {
    const guard = await requireAuth();
    if (!guard.ok) return guard.response;

    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
        return NextResponse.json({ ok: false, reason: 'no_code' });
    }
    const refCode = code.trim().toUpperCase();

    const admin = getAdminClient();

    // Current customer
    const { data: me } = await admin
        .from('customers')
        .select('id, email, referred_by')
        .or(`auth_user_id.eq.${guard.userId},id.eq.${guard.userId}`)
        .maybeSingle();
    if (!me) return NextResponse.json({ ok: false, reason: 'no_customer' });

    // Already referred? Don't overwrite.
    if (me.referred_by) return NextResponse.json({ ok: false, reason: 'already_referred' });

    // Already have a referral row (pending or rewarded)?
    const { data: existing } = await admin
        .from('referrals')
        .select('id')
        .eq('referred_id', me.id)
        .maybeSingle();
    if (existing) return NextResponse.json({ ok: false, reason: 'already_exists' });

    // Find referrer by code
    const { data: referrer } = await admin
        .from('customers')
        .select('id, email')
        .eq('referral_code', refCode)
        .maybeSingle();
    if (!referrer) return NextResponse.json({ ok: false, reason: 'unknown_code' });
    if (referrer.id === me.id || referrer.email?.toLowerCase() === me.email?.toLowerCase()) {
        return NextResponse.json({ ok: false, reason: 'self' });
    }

    await admin.from('customers').update({ referred_by: referrer.id }).eq('id', me.id);
    await admin.from('referrals').insert({
        referrer_id: referrer.id,
        referred_id: me.id,
        referred_email: me.email,
        status: 'pending',
    });

    return NextResponse.json({ ok: true });
}
