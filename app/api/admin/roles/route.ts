import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

// Only real admin_roles columns are writable. The list page enriches each role
// with a UI-only `member_count`; forwarding it to Postgres throws 42703 and
// made every role edit fail — so pick the known columns explicitly.
const EDITABLE_ROLE_FIELDS = ['name', 'slug', 'permissions'] as const;
function pickRoleFields(body: Record<string, any>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of EDITABLE_ROLE_FIELDS) if (k in body) out[k] = body[k];
    return out;
}

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const { data, error } = await supabase
            .from('admin_roles')
            .select('*')
            .order('name');

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const row = pickRoleFields(body);

        // Generate slug if not provided
        if (!row.slug && row.name) {
            row.slug = String(row.name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        }

        const { data, error } = await supabase
            .from('admin_roles')
            .insert([row])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing role ID' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('admin_roles')
            .update({
                ...pickRoleFields(body),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing role ID' }, { status: 400 });
        }

        // Check if it's a system role
        const { data: role } = await supabase
            .from('admin_roles')
            .select('is_system')
            .eq('id', id)
            .single();

        if (role?.is_system) {
            return NextResponse.json({ error: 'Системні ролі не можна видаляти' }, { status: 400 });
        }

        const { error } = await supabase
            .from('admin_roles')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
