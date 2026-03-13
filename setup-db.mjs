import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runSQL() {
  console.log('🚀 Creating Designer Service tables...\n');

  // Create tables one by one
  const queries = [
    // 1. Create design_briefs table
    `CREATE TABLE IF NOT EXISTS design_briefs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL,
      token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
      occasion TEXT,
      style_preference TEXT,
      important_photos TEXT,
      title_text TEXT,
      additional_notes TEXT,
      photo_order TEXT,
      is_gift BOOLEAN DEFAULT FALSE,
      photos_count INTEGER DEFAULT 0,
      photos_folder TEXT,
      photos_metadata JSONB DEFAULT '[]'::JSONB,
      status TEXT DEFAULT 'waiting_brief',
      ai_draft_project_id UUID,
      ai_analysis_result JSONB,
      ai_layout_plan JSONB,
      ai_error TEXT,
      submitted_at TIMESTAMPTZ,
      ai_processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 2. Create design_revisions table
    `CREATE TABLE IF NOT EXISTS design_revisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL,
      revision_number INTEGER NOT NULL,
      project_id UUID NOT NULL,
      client_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
      sent_to_client_at TIMESTAMPTZ,
      reviewed_at TIMESTAMPTZ,
      client_decision TEXT,
      client_comments JSONB DEFAULT '[]'::JSONB,
      general_feedback TEXT,
      designer_notes TEXT,
      revision_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 3. Add columns to products
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS has_designer_option BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS designer_service_price NUMERIC(10, 2) DEFAULT 500`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS max_free_revisions INTEGER DEFAULT 2`,

    // 4. Add columns to orders
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS with_designer BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS designer_service_fee NUMERIC(10, 2) DEFAULT 0`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS brief_token UUID`,

    // 5. Enable RLS
    `ALTER TABLE design_briefs ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE design_revisions ENABLE ROW LEVEL SECURITY`,

    // 6. Update a product to have designer option
    `UPDATE products SET has_designer_option = true, designer_service_price = 500, max_free_revisions = 2 WHERE slug = 'classic-photobook-20x20'`,
  ];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const preview = query.substring(0, 50).replace(/\s+/g, ' ');

    try {
      const { error } = await supabase.rpc('exec', { query });

      if (error) {
        console.log(`❌ ${i + 1}. ${preview}...`);
        console.log(`   Error: ${error.message}\n`);
      } else {
        console.log(`✅ ${i + 1}. ${preview}...`);
      }
    } catch (err) {
      console.log(`⚠️  ${i + 1}. ${preview}... (will continue)`);
    }
  }

  console.log('\n✅ Setup complete! Check the results above.\n');
  console.log('📍 Next: Open http://localhost:3000/catalog/photobooks/classic-photobook-20x20');
  console.log('   You should see the designer service checkbox!\n');
}

runSQL();
