import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('[Supabase Admin] Environment check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING'
});

// On the client, supabaseKey will be undefined.
// We should only initialize and export if we have both,
// otherwise return a proxy or handle it gracefully to avoid crashing on import.
if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase Admin] MISSING ENV VARS:', {
        NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!supabaseKey
    });
}

export const supabaseAdmin = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null as any;

export const getAdminClient = () => {
    if (!supabaseAdmin) {
        console.error('[Supabase Admin] Client is NULL - environment variables missing!');
    }
    return supabaseAdmin;
}
