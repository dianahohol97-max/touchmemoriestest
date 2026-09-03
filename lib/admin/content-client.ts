/**
 * Клієнтський бік роуту /api/admin/content.
 *
 * Мета — щоб виклик у сторінці був не довшим за той прямий запит до Supabase,
 * який тут раніше стояв, інакше переписувати дев'ять сторінок ніхто б не став.
 * Кожна функція кидає виняток із текстом від сервера, тож сторінка ловить
 * помилку одним catch і показує чесний тост замість колишнього «Збережено» на
 * запиті, який нічого не зробив.
 */

async function call(input: RequestInfo, init?: RequestInit): Promise<any> {
    const res = await fetch(input, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `API ${res.status}`);
    return json;
}

/** Читає таблицю цілком або один рядок за id. */
export async function contentSelect<T = any>(table: string, id?: string): Promise<T[]> {
    const qs = new URLSearchParams({ table });
    if (id) qs.set('id', id);
    const json = await call(`/api/admin/content?${qs.toString()}`);
    return Array.isArray(json.rows) ? json.rows : [];
}

/** Вставляє один рядок і повертає його. */
export async function contentInsert<T = any>(table: string, row: Record<string, any>): Promise<T> {
    const json = await call('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, rows: [row] }),
    });
    return json.rows?.[0];
}

/** Вставляє кілька рядків за раз. */
export async function contentInsertMany<T = any>(table: string, rows: Record<string, any>[]): Promise<T[]> {
    if (rows.length === 0) return [];
    const json = await call('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, rows }),
    });
    return json.rows || [];
}

/** Оновлює один рядок за id. */
export async function contentUpdate<T = any>(table: string, id: string, patch: Record<string, any>): Promise<T> {
    const json = await call('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, patch }),
    });
    return json.rows?.[0];
}

/**
 * Оновлює кілька рядків одним викликом — у кожного свій id і свої поля.
 * Саме те, що потрібно перетягуванню порядку: раніше сторінки слали на це
 * стільки окремих запитів, скільки рядків у списку.
 */
export async function contentUpdateMany(table: string, rows: Array<Record<string, any> & { id: string }>): Promise<void> {
    if (rows.length === 0) return;
    await call('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, rows }),
    });
}

/** Видаляє рядок за id. */
export async function contentDelete(table: string, id: string): Promise<void> {
    await call(`/api/admin/content?table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}
