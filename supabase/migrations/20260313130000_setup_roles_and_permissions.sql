-- Role & Permissions Management System

-- 1. Create admin_roles table
CREATE TABLE IF NOT EXISTS public.admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.admin_roles(id);
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS individual_permissions JSONB DEFAULT '{}';

-- 3. Seed Default Roles
INSERT INTO public.admin_roles (name, slug, is_system, permissions) VALUES
('Власник', 'owner', true, '{
    "catalog": "full",
    "orders": "full",
    "customers": "full",
    "production": "full",
    "finance": "full",
    "marketing": "full",
    "content": "full",
    "settings": "full",
    "ai": "full",
    "analytics": "full"
}'),
('Менеджер', 'manager', false, '{
    "catalog": "full",
    "orders": "full",
    "customers": "full",
    "production": "view",
    "finance": "none",
    "marketing": "edit",
    "content": "edit",
    "settings": "none",
    "ai": "full",
    "analytics": "view"
}'),
('Дизайнер', 'designer', false, '{
    "catalog": "view",
    "orders": "edit",
    "customers": "view",
    "production": "none",
    "finance": "none",
    "marketing": "none",
    "content": "full",
    "settings": "none",
    "ai": "view",
    "analytics": "none"
}'),
('Виробництво', 'production', false, '{
    "catalog": "view",
    "orders": "view",
    "customers": "none",
    "production": "full",
    "finance": "none",
    "marketing": "none",
    "content": "none",
    "settings": "none",
    "ai": "none",
    "analytics": "none"
}'),
('Маркетолог', 'marketer', false, '{
    "catalog": "edit",
    "orders": "view",
    "customers": "edit",
    "production": "none",
    "finance": "none",
    "marketing": "full",
    "content": "full",
    "settings": "none",
    "ai": "edit",
    "analytics": "edit"
}');

-- 4. Initial Migration for existing staff (Link to roles based on old role string)
UPDATE public.staff SET role_id = (SELECT id FROM public.admin_roles WHERE slug = 'manager') WHERE role = 'manager';
UPDATE public.staff SET role_id = (SELECT id FROM public.admin_roles WHERE slug = 'designer') WHERE role = 'designer';
UPDATE public.staff SET role_id = (SELECT id FROM public.admin_roles WHERE slug = 'owner') WHERE role = 'admin'; -- Assuming admin maps to owner for now
