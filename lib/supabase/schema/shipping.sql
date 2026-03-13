-- Shipping Settings Table
CREATE TABLE IF NOT EXISTS shipping_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nova Poshta API
  novaposhta_api_key TEXT NOT NULL,
  -- Sender Details
  sender_city_ref TEXT NOT NULL, -- Nova Poshta city reference
  sender_city_name TEXT NOT NULL,
  sender_warehouse_ref TEXT NOT NULL, -- Nova Poshta warehouse reference
  sender_warehouse_name TEXT NOT NULL,
  sender_contact_person TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  -- Default Shipping Options
  default_service_type TEXT DEFAULT 'WarehouseWarehouse',
  default_cargo_type TEXT DEFAULT 'Parcel',
  default_payment_method TEXT DEFAULT 'Cash', -- Cash or NonCash
  default_payer_type TEXT DEFAULT 'Recipient', -- Recipient or Sender
  -- Automation Settings
  auto_create_ttn_on_ready BOOLEAN DEFAULT TRUE,
  auto_track_shipments BOOLEAN DEFAULT TRUE,
  tracking_check_interval_hours INTEGER DEFAULT 4,
  auto_send_ttn_email BOOLEAN DEFAULT TRUE,
  -- Review Request Settings
  review_request_delay_days INTEGER DEFAULT 5,
  auto_send_review_request BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipment Tracking History
CREATE TABLE IF NOT EXISTS shipment_tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ttn TEXT NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER,
  city TEXT,
  warehouse TEXT,
  scheduled_delivery_date DATE,
  actual_delivery_date DATE,
  recipient_name TEXT,
  weight NUMERIC(10, 2),
  cost NUMERIC(10, 2),
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bulk Shipping Batches
CREATE TABLE IF NOT EXISTS bulk_shipping_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  order_count INTEGER DEFAULT 0,
  ttns_created INTEGER DEFAULT 0,
  ttns_failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  labels_pdf_url TEXT,
  error_log TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Bulk Shipping Batch Items
CREATE TABLE IF NOT EXISTS bulk_shipping_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES bulk_shipping_batches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ttn TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add shipping columns to orders table if not exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ttn TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_last_checked TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_to_ship_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_order ON shipment_tracking_history(order_id);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_ttn ON shipment_tracking_history(ttn);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_created ON shipment_tracking_history(created_at);
CREATE INDEX IF NOT EXISTS idx_bulk_shipping_batches_created_by ON bulk_shipping_batches(created_by);
CREATE INDEX IF NOT EXISTS idx_bulk_shipping_batch_items_batch ON bulk_shipping_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_bulk_shipping_batch_items_order ON bulk_shipping_batch_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_ttn ON orders(ttn);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_status ON orders(shipping_status);

-- RLS Policies
ALTER TABLE shipping_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_shipping_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_shipping_batch_items ENABLE ROW LEVEL SECURITY;

-- Only admins can manage shipping settings
CREATE POLICY "Only admins can access shipping_settings"
  ON shipping_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

-- Staff can view tracking history
CREATE POLICY "Staff can view tracking_history"
  ON shipment_tracking_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "System can insert tracking_history"
  ON shipment_tracking_history FOR INSERT
  WITH CHECK (true);

-- Staff can manage bulk shipping
CREATE POLICY "Staff can view bulk_shipping_batches"
  ON bulk_shipping_batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Staff can create bulk_shipping_batches"
  ON bulk_shipping_batches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Staff can view bulk_shipping_batch_items"
  ON bulk_shipping_batch_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "System can manage bulk_shipping_batch_items"
  ON bulk_shipping_batch_items FOR ALL
  WITH CHECK (true);

-- Triggers
CREATE TRIGGER update_shipping_settings_updated_at
  BEFORE UPDATE ON shipping_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-update order status based on shipping status
CREATE OR REPLACE FUNCTION update_order_status_from_shipping()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipping_status = 'Delivered' AND OLD.shipping_status != 'Delivered' THEN
    NEW.status = 'delivered';
    NEW.delivered_at = NOW();
  END IF;

  IF NEW.shipping_status = 'Returned' THEN
    -- Could trigger an alert here
    NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_status_from_shipping
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.shipping_status IS DISTINCT FROM NEW.shipping_status)
  EXECUTE FUNCTION update_order_status_from_shipping();

-- Insert default shipping settings (to be configured by admin)
INSERT INTO shipping_settings (
  novaposhta_api_key,
  sender_city_ref,
  sender_city_name,
  sender_warehouse_ref,
  sender_warehouse_name,
  sender_contact_person,
  sender_phone
) VALUES (
  'YOUR_NOVAPOSHTA_API_KEY',
  'YOUR_CITY_REF',
  'Київ',
  'YOUR_WAREHOUSE_REF',
  'Відділення №1',
  'Контактна особа',
  '+380501234567'
)
ON CONFLICT DO NOTHING;
