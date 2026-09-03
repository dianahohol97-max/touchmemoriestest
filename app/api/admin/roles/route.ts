import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireSection } from '@/lib/auth/guards';
import { ADMIN_SECTION_KEYS } from '@/lib/auth/admin-sections';
import { ACCESS_ORDER } from '@/lib/auth/permissions';

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

/**
 * Перевіряє мапу прав перед записом.
 *
 * Роль — це те, за чим серверні guard-и вирішують, кого куди пускати, тож у
 * permissions не має потрапляти нічого, чого ці guard-и не розуміють.
 * Невідомий розділ мовчки нічого не забороняв би (див. allows() у
 * lib/auth/permissions.ts), а невідомий рівень зламав би порівняння — і в
 * обох випадках людина була б упевнена, що доступ налаштувала.
 *
 * Повертає текст помилки або null, якщо все гаразд.
 */
function validatePermissions(value: unknown): string | null {
    if (value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return 'permissions має бути обʼєктом';
    }
    const bad: string[] = [];
    for (const [section, level] of Object.entries(value as Record<string, unknown>)) {
        if (!ADMIN_SECTION_KEYS.has(section)) { bad.push(`невідомий розділ «${section}»`); continue; }
        if (typeof level !== 'string' || !(ACCESS_ORDER as string[]).includes(level)) {
            bad.push(`невідомий рівень «${String(level)}» у розділі «${section}»`);
        }
    }
    return bad.length > 0 ? bad.join('; ') : null;
}

export async function GET() {
    const guard = await requireSection('settings', 'full');
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const { data, error } = await supabase
            .from('admin_roles')
            .select('*')
            .order('name');

        if (error) throw error;

        // Скільки людей сидить на кожній ролі, і хто саме. Редактор ролей
        // раніше підставляв нуль заглушкою, тож знизити рівень цілій команді
        // можна було не здогадуючись, що вона взагалі існує.
        const { data: staff } = await supabase
            .from('staff')
            .select('id, name, role_id')
            .eq('is_active', true);

        const enriched = (data || []).map((role: any) => {
            const members = (staff || []).filter((s: any) => s.role_id === role.id);
            return {
                ...role,
                member_count: members.length,
                members: members.map((m: any) => ({ id: m.id, name: m.name })),
            };
        });

        return NextResponse.json(enriched);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const guard = await requireSection('settings', 'full');
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const invalid = validatePermissions(body?.permissions);
        if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
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
    const guard = await requireSection('settings', 'full');
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing role ID' }, { status: 400 });
        }
        const invalid = validatePermissions(body?.permissions);
        if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

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
    const guard = await requireSection('settings', 'full');
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
