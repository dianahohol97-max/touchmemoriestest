import { NextResponse } from 'next/server';
import { getB2bSession } from '@/lib/b2b/session';
import { getRoleConfig } from '@/lib/b2b/config';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/b2b/me  → { isB2b, role, status, discountPercent, categorySlugs, label, photographer? }
export async function GET() {
    const session = await getB2bSession();
    const cfg = getRoleConfig(session.role);

    // The gallery cabinet + public landing (photographers table) is open
    // self-service for ANY logged-in user — only the discount is gated on
    // B2B verification. Surface the cabinet for whoever owns one.
    let photographer: { cabinet_token: string; slug: string } | null = null;
    let loggedIn = false;
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            loggedIn = true;
            const admin = getAdminClient();
            const { data: customer } = await admin
                .from('customers')
                .select('id, email')
                .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
                .maybeSingle();
            const email = customer?.email || user.email || '';
            const conds = [
                customer ? `customer_id.eq.${customer.id}` : '',
                email ? `email.ilike.${email}` : '',
            ].filter(Boolean);
            if (conds.length) {
                const { data: ph } = await admin
                    .from('photographers')
                    .select('cabinet_token, slug, is_active')
                    .or(conds.join(','))
                    .maybeSingle();
                if (ph?.is_active) photographer = { cabinet_token: ph.cabinet_token, slug: ph.slug };
            }
        }
    } catch { /* the discount info must render even if the cabinet lookup fails */ }

    return NextResponse.json({
        isB2b: session.isB2b,
        role: session.role,
        status: session.status,
        discountPercent: session.isB2b && cfg ? cfg.discountPercent : 0,
        categorySlugs: cfg?.categorySlugs ?? [],
        label: cfg?.label ?? null,
        photographer,
        loggedIn,
    });
}
