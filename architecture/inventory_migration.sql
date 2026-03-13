-- ==========================================
-- 1. Modify products table
-- ==========================================
-- Add new columns for inventory tracking
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_personalized BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_reserved INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS cost_price_currency TEXT DEFAULT 'UAH',
ADD COLUMN IF NOT EXISTS cost_price_notes TEXT,
ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT false;

-- Add generated column for available stock
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_available INTEGER GENERATED ALWAYS AS (stock_quantity - stock_reserved) STORED;

-- ==========================================
-- 2. inventory_movements
-- ==========================================
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'reserved', 'unreserved')),
    quantity INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    cost_per_unit NUMERIC(10,2),
    supplier TEXT,
    invoice_number TEXT,
    notes TEXT,
    added_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 3. stock_alerts
-- ==========================================
CREATE TABLE IF NOT EXISTS public.stock_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock')),
    triggered_at TIMESTAMPTZ DEFAULT now(),
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ
);

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

-- Base Policies (since Admin UI will access these, mostly relies on auth role)
CREATE POLICY "Enable reading movements for all" ON public.inventory_movements FOR SELECT USING (true);
CREATE POLICY "Enable inserting movements for authenticated users" ON public.inventory_movements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable updating movements for authenticated users" ON public.inventory_movements FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable reading alerts for all" ON public.stock_alerts FOR SELECT USING (true);
CREATE POLICY "Enable full access alerts for authenticated users" ON public.stock_alerts FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- Update Realtime Publications
-- ==========================================
alter publication supabase_realtime add table public.inventory_movements;
alter publication supabase_realtime add table public.stock_alerts;
