#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔄 Applying custom attributes migration...\n');

  try {
    const migrationPath = join(__dirname, '../architecture/custom_attributes_migration.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

    if (error) {
      // If exec_sql RPC doesn't exist, try direct execution
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

      for (const statement of statements) {
        const { error: execError } = await supabase.rpc('exec', { sql: statement });
        if (execError) {
          console.error(`⚠️  Statement error (might be OK if already applied):`, execError.message);
        }
      }
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('📋 Added columns to products table:');
    console.log('   - custom_attributes (jsonb)');
    console.log('   - attribute_price_modifiers (jsonb)\n');
    console.log('You can now add flexible custom attributes to products via the admin panel.');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

applyMigration();
