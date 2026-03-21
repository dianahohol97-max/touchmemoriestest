-- Gift Collections Feature
-- Manage gift idea collections (ДЛЯ НЕЇ, ДЛЯ НЬОГО, etc.) from admin panel

-- Step 1: Create gift_collections table
CREATE TABLE IF NOT EXISTS gift_collections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,         -- e.g. "for-her", "for-him"
  label text NOT NULL,               -- Display label
  label_uk text NOT NULL,            -- Ukrainian label
  emoji text,                        -- Optional emoji icon
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Create gift_collection_items join table
CREATE TABLE IF NOT EXISTS gift_collection_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid REFERENCES gift_collections(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collection_id, product_id)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gift_collections_slug ON gift_collections(slug);
CREATE INDEX IF NOT EXISTS idx_gift_collections_active ON gift_collections(is_active);
CREATE INDEX IF NOT EXISTS idx_gift_collections_sort ON gift_collections(sort_order);
CREATE INDEX IF NOT EXISTS idx_gift_collection_items_collection ON gift_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_gift_collection_items_product ON gift_collection_items(product_id);

-- Step 4: Seed initial gift collections
INSERT INTO gift_collections (slug, label, label_uk, emoji, sort_order, is_active) VALUES
  ('for-her', 'для неї', 'для неї', '💐', 1, true),
  ('for-him', 'для нього', 'для нього', '🎁', 2, true),
  ('for-mom', 'для мами', 'для мами', '🌸', 3, true),
  ('for-grandma', 'для бабусі', 'для бабусі', '👵', 4, true),
  ('for-dad', 'для тата', 'для тата', '👔', 5, true),
  ('for-grandpa', 'для дідуся', 'для дідуся', '👴', 6, true),
  ('for-friend', 'для подруги', 'для подруги', '🤝', 7, true),
  ('for-boss', 'для боса', 'для боса', '💼', 8, true),
  ('for-couple', 'для пари', 'для пари', '💑', 9, true)
ON CONFLICT (slug) DO NOTHING;

-- Step 5: Enable Row Level Security (RLS)
ALTER TABLE gift_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_collection_items ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies

-- Public can read active collections
CREATE POLICY "Public can view active gift collections"
  ON gift_collections FOR SELECT
  USING (is_active = true);

-- Public can read collection items
CREATE POLICY "Public can view gift collection items"
  ON gift_collection_items FOR SELECT
  USING (true);

-- Admins can do everything (you may need to adjust this based on your auth setup)
CREATE POLICY "Admins can manage gift collections"
  ON gift_collections FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can manage gift collection items"
  ON gift_collection_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 7: Add updated_at trigger for gift_collections
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_gift_collections_updated_at
  BEFORE UPDATE ON gift_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
