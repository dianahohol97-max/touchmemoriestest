-- 1. Extend Staff table for salary plans
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS manager_plan_target NUMERIC DEFAULT 0;

-- 2. Staff Shifts table (for Shift Rate calculations)
CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, work_date)
);

-- 3. QC Error Log table
CREATE TABLE IF NOT EXISTS public.qc_error_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    error_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    points INT NOT NULL DEFAULT 5, -- penalty points
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Salary Calculations/Periods table
CREATE TABLE IF NOT EXISTS public.salary_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'partial')),
    notes TEXT,
    is_locked BOOLEAN DEFAULT false,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_calculations ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated' AND tablename = 'staff_shifts') THEN
        CREATE POLICY "Allow all for authenticated" ON public.staff_shifts FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated' AND tablename = 'qc_error_log') THEN
        CREATE POLICY "Allow all for authenticated" ON public.qc_error_log FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated' AND tablename = 'salary_calculations') THEN
        CREATE POLICY "Allow all for authenticated" ON public.salary_calculations FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;
