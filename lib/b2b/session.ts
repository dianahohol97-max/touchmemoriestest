import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import type { B2bRole, B2bStatus } from './config';

export interface B2bSession {
    isB2b: boolean;
    role: B2bRole | null;
    status: B2bStatus | null;
}

const EMPTY: B2bSession = { isB2b: false, role: null, status: null };

/**
 * Resolve the current authenticated user's B2B role + status.
 * Returns an empty (non-B2B) session for guests or regular customers.
 * Reads the session from the cookie-bound client, then looks up the
 * customer row with the service-role client.
 */
export async function getB2bSession(): Promise<B2bSession> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return EMPTY;

        const admin = getAdminClient();
        // customers link to auth either via auth_user_id or via id (legacy rows
        // where id was set to the auth user id). Match on either.
        const { data: customer } = await admin
            .from('customers')
            .select('b2b_role, b2b_status')
            .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
            .maybeSingle();

        if (!customer || !customer.b2b_role) return EMPTY;

        return {
            isB2b: customer.b2b_status === 'verified',
            role: (customer.b2b_role as B2bRole) ?? null,
            status: (customer.b2b_status as B2bStatus) ?? null,
        };
    } catch {
        return EMPTY;
    }
}
