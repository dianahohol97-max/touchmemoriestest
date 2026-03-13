import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Running migration...');
    const query = `
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url text;
    ALTER TABLE public.products DROP COLUMN IF EXISTS price_per_page;
  `;

    const { data, error } = await supabase.rpc('exec', { query });

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log('Migration successful:', data);
}

run();
