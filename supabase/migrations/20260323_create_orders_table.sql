-- Create orders table for storing customer orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,

  -- Customer information
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,

  -- Delivery information
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('pickup', 'nova_poshta', 'ukrposhta', 'international')),
  delivery_city TEXT,
  delivery_branch TEXT,
  delivery_address TEXT,
  delivery_postal_code TEXT,
  delivery_country TEXT,

  -- Order details
  comment TEXT,
  promo_code TEXT,

  -- Product information
  product_type TEXT NOT NULL CHECK (product_type IN ('photobook', 'travelbook', 'magazine', 'photoprint', 'photomagnet', 'calendar', 'poster', 'guestbook')),
  product_format TEXT NOT NULL,
  product_slug TEXT,
  total_pages INTEGER,
  cover_color TEXT,
  cover_type TEXT,

  -- Extras (stored as JSONB for flexibility)
  extras JSONB DEFAULT '{}'::JSONB,

  -- Pricing
  base_price INTEGER NOT NULL,
  extras_price INTEGER DEFAULT 0,
  delivery_price INTEGER DEFAULT 0,
  discount_amount INTEGER DEFAULT 0,
  total_price INTEGER NOT NULL,

  -- Project reference
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_snapshot JSONB, -- Full snapshot of project at time of order

  -- Order status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_production', 'ready', 'shipped', 'completed', 'cancelled')),

  -- Tracking
  tracking_number TEXT,
  production_notes TEXT,
  manager_notes TEXT,

  -- Payment
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'monobank', 'paypal', 'other')),
  paid_amount INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index on order_number for fast lookups
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders(order_number);

-- Create index on customer_email for customer lookup
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders(customer_email);

-- Create index on status for filtering orders
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);

-- Create index on project_id
CREATE INDEX IF NOT EXISTS orders_project_id_idx ON orders(project_id);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own orders (by email)
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (customer_email = auth.jwt() ->> 'email');

-- Policy: Users can insert their own orders
CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  WITH CHECK (true); -- Allow anyone to create orders (guest checkout)

-- Policy: Admin users can view and modify all orders
-- (Requires admin role to be set up in auth.users metadata)
CREATE POLICY "Admins can manage all orders"
  ON orders FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER orders_updated_at_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- Add comment to table
COMMENT ON TABLE orders IS 'Stores customer orders from the photobook editor and direct product purchases';
