-- Advanced Salary and Schedule Schema (Module 12)

-- 1. Add salary settings to existing staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS daily_base_rate NUMERIC DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS piece_rate NUMERIC DEFAULT 0;

-- 2. Create staff_schedule table to plan and track daily shifts
CREATE TABLE IF NOT EXISTS public.staff_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'worked', 'skipped')),
    
    -- Calculated daily metrics (frozen at the end of the day or when clicking 'calculate')
    daily_turnover_amount NUMERIC DEFAULT 0, -- For Managers: daily revenue
    daily_orders_count INT DEFAULT 0,        -- For Designers: how many designs finished
    daily_products_value NUMERIC DEFAULT 0,  -- For Designers: total value of products designed
    
    calculated_base NUMERIC DEFAULT 0,
    calculated_bonus NUMERIC DEFAULT 0,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(staff_id, work_date)
);

-- Note: In the future, 'salary_periods' will just aggregate the sums from 'staff_schedule' for a given month.

-- Enable RLS
ALTER TABLE public.staff_schedule ENABLE ROW LEVEL SECURITY;

-- Allow full access for admins (assuming anyone authenticated can access for now)
CREATE POLICY "Allow full access for authenticated users to staff_schedule" 
ON public.staff_schedule FOR ALL USING (auth.role() = 'authenticated');
