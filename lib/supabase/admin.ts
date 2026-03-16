import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// On the client, supabaseKey will be undefined. 
// We should only initialize and export if we have both, 
// otherwise return a proxy or handle it gracefully to avoid crashing on import.
export const supabaseAdmin = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null as any;

export const getAdminClient = () => supabaseAdmin
