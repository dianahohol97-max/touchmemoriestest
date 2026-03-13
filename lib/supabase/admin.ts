import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the Service Role key.
 * This should only be used in server-side API routes for admin operations.
 * Initializing inside the function prevents build-time crashes if environment 
 * variables are missing during static analysis.
 */
export function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase Admin environment variables are missing');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}
