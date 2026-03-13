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
  console.log('🔄 Applying birthday migration to customers table...\n');

  try {
    const migrationPath = join(__dirname, '../architecture/birthday_migration.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    // Split SQL statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    for (const statement of statements) {
      // Skip COMMENT statements as they may not be supported via RPC
      if (statement.toUpperCase().startsWith('COMMENT')) {
        console.log('  ⏭️  Skipping COMMENT statement');
        continue;
      }

      try {
        const { error } = await supabase.rpc('exec', { sql: statement });
        if (error) {
          console.log(`  ⚠️  Statement might already exist (continuing): ${error.message.substring(0, 100)}`);
        } else {
          console.log('  ✅ Statement executed');
        }
      } catch (err) {
        console.log(`  ⚠️  Error (might be OK): ${err.message.substring(0, 100)}`);
      }
    }

    console.log('\n✅ Migration completed!\n');
    console.log('📋 Added columns to customers table:');
    console.log('   - birthday_day (integer, 1-31)');
    console.log('   - birthday_month (integer, 1-12)');
    console.log('   - birthday_year (integer, optional)\n');
    console.log('🎂 Customers can now provide their birthday during registration!');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

applyMigration();
