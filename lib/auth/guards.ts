import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Auth guards for API routes.
 *
 * Use these at the top of every protected route — including any handler that
 * calls getAdminClient() and accepts user input (path params, body, query).
 *
 * `requireAdmin` returns the authenticated user's id if they are an admin
 * (or staff with role='admin'); otherwise it returns a 401/403 NextResponse
 * that the caller should `return` immediately.
 *
 * `requireAuth` returns the authenticated user's id if any session exists;
 * otherwise a 401 NextResponse to return.
 *
 * `requireOwnerOrAdmin` requires the user to either own a given resource
 * (caller passes in the customer_id of the resource) or be an admin.
 *
 * All three rely on the cookie-bound supabase client to read the session,
 * not the service-role admin client (which would bypass auth entirely).
 */

type Guard = { ok: true; userId: string } | { ok: false; response: NextResponse };

async function getSession() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { supabase, user };
}

export async function requireAuth(): Promise<Guard> {
    const { user } = await getSession();
    if (!user) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    return { ok: true, userId: user.id };
}

export async function requireAdmin(): Promise<Guard> {
    const { user } = await getSession();
    if (!user) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    // Admin if either:
    //   - email matches admin_users.email
    //     (admin_users has its own UUID, NOT the auth.users.id, so we match by email)
    //   - staff row exists with role='admin'
    const admin = getAdminClient();
    const email = user.email;

    if (email) {
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        if (adminRow) return { ok: true, userId: user.id };

        const { data: staffRow } = await admin
            .from('staff')
            .select('id, role')
            .eq('email', email)
            .maybeSingle();
        if (staffRow && (staffRow as any).role === 'admin') {
            return { ok: true, userId: user.id };
        }
    }

    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}

/**
 * Require either admin OR ownership of a customer record (i.e. the calling
 * user's customers.auth_user_id matches the given customer id).
 */
export async function requireOwnerOrAdmin(customerId: string | null): Promise<Guard> {
    const { user } = await getSession();
    if (!user) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const admin = getAdminClient();
    const email = user.email;

    // Admin path (match by email, since admin_users.id is not auth.users.id)
    if (email) {
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        if (adminRow) return { ok: true, userId: user.id };
    }

    // Ownership path
    if (customerId) {
        const { data: customerRow } = await admin
            .from('customers')
            .select('id')
            .eq('id', customerId)
            .eq('auth_user_id', user.id)
            .maybeSingle();
        if (customerRow) return { ok: true, userId: user.id };
    }

    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}
