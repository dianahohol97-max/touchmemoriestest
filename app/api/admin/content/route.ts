import { NextRequest, NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { CONTENT_TABLES, pickColumns, type ContentTable } from '@/lib/admin/content-tables';

export const dynamic = 'force-dynamic';

/**
 * Читання й запис таблиць контенту адмінки.
 *
 * Дев'ять сторінок писали в ці таблиці прямо з браузера — разом близько сотні
 * місць. Усі таблиці закриті політикою is_admin_user(), тож для десяти з
 * чотирнадцяти активних співробітників запис мовчки не проходив: RLS не дає
 * помилки, вона просто не чіпає жодного рядка. Сторінка казала «Збережено», а
 * після перезавантаження правки не було. Дизайнер, якому роль дає контент
 * повністю, не міг зберегти нічого.
 *
 * Що робить цей роут безпечним попри те, що він один на багато таблиць:
 *   • таблиця має бути в реєстрі CONTENT_TABLES, інакше 400;
 *   • кожна таблиця названа своїм розділом прав, і рівень перевіряється
 *     окремо для читання, запису й видалення;
 *   • записуються тільки перелічені в реєстрі колонки, решта відхиляється з
 *     переліком зайвих полів, а не мовчки ігнорується;
 *   • видалення дозволено лише там, де реєстр це прямо каже.
 * Тобто це не універсальний доступ до бази, а явний перелік, який видно очима
 * в lib/admin/content-tables.ts.
 *
 * GET    ?table=blog_posts[&id=…]
 * POST   { table, rows: [...] }          — вставка
 * PATCH  { table, id, patch }            — оновлення одного рядка
 * PATCH  { table, rows: [{id, ...}] }    — кілька рядків за раз (сортування)
 * DELETE ?table=…&id=…
 */
function lookup(name: string | null): { table: ContentTable; name: string } | null {
    if (!name) return null;
    const table = CONTENT_TABLES[name];
    return table ? { table, name } : null;
}

const unknownTable = (name: string | null) =>
    NextResponse.json({ error: `Невідома таблиця «${name || ''}»` }, { status: 400 });

export async function GET(req: NextRequest) {
    const found = lookup(req.nextUrl.searchParams.get('table'));
    if (!found) return unknownTable(req.nextUrl.searchParams.get('table'));

    const guard = await requireSection(found.table.section, 'view');
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    let query = admin.from(found.name).select('*');

    const id = req.nextUrl.searchParams.get('id');
    if (id) query = query.eq('id', id);
    if (found.table.orderBy) {
        query = query.order(found.table.orderBy.column, { ascending: found.table.orderBy.ascending ?? true });
    }

    const { data, error } = await query;
    if (error) {
        console.error('[admin/content] read failed', { table: found.name, error: error.message });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rows: data || [] });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const found = lookup(typeof body?.table === 'string' ? body.table : null);
    if (!found) return unknownTable(body?.table ?? null);

    const guard = await requireSection(found.table.section, 'edit');
    if (!guard.ok) return guard.response;

    const input = Array.isArray(body?.rows) ? body.rows : (body?.row ? [body.row] : []);
    if (input.length === 0) return NextResponse.json({ error: 'rows required' }, { status: 400 });
    if (input.length > 200) return NextResponse.json({ error: 'Забагато рядків за раз' }, { status: 400 });

    const rows: Record<string, unknown>[] = [];
    for (const item of input) {
        const { row, rejected } = pickColumns(found.table, item);
        if (rejected.length > 0) {
            return NextResponse.json(
                { error: `Поля не редагуються через цей роут: ${rejected.join(', ')}` },
                { status: 400 },
            );
        }
        if (Object.keys(row).length === 0) {
            return NextResponse.json({ error: 'Немає полів для запису' }, { status: 400 });
        }
        rows.push(row);
    }

    const admin = getAdminClient();
    const { data, error } = await admin.from(found.name).insert(rows).select();
    if (error) {
        console.error('[admin/content] insert failed', { table: found.name, error: error.message });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, rows: data || [] });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const found = lookup(typeof body?.table === 'string' ? body.table : null);
    if (!found) return unknownTable(body?.table ?? null);

    const guard = await requireSection(found.table.section, 'edit');
    if (!guard.ok) return guard.response;

    // Дві форми виклику: один рядок за id, або пачка рядків, у кожного свій id.
    // Друга потрібна для перетягування порядку, де сторінка зберігає весь
    // список одним рухом.
    const items: any[] = Array.isArray(body?.rows)
        ? body.rows
        : (body?.id ? [{ id: body.id, ...(body.patch || {}) }] : []);
    if (items.length === 0) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (items.length > 200) return NextResponse.json({ error: 'Забагато рядків за раз' }, { status: 400 });

    const admin = getAdminClient();
    const updated: unknown[] = [];

    for (const item of items) {
        const id = item?.id;
        if (!id) return NextResponse.json({ error: 'У кожного рядка має бути id' }, { status: 400 });
        const { row, rejected } = pickColumns(found.table, item);
        if (rejected.length > 0) {
            return NextResponse.json(
                { error: `Поля не редагуються через цей роут: ${rejected.join(', ')}` },
                { status: 400 },
            );
        }
        if (Object.keys(row).length === 0) continue;

        const { data, error } = await admin
            .from(found.name)
            .update(row)
            .eq('id', id)
            .select()
            .maybeSingle();
        if (error) {
            console.error('[admin/content] update failed', { table: found.name, id, error: error.message });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        // Порожня відповідь означає, що рядка з таким id немає. Це саме той
        // випадок, який раніше проходив як успіх.
        if (!data) return NextResponse.json({ error: 'Рядок не знайдено' }, { status: 404 });
        updated.push(data);
    }

    return NextResponse.json({ ok: true, rows: updated });
}

export async function DELETE(req: NextRequest) {
    const name = req.nextUrl.searchParams.get('table');
    const found = lookup(name);
    if (!found) return unknownTable(name);

    if (!found.table.allowDelete) {
        return NextResponse.json({ error: `З «${found.name}» рядки не видаляються` }, { status: 400 });
    }

    const guard = await requireSection(found.table.section, 'full');
    if (!guard.ok) return guard.response;

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const admin = getAdminClient();
    const { data, error } = await admin
        .from(found.name)
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

    if (error) {
        console.error('[admin/content] delete failed', { table: found.name, id, error: error.message });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Рядок не знайдено' }, { status: 404 });
    return NextResponse.json({ ok: true });
}
