import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { keycrmRequest } from '@/lib/automation/keycrm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/keycrm/line-comments
 *
 * Разова діагностика: чи приходить до нас «Коментар» рядка товару з KeyCRM.
 *
 * НАВІЩО. Напис на гравіювання в замовленнях з Інстаграма живе саме там —
 * у колонці «Коментар» товарного рядка, форматом «23х23, білі сторінки /
 * В-01, гравіювання / A&N». Дзеркало ці рядки розбирає, але з кожного бере
 * лише назву, артикул, кількість, ціну і властивості; поле comment воно не
 * читає взагалі. Через це попередження про емодзі, яке вже працює для
 * замовлень із сайту, для замовлень із CRM не має з чим працювати.
 *
 * ЩО САМЕ ПЕРЕВІРЯЄМО. Дзеркало ходить СПИСКОВИМ запитом (/order?...), а
 * функція для Софії — запитом по ОДНОМУ замовленню (/order/{id}). Відомо, що
 * другий коментарі віддає. Питання рівно одне: чи віддає їх перший. Від
 * відповіді залежить ціна доробки: якщо віддає, дзеркалу достатньо читати ще
 * одне поле; якщо ні, на кожне замовлення з гравіюванням доведеться робити
 * окремий запит, і це вже питання часу виконання крона.
 *
 * ЩО РОБИТЬ. Бере кілька дзеркалених замовлень із гравіюванням, питає про них
 * KeyCRM обома способами і показує поруч, що видно в кожному.
 *
 * ЩО НЕ РОБИТЬ. Не пише НІЧОГО — ні в базу, ні в CRM. Тільки читає й показує.
 *
 * Параметри: ?limit=N замовлень (типово 5, максимум 10).
 */

/** Рядок товару так, як його видно в конкретній відповіді API. */
interface LineView {
    name: string;
    comment: string | null;
    /** Усі ключі рядка — щоб побачити, як поле зветься, якщо зветься інакше. */
    keys: string[];
}

function readLines(payload: any): LineView[] {
    const rows: any[] = Array.isArray(payload?.products) ? payload.products : [];
    return rows.map(p => {
        // Коментар може називатися по-різному в різних версіях API, тож
        // дивимося на кілька написань і окремо віддаємо повний список ключів.
        const comment = [p?.comment, p?.note, p?.description, p?.properties_comment]
            .map(v => (typeof v === 'string' ? v.trim() : ''))
            .find(v => v) ?? null;
        return {
            name: String(p?.name ?? p?.product_name ?? '').trim(),
            comment,
            keys: p && typeof p === 'object' ? Object.keys(p) : [],
        };
    });
}

export async function GET(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    if (!process.env.KEYCRM_API_TOKEN) {
        return NextResponse.json({ error: 'KEYCRM_API_TOKEN не заданий' }, { status: 500 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 5, 1), 10);

    const admin = getAdminClient();
    // Фільтр за «Гравіюв» робимо вже тут, а не в запиті: items — це jsonb, і
    // текстовий пошук по ньому через PostgREST не проходить.
    const { data: recent, error } = await admin
        .from('orders')
        .select('order_number, created_at, items, custom_attributes')
        .eq('source', 'keycrm')
        .order('created_at', { ascending: false })
        .limit(300);

    if (error) {
        return NextResponse.json({ error: `Не вдалося прочитати замовлення: ${error.message}` }, { status: 500 });
    }

    const orders = (recent || [])
        .filter(o => /гравіюв|гравірув/i.test(JSON.stringify((o as any)?.items ?? '')))
        .slice(0, limit);

    const results: any[] = [];
    const errors: string[] = [];

    for (const o of orders || []) {
        const crmId = String((o as any)?.custom_attributes?.keycrm?.order_id ?? '').trim();
        if (!crmId) {
            errors.push(`${o.order_number}: немає id замовлення в CRM`);
            continue;
        }

        // 1. Так, як бачить ДЗЕРКАЛО: списковий запит, звужений до цього id.
        let listing: LineView[] | null = null;
        let listingError = '';
        for (const path of [
            `/order?filter[id]=${encodeURIComponent(crmId)}&limit=1&include=products`,
            `/order?filter[order_id]=${encodeURIComponent(crmId)}&limit=1&include=products`,
        ]) {
            try {
                const payload = await keycrmRequest(path);
                const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
                const row = rows.find(r => String(r?.id ?? '') === crmId) ?? rows[0];
                if (row) { listing = readLines(row); listingError = ''; break; }
                listingError = 'списковий запит не повернув це замовлення';
            } catch (e: any) {
                listingError = e?.message || 'запит не вдався';
            }
        }

        // 2. Так, як бачить функція для Софії: запит по одному замовленню.
        let single: LineView[] | null = null;
        let singleError = '';
        try {
            const payload = await keycrmRequest(`/order/${encodeURIComponent(crmId)}?include=products`);
            single = readLines(payload);
        } catch (e: any) {
            singleError = e?.message || 'запит не вдався';
        }

        results.push({
            order_number: o.order_number,
            crm_id: crmId,
            created_at: o.created_at,
            listing: listing
                ? listing.map(l => ({ name: l.name, comment: l.comment, has_comment: !!l.comment, line_keys: l.keys }))
                : `— ${listingError}`,
            single_order: single
                ? single.map(l => ({ name: l.name, comment: l.comment, has_comment: !!l.comment, line_keys: l.keys }))
                : `— ${singleError}`,
        });
    }

    const countFilled = (key: 'listing' | 'single_order') =>
        results.reduce((n, r) => n + (Array.isArray(r[key]) ? r[key].filter((l: any) => l.has_comment).length : 0), 0);

    return NextResponse.json({
        checked_orders: results.length,
        // Головна відповідь: скільки товарних рядків несуть коментар у кожному
        // зі способів. Нуль у списковому і не нуль в одиничному означає, що
        // дзеркалу знадобиться окремий запит на кожне замовлення.
        lines_with_comment: {
            listing: countFilled('listing'),
            single_order: countFilled('single_order'),
        },
        results,
        errors,
    });
}
