import fetch from 'node-fetch';

const SUPABASE_URL = 'https://yivfsicvaoewxrtkrfxr.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpdmZzaWN2YW9ld3hydGtyZnhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwNzMxNzQwMCwiZXhwIjoyMDIyODkzNDAwfQ.jWKQx5P-VH5wvLVGhZE3bQx0L6yJ9vZX8kY7nN4qP2M';

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

  // 3-5. Add columns to products
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS has_designer_option BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS designer_service_price NUMERIC(10, 2) DEFAULT 500`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS max_free_revisions INTEGER DEFAULT 2`,

  // 6-8. Add columns to orders
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS with_designer BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS designer_service_fee NUMERIC(10, 2) DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS brief_token UUID`,

  // 9-13. Create indexes
  `CREATE INDEX IF NOT EXISTS idx_design_briefs_order ON design_briefs(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_design_briefs_token ON design_briefs(token)`,
  `CREATE INDEX IF NOT EXISTS idx_design_briefs_status ON design_briefs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_design_revisions_order ON design_revisions(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_design_revisions_token ON design_revisions(client_token)`,

  // 14-15. Enable RLS
  `ALTER TABLE design_briefs ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE design_revisions ENABLE ROW LEVEL SECURITY`,

  // 16. Update product
  `UPDATE products SET has_designer_option = true, designer_service_price = 500, max_free_revisions = 2 WHERE slug = 'classic-photobook-20x20'`,
];

async function runQuery(query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query }),
  });

  return response;
}

async function setup() {
  console.log('🚀 Setting up Designer Service tables...\n');

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const preview = query.substring(0, 60).replace(/\n/g, ' ').replace(/\s+/g, ' ');

    try {
      const response = await runQuery(query);

      if (response.ok) {
        console.log(`✅ ${i + 1}/${queries.length} ${preview}...`);
      } else {
        const error = await response.text();
        console.log(`⚠️  ${i + 1}/${queries.length} ${preview}...`);
        console.log(`   (${response.status}) Will continue...`);
      }
    } catch (err) {
      console.log(`⚠️  ${i + 1}/${queries.length} ${preview}...`);
      console.log(`   Error: ${err.message}`);
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Setup complete!');
  console.log('='.repeat(70));
  console.log('\n📍 Next step: Open this URL in your browser:');
  console.log('   http://localhost:3000/catalog/photobooks/classic-photobook-20x20\n');
  console.log('   You should see: ✨ Послуга дизайнера "Зроби за мене" (+500 грн)\n');
}

setup().catch(console.error);
