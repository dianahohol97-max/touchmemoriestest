const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDesignerService() {
  console.log('🚀 Setting up Designer Service...\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, 'lib/supabase/schema/designer-service.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    const preview = statement.substring(0, 60).replace(/\s+/g, ' ');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try direct query for simpler statements
        const { error: directError } = await supabase.from('_').select('*').limit(0);

        console.log(`❌ Statement ${i + 1}: ${preview}...`);
        console.log(`   Error: ${error.message}\n`);
        errorCount++;
      } else {
        console.log(`✅ Statement ${i + 1}: ${preview}...`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ Statement ${i + 1}: ${preview}...`);
      console.log(`   Error: ${err.message}\n`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));

  if (errorCount === 0) {
    console.log('\n🎉 Designer Service setup complete!\n');
    console.log('Next steps:');
    console.log('1. Enable designer option on a product');
    console.log('2. Visit product page and see the checkbox');
    console.log('3. Test the full workflow\n');
  } else {
    console.log('\n⚠️  Some errors occurred. You may need to run the SQL manually in Supabase Dashboard.\n');
  }
}

setupDesignerService().catch(console.error);
