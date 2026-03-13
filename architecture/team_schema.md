# Team Management Schema

## `staff`
Stores administrative team members.
```sql
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
```

## `orders` additions
Foreign keys referencing `staff`.
```sql
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.staff(id),
ADD COLUMN IF NOT EXISTS designer_id UUID REFERENCES public.staff(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
```

## `order_history`
Audit log for order lifecycle changes, specifically assignments.
```sql
CREATE TABLE IF NOT EXISTS public.order_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID -- auth.uid() or staff.id
);
```

### RLS Policies
Staff can be read and modified by authenticated admins. Order history can be read and inserted by authenticated admins.
