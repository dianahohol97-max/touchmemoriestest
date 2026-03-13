-- Create staff table
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('manager', 'designer', 'admin')),
    color TEXT NOT NULL,
    initials TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for staff
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users for staff
CREATE POLICY "Allow read access to all authenticated users for staff" 
ON public.staff FOR SELECT 
TO authenticated 
USING (true);

-- Allow full access to admins for staff
CREATE POLICY "Allow full access to admins for staff" 
ON public.staff FOR ALL 
TO authenticated 
USING (auth.uid() IN (SELECT id FROM public.admin_users));

-- Alter orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.staff(id),
ADD COLUMN IF NOT EXISTS designer_id UUID REFERENCES public.staff(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Create order history table
CREATE TABLE IF NOT EXISTS public.order_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- Enable RLS for order_history
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users for order_history
CREATE POLICY "Allow read access to all authenticated users for order_history" 
ON public.order_history FOR SELECT 
TO authenticated 
USING (true);

-- Allow insert access to authenticated users for order_history
CREATE POLICY "Allow insert access to authenticated users for order_history" 
ON public.order_history FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow delete access to admins for order_history
CREATE POLICY "Allow delete access to admins for order_history" 
ON public.order_history FOR DELETE 
TO authenticated 
USING (auth.uid() IN (SELECT id FROM public.admin_users));
