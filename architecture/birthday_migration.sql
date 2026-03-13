-- Migration: Move birthday collection from newsletter to customer registration
-- Adds birthday fields to customers table

-- Add birthday fields to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS birthday_day INTEGER CHECK (birthday_day >= 1 AND birthday_day <= 31),
ADD COLUMN IF NOT EXISTS birthday_month INTEGER CHECK (birthday_month >= 1 AND birthday_month <= 12),
ADD COLUMN IF NOT EXISTS birthday_year INTEGER CHECK (birthday_year >= 1900 AND birthday_year <= 2100);

-- Add comments for documentation
COMMENT ON COLUMN public.customers.birthday_day IS 'Day of birth (1-31)';
COMMENT ON COLUMN public.customers.birthday_month IS 'Month of birth (1-12)';
COMMENT ON COLUMN public.customers.birthday_year IS 'Year of birth (optional, 1900-2100)';

-- Create index for birthday queries (for birthday email campaigns)
CREATE INDEX IF NOT EXISTS idx_customers_birthday ON public.customers(birthday_month, birthday_day)
WHERE birthday_month IS NOT NULL AND birthday_day IS NOT NULL;
