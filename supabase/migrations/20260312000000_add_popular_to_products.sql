-- Add is_popular and popular_order to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS popular_order integer;

-- Add index for popular products
CREATE INDEX IF NOT EXISTS idx_products_popular ON public.products(is_popular) WHERE is_popular = true;
