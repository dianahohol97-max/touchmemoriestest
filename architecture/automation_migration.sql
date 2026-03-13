-- Migration: Automation & Referral System

-- 1. Add bonus_balance to customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS bonus_balance numeric DEFAULT 0;

-- 2. Create referral_codes table
CREATE TABLE IF NOT EXISTS public.referral_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    code text UNIQUE NOT NULL,
    uses_count integer DEFAULT 0,
    earned_amount numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS for referral_codes
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own referral code
CREATE POLICY "Users can view own referral code"
ON public.referral_codes FOR SELECT
TO authenticated
USING (customer_id IN (
  SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
));

-- Allow admins full access to referral_codes
CREATE POLICY "Admins have full access to referral_codes"
ON public.referral_codes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users WHERE email = auth.jwt() ->> 'email'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users WHERE email = auth.jwt() ->> 'email'
  )
);
