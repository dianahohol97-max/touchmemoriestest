-- Design Briefs Table
CREATE TABLE IF NOT EXISTS design_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- Brief Details
  occasion TEXT CHECK (occasion IN (
    'wedding', 'birthday', 'travel', 'family', 'baby',
    'graduation', 'corporate', 'other'
  )),
  style_preference TEXT CHECK (style_preference IN (
    'minimal', 'bright', 'classic', 'romantic', 'kids'
  )),
  important_photos TEXT,
  title_text TEXT,
  additional_notes TEXT,
  photo_order TEXT CHECK (photo_order IN ('chronological', 'random', 'manual')),
  is_gift BOOLEAN DEFAULT FALSE,
  -- Photos
  photos_count INTEGER DEFAULT 0,
  photos_folder TEXT,
  photos_metadata JSONB DEFAULT '[]'::JSONB, -- [{id, filename, url, score, analysis}]
  -- Status
  status TEXT DEFAULT 'waiting_brief' CHECK (status IN (
    'waiting_brief',
    'brief_received',
    'ai_processing',
    'ai_done',
    'in_design',
    'sent_for_review',
    'revision_requested',
    'approved'
  )),
  -- AI Processing
  ai_draft_project_id UUID REFERENCES photobook_projects(id) ON DELETE SET NULL,
  ai_analysis_result JSONB,
  ai_layout_plan JSONB,
  ai_error TEXT,
  -- Timestamps
  submitted_at TIMESTAMPTZ,
  ai_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Design Revisions Table
CREATE TABLE IF NOT EXISTS design_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  project_id UUID NOT NULL REFERENCES photobook_projects(id) ON DELETE CASCADE,
  -- Review Token
  client_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- Status
  sent_to_client_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  client_decision TEXT CHECK (client_decision IN ('approved', 'revision_requested')),
  -- Comments
  client_comments JSONB DEFAULT '[]'::JSONB, -- [{page: 3, text: "більше відстані між фото"}]
  general_feedback TEXT,
  designer_notes TEXT,
  -- Tracking
  revision_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add designer service columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_designer_option BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS designer_service_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_free_revisions INTEGER DEFAULT 2;

-- Add designer tracking to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS with_designer BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS designer_service_fee NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS brief_token UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_revision_number INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_design_briefs_order ON design_briefs(order_id);
CREATE INDEX IF NOT EXISTS idx_design_briefs_token ON design_briefs(token);
CREATE INDEX IF NOT EXISTS idx_design_briefs_status ON design_briefs(status);
CREATE INDEX IF NOT EXISTS idx_design_revisions_order ON design_revisions(order_id);
CREATE INDEX IF NOT EXISTS idx_design_revisions_token ON design_revisions(client_token);
CREATE INDEX IF NOT EXISTS idx_design_revisions_number ON design_revisions(order_id, revision_number);

-- RLS Policies
ALTER TABLE design_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_revisions ENABLE ROW LEVEL SECURITY;

-- Public can access via token
CREATE POLICY "Anyone can access brief via token"
  ON design_briefs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update brief via token"
  ON design_briefs FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can access revision via token"
  ON design_revisions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update revision via token"
  ON design_revisions FOR UPDATE
  USING (true);

-- Staff can manage all
CREATE POLICY "Staff can manage design_briefs"
  ON design_briefs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage design_revisions"
  ON design_revisions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER update_design_briefs_updated_at
  BEFORE UPDATE ON design_briefs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_design_revisions_updated_at
  BEFORE UPDATE ON design_revisions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create design brief after order payment
CREATE OR REPLACE FUNCTION create_design_brief_for_order()
RETURNS TRIGGER AS $$
DECLARE
  brief_token UUID;
BEGIN
  -- Only create brief if order has designer service
  IF NEW.with_designer = TRUE AND OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL THEN
    -- Generate brief token
    brief_token := gen_random_uuid();

    -- Create design brief
    INSERT INTO design_briefs (order_id, token, photos_folder)
    VALUES (
      NEW.id,
      brief_token,
      'design-briefs/' || NEW.id::text || '/'
    );

    -- Update order with brief token
    NEW.brief_token := brief_token;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_design_brief
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.paid_at IS DISTINCT FROM NEW.paid_at)
  EXECUTE FUNCTION create_design_brief_for_order();

-- Function to update order status when design approved
CREATE OR REPLACE FUNCTION update_order_on_design_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_decision = 'approved' AND OLD.client_decision IS DISTINCT FROM 'approved' THEN
    UPDATE orders
    SET status = 'approved_for_print'
    WHERE id = NEW.order_id;

    UPDATE design_briefs
    SET status = 'approved'
    WHERE order_id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_on_approval
  AFTER UPDATE ON design_revisions
  FOR EACH ROW
  WHEN (NEW.client_decision IS DISTINCT FROM OLD.client_decision)
  EXECUTE FUNCTION update_order_on_design_approval();

-- Storage bucket for design briefs
INSERT INTO storage.buckets (id, name, public)
VALUES ('design-briefs', 'design-briefs', true)
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can upload to design-briefs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'design-briefs');

CREATE POLICY "Anyone can view design-briefs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'design-briefs');

CREATE POLICY "Staff can delete from design-briefs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'design-briefs' AND
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );
