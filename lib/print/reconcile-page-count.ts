import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Make the order say what the design actually is.
 *
 * TM-001211 (Diana, 2026-08-19): the order line said «20 сторінок» and charged
 * 975 ₴, while the saved design held 22 photo pages. The customer added the last
 * spread as she was checking out — the cart line had already been built at 20,
 * and the editor's sixty-second autosave wrote 22 into the project two seconds
 * after the order was created. Both numbers are genuine; they were simply read
 * at different moments.
 *
 * The design is what gets printed, so the design is the truth. Diana's ruling on
 * that order is the rule here: print what the customer designed and do not chase
 * the difference. This brings the order line up to the real count so production
 * and the CRM stop disagreeing with the printer, and leaves a note naming both
 * numbers so nobody thinks the money was miscounted.
 *
 * A design with FEWER pages than the line is only reported, never trimmed: the
 * customer paid for those pages, and quietly printing less is the one outcome
 * worse than the mismatch itself.
 */

const NOTE_MARKER = 'звірка сторінок';

/**
 * Photo pages in a saved book design — the number the customer is charged for.
 *
 * This MUST mirror BookLayoutEditor's `billableContentPages` exactly, and the
 * first version of it did not: it looked at `enableEndpaper`, which is the paid
 * «друк на форзаці» option, and concluded that twelve perfectly correct orders
 * were each two pages short. The editor's rule is different in two ways, and
 * both matter.
 *
 * First, the forzats are not optional. Travel books, magazines and journals
 * ALWAYS build two extra physical pages for them, whatever the customer chose
 * about printing on them — the flag buys the printing, not the pages.
 *
 * Second, the adjustment is by array SHAPE, not by flag: only a build whose
 * physical content reaches ordered + 2 carries the forzats as extra pages. Older
 * designs kept the forzats inside the ordered count and must be left alone.
 */
export function designContentPages(project: any, orderedFromLine: number | null): number | null {
    const pages = Array.isArray(project?.pages_data) ? project.pages_data : null;
    if (!pages || pages.length < 2) return null;

    const slug = String(
        project?.overlays_data?.config?.productSlug || project?.product_type || '',
    ).toLowerCase();
    const hasEndpaper = /travelbook|magazine|journal|fotozhurnal/.test(slug);

    const content = pages.length - 1; // pages[0] is the cover
    const usesForzatExtra =
        hasEndpaper && !!orderedFromLine && content >= orderedFromLine + 2;

    return Math.max(0, content - (usesForzatExtra ? 2 : 0));
}

/** The page count written on an order line, or null when the line has none. */
export function linePageCount(item: any): number | null {
    const opts = item?.options;
    if (!opts || typeof opts !== 'object') return null;
    for (const [key, value] of Object.entries(opts)) {
        if (!/сторін|page/i.test(key)) continue;
        if (/колір|color/i.test(key)) continue; // «Колір сторінок» is not a count
        const n = parseInt(String(value).replace(/\D/g, ''), 10);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
}

export type ReconcileResult = {
    orderNumber: string;
    lineCount: number;
    designCount: number;
    action: 'raised' | 'reported';
};

/**
 * Compare one order against its linked design. Returns null when there is
 * nothing to say — no design, no page line, or the two already agree.
 */
export async function reconcileOrderPageCount(orderId: string): Promise<ReconcileResult | null> {
    const admin = getAdminClient();

    const { data: order } = await admin
        .from('orders')
        .select('id, order_number, items, notes')
        .eq('id', orderId)
        .maybeSingle();
    if (!order || !Array.isArray(order.items) || !order.items.length) return null;
    if (String(order.notes || '').includes(NOTE_MARKER)) return null; // already handled

    const { data: projects } = await admin
        .from('projects')
        .select('id, product_type, pages_data, overlays_data, updated_at')
        .eq('order_id', orderId)
        .order('updated_at', { ascending: false })
        .limit(1);
    const design = (projects || [])[0];
    if (!design) return null;

    // Only a line that carries a page count can disagree about one.
    const items = order.items as any[];
    const index = items.findIndex(it => linePageCount(it) !== null);
    if (index < 0) return null;

    // A книга побажань is a fixed 32-page block whose inner pages are never
    // designed — only the cover is. Its design will always look "short", and
    // saying so every night would be pure noise.
    const lineSlug = `${items[index]?.slug || ''} ${items[index]?.product_name || ''}`.toLowerCase();
    if (/wish|guest|pobazhan|побажан/.test(lineSlug)) return null;

    const lineCount = linePageCount(items[index])!;
    const designCount = designContentPages(design, lineCount);
    if (!designCount) return null;
    if (lineCount === designCount) return null;

    const action: ReconcileResult['action'] = designCount > lineCount ? 'raised' : 'reported';

    const note = action === 'raised'
        ? `📄 Автоматична звірка сторінок: у макеті ${designCount} сторінок, а в замовленні було записано ${lineCount}. Клієнт(ка) дозамовила розворот уже під час оформлення. Друкуємо ${designCount} — доплату не просимо (правило Diana від 19.08). Кількість у замовленні виправлена на ${designCount}.`
        : `📄 Автоматична звірка сторінок: у замовленні ${lineCount} сторінок, а в макеті лише ${designCount}. Оплачено більше, ніж намальовано — перевірте з клієнтом(кою) перед друком. Кількість у замовленні НЕ змінювали.`;

    const patch: Record<string, any> = {
        notes: String(order.notes || '').trim()
            ? `${note}\n\n${String(order.notes).trim()}`
            : note,
    };

    if (action === 'raised') {
        const nextItems = items.map((it, i) => {
            if (i !== index) return it;
            const options = { ...(it.options || {}) };
            for (const key of Object.keys(options)) {
                if (/сторін|page/i.test(key) && !/колір|color/i.test(key)) {
                    options[key] = `${designCount} сторінок`;
                }
            }
            return { ...it, options };
        });
        patch.items = nextItems;
    }

    const { error } = await admin.from('orders').update(patch).eq('id', orderId);
    if (error) {
        console.error('[reconcile-pages] update failed', order.order_number, error.message);
        return null;
    }

    await admin.from('order_history').insert({
        order_id: orderId,
        action: 'page_count_reconciled',
        notes: `Макет: ${designCount} стор., замовлення: ${lineCount} стор. — ${action === 'raised' ? `виправлено на ${designCount}` : 'лише позначено'}.`,
        added_by: null,
    });

    return { orderNumber: order.order_number, lineCount, designCount, action };
}
