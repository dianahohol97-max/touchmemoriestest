import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE TABLE IF NOT EXISTS staff_work_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    action TEXT CHECK (action IN ('assigned_manager', 'assigned_designer', 'status_changed', 'completed')),
    old_status TEXT,
    new_status TEXT,
    logged_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS salary_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    orders_managed INT DEFAULT 0,
    orders_designed INT DEFAULT 0,
    base_amount NUMERIC DEFAULT 0,
    bonus_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE staff_work_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_periods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated full access to staff_work_log" ON staff_work_log;
    DROP POLICY IF EXISTS "Allow authenticated full access to salary_periods" ON salary_periods;

    CREATE POLICY "Allow authenticated full access to staff_work_log" ON staff_work_log FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated full access to salary_periods" ON salary_periods FOR ALL TO authenticated USING (true);
END $$;
`;

async function run() {
    console.log("Adding salary tables...");

    // We can use an edge function, or a pg query if available, but since we don't have direct SQL exec via supabase js by default,
    // actually, let's use the local 'supabase' CLI instead to run the database push or execute the SQL file! Wait, the postgres connection is better. 
    // It's probably easier to just execute SQL via a secure proxy or create a temporary function.
    // Let's create an RPC or just execute via shell \`psql\`. 
}
run();
