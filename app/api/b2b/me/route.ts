import { NextResponse } from 'next/server';
import { getB2bSession } from '@/lib/b2b/session';
import { getRoleConfig } from '@/lib/b2b/config';

export const dynamic = 'force-dynamic';

// GET /api/b2b/me  → { isB2b, role, status, discountPercent, categorySlugs, label }
export async function GET() {
    const session = await getB2bSession();
    const cfg = getRoleConfig(session.role);

    return NextResponse.json({
        isB2b: session.isB2b,
        role: session.role,
        status: session.status,
        discountPercent: session.isB2b && cfg ? cfg.discountPercent : 0,
        categorySlugs: cfg?.categorySlugs ?? [],
        label: cfg?.label ?? null,
    });
}
