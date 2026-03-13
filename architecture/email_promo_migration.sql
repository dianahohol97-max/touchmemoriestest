-- Migration for MODULE 4: Email Marketing & Promo Codes

-- 1. Subscribers
CREATE TABLE IF NOT EXISTS public.subscribers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text UNIQUE NOT NULL,
    name text,
    birthday_month integer CHECK (birthday_month >= 1 AND birthday_month <= 12),
    birthday_day integer CHECK (birthday_day >= 1 AND birthday_day <= 31),
    city text,
    segments text[] DEFAULT '{}'::text[],
    source text CHECK (source IN ('checkout', 'popup', 'manual', 'import')),
    is_active boolean DEFAULT true,
    unsubscribe_token uuid UNIQUE DEFAULT gen_random_uuid(),
    subscribed_at timestamp with time zone DEFAULT now()
);

-- 2. Promo Codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE NOT NULL,
    type text CHECK (type IN ('percent', 'fixed')) NOT NULL,
    value numeric NOT NULL,
    min_order_amount numeric DEFAULT 0,
    applies_to text DEFAULT 'all',
    max_uses integer,
    uses_count integer DEFAULT 0,
    is_single_use_per_customer boolean DEFAULT true,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true,
    created_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Promo Code Usages
CREATE TABLE IF NOT EXISTS public.promo_code_usages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    promo_code_id uuid REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    discount_amount numeric NOT NULL,
    used_at timestamp with time zone DEFAULT now()
);

-- 4. Email Campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text CHECK (type IN ('new_product', 'promotion', 'birthday')) NOT NULL,
    subject text NOT NULL,
    preview_text text,
    html_body text,
    segment text DEFAULT 'all',
    promo_code_id uuid REFERENCES public.promo_codes(id) ON DELETE SET NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    status text CHECK (status IN ('draft', 'scheduled', 'sending', 'sent')) DEFAULT 'draft',
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    total_sent integer DEFAULT 0,
    total_opened integer DEFAULT 0,
    total_clicked integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Email Logs
CREATE TABLE IF NOT EXISTS public.email_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
    subscriber_id uuid REFERENCES public.subscribers(id) ON DELETE CASCADE,
    email text NOT NULL,
    status text CHECK (status IN ('sent', 'opened', 'clicked', 'bounced', 'unsubscribed')) DEFAULT 'sent',
    sent_at timestamp with time zone DEFAULT now(),
    opened_at timestamp with time zone,
    tracking_pixel_id uuid UNIQUE DEFAULT gen_random_uuid()
);

-- RLS Policies Setup --

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage subscribers" ON public.subscribers
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM public.staff WHERE role = 'admin')
    );

CREATE POLICY "Admins can manage promo_codes" ON public.promo_codes
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM public.staff WHERE role = 'admin')
    );

CREATE POLICY "Admins can manage promo_code_usages" ON public.promo_code_usages
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM public.staff WHERE role = 'admin')
    );

CREATE POLICY "Admins can manage email_campaigns" ON public.email_campaigns
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM public.staff WHERE role = 'admin')
    );

CREATE POLICY "Admins can manage email_logs" ON public.email_logs
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM public.staff WHERE role = 'admin')
    );

-- Public can read promo functionality for cart
CREATE POLICY "Public can read active promo codes" ON public.promo_codes
    FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- Public can insert usage (or strictly we do this via backend triggers bypassing RLS, but for security:)
CREATE POLICY "Public can insert promo code usages" ON public.promo_code_usages
    FOR INSERT WITH CHECK (true);

-- Public can insert subscribers via popups
CREATE POLICY "Public can insert subscribers" ON public.subscribers
    FOR INSERT WITH CHECK (true);

-- Public can view subscribers for deduplication
CREATE POLICY "Public can query subscribers" ON public.subscribers
    FOR SELECT USING (true);
