-- ============================================================
-- MIGRATION: Create Gift Certificates System
-- ============================================================
-- Creates certificates category, gift certificate product,
-- and certificates tracking table for electronic/printed certificates
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- STEP 1: Create certificates category (if not exists)
-- ─────────────────────────────────────────────────────────
INSERT INTO public.categories (name, slug, is_active, sort_order)
VALUES ('Подарункові сертифікати', 'certificates', true, 60)
ON CONFLICT (slug)
DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────
-- STEP 2: Create gift certificate product
-- ─────────────────────────────────────────────────────────
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    description,
    short_description,
    images,
    is_active,
    is_personalized
) VALUES (
    'Подарунковий сертифікат',
    'gift-certificate',
    (SELECT id FROM public.categories WHERE slug = 'certificates' LIMIT 1),
    100, -- Base price (minimum amount)
    E'Подарунковий сертифікат Touch.Memories — ідеальний подарунок для тих, хто цінує спогади.\n\nГрошовий сертифікат дійсний 1 рік з дати покупки. Сертифікат на конкретний продукт дійсний 3 місяці. Отримувач може використати сертифікат на замовлення будь-якого продукту з нашого каталогу.\n\nЕлектронний сертифікат надсилається на email одразу після оплати у форматі PDF. Друкований сертифікат виготовляється на преміальному папері і доставляється Новою Поштою у святковому конверті.',
    'Подарунковий сертифікат на вибір — грошовий або на конкретний продукт. Електронний або друкований формат.',
    ARRAY['https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&q=80']::text[],
    true,
    true
)
ON CONFLICT (slug)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    short_description = EXCLUDED.short_description,
    images = EXCLUDED.images,
    is_active = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────
-- STEP 3: Create certificates tracking table
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Certificate identification
    code TEXT UNIQUE NOT NULL, -- Unique redemption code (8-character uppercase alphanumeric)

    -- Certificate type and value
    certificate_type TEXT NOT NULL CHECK (certificate_type IN ('money', 'product')),
    amount INTEGER, -- For money certificates (in UAH)
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, -- For product certificates
    product_name TEXT, -- Stored name in case product is deleted

    -- Format and delivery
    format TEXT NOT NULL CHECK (format IN ('electronic', 'printed')),

    -- Recipient information
    recipient_name TEXT,
    recipient_email TEXT,
    recipient_phone TEXT,
    delivery_address JSONB, -- For printed certificates (Nova Poshta details)

    -- Validity and redemption
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    redeemed_at TIMESTAMP WITH TIME ZONE,
    redeemed_order_id UUID, -- Link to order where certificate was used

    -- Purchase tracking
    order_id UUID, -- Link to order where certificate was purchased
    purchaser_name TEXT,
    purchaser_email TEXT,

    -- Message from purchaser
    message TEXT, -- Optional gift message

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_certificates_code ON public.certificates(code);
CREATE INDEX IF NOT EXISTS idx_certificates_redeemed ON public.certificates(redeemed);
CREATE INDEX IF NOT EXISTS idx_certificates_valid_until ON public.certificates(valid_until);
CREATE INDEX IF NOT EXISTS idx_certificates_order_id ON public.certificates(order_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_certificates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS certificates_updated_at ON public.certificates;
CREATE TRIGGER certificates_updated_at
    BEFORE UPDATE ON public.certificates
    FOR EACH ROW
    EXECUTE FUNCTION update_certificates_updated_at();

-- ─────────────────────────────────────────────────────────
-- STEP 4: Add helpful comments
-- ─────────────────────────────────────────────────────────
COMMENT ON TABLE public.certificates IS 'Stores gift certificate data for money and product certificates';
COMMENT ON COLUMN public.certificates.code IS 'Unique 8-character redemption code (e.g., "A7K9M2X4")';
COMMENT ON COLUMN public.certificates.certificate_type IS 'Type: "money" (грошовий) or "product" (на продукт)';
COMMENT ON COLUMN public.certificates.format IS 'Delivery format: "electronic" (PDF email) or "printed" (physical)';
COMMENT ON COLUMN public.certificates.valid_until IS 'Money certs: 1 year, Product certs: 3 months';
