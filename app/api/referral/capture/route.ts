import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/referral/capture  { code }
 *
 * Called from the client right after a referred user signs up / first logs in,
 * passing the ref code that was stored in localStorage when they landed via a
 * referral link. When the body carries no code, the route falls back to the
 * `referral_code` the signup forms put into Supabase auth user_metadata, which
 * survives a device switch between clicking the invite and confirming the
 * email. Links the current customer to the referrer and creates a pending
 * referral. Idempotent: does nothing if the customer is already referred or
 * the code is invalid/self.
 *
 * DESIGN DECISION — registration is REQUIRED, guests are excluded on purpose
 * (confirmed by Diana, 2026-08-04). The referrer↔friend link is created only
 * here, behind requireAuth: a friend who buys as a guest never creates a
 * referral, and there is deliberately no back-fill when they register later.
 * Rationale: an email typed at guest checkout is unverified, so crediting
 * guest orders would let anyone farm the 50+50 ₴ bonus by "referring"
 * themselves with throwaway addresses; requiring a signed-up account makes
 * self-referral materially harder and makes the qualifying order auditable.
 * The customer-facing terms in the account cabinet («Запросити друга») state
 * this rule explicitly. Do NOT "fix" the guest gap without a product decision.
 */
export async function POST(request: Request) {
    const guard = await requireAuth();
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => ({} as any));
    const admin = getAdminClient();

    // The code normally rides in from the caller's localStorage. When it is
    // missing, fall back to the copy the signup forms wrote into Supabase auth
    // user_metadata: localStorage is per-browser, so a friend who clicked the
    // invite on desktop and confirmed their email on a phone arrives here with
    // nothing stored, and without this fallback their referral was lost.
    let rawCode: unknown = body?.code;
    if (!rawCode || typeof rawCode !== 'string') {
        const { data: authUser } = await admin.auth.admin.getUserById(guard.userId);
        const fromMetadata = (authUser?.user?.user_metadata as any)?.referral_code;
        if (typeof fromMetadata === 'string' && fromMetadata.trim()) rawCode = fromMetadata;
    }
    if (!rawCode || typeof rawCode !== 'string') {
        return NextResponse.json({ ok: false, reason: 'no_code' });
    }
    const refCode = rawCode.trim().toUpperCase();

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
