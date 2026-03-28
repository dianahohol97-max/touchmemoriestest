import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null;

export const getAdminClient = () => {
    if (!_client) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && key) {
            _client = createClient(url, key);
        } else {
            console.error('[Supabase Admin] MISSING ENV:', { hasUrl: !!url, hasKey: !!key });
        }
    }
    return _client!;
}

// Backward compat
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        return (getAdminClient() as any)[prop];
    }
});
