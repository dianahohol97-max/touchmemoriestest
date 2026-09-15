import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { keycrmRequest } from '@/lib/automation/keycrm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/admin/keycrm/backfill-line-comments
 *
 * Разовий прохід: дотягнути специфікацію з карток KeyCRM у ВІДКРИТІ дзеркалені
 * замовлення, старші за два тижні.
 *
 * НАВІЩО. Дзеркало відтепер зберігає «Коментар» товарного рядка — там лежить
 * уся специфікація виробу, включно з написом на гравіювання. Але переглядає
 * воно лише останні чотирнадцять днів, тож старші замовлення не отримають її
 * ніколи: у картці менеджера так і лишиться сама назва товару.
 *
 * ОБСЯГ. Тільки відкриті замовлення (не доставлені й не скасовані) з
 * source = 'keycrm', старші за чотирнадцять днів. Доставлені свідомо не
 * чіпаємо: специфікація потрібна, щоб виготовити виріб, а вони вже в клієнта
 * (Діана, 15.09.2026).
 *
 * ЧОМУ ПО ОДНОМУ ЗАПИТУ. Списковий запит KeyCRM не вміє фільтрувати за id —
 * перевірено 14.09.2026, він відповідає 400 і перелічує дозволені фільтри.
 * Гортати список на шістсот позицій назад дорожче, ніж спитати про кожне
 * замовлення окремо.
 *
 * ТИПОВО НІЧОГО НЕ ПИШЕ. Без ?apply=1 маршрут лише рахує й показує приклади —
 * скільки замовлень мають специфікацію і скільки з них про гравіювання. Запис
 * умикається окремо й свідомо.
 */
export async function GET(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    if (!process.env.KEYCRM_API_TOKEN) {
        return NextResponse.json({ error: 'KEYCRM_API_TOKEN не заданий' }, { status: 500 });
    }

    const url = new URL(req.url);
    const apply = url.searchParams.get('apply') === '1';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 300, 1), 400);

    const admin = getAdminClient();
    const cutoff = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();

    const { data: orders, error } = await admin
        .from('orders')
        .select('id, order_number, items, custom_attributes')
        .eq('source', 'keycrm')
        .not('order_status', 'in', '("delivered","cancelled","refunded")')
        .lt('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return NextResponse.json({ error: `Не вдалося прочитати замовлення: ${error.message}` }, { status: 500 });
    }

    const stats = {
        scanned: 0,
        no_crm_id: 0,
        with_comment: 0,
        without_comment: 0,
        lines_filled: 0,
        mentions_engraving: 0,
        written: 0,
        failed: 0,
    };
    const sample: Array<{ order_number: string; lines: Array<{ name: string; comment: string }> }> = [];
    const errors: string[] = [];

    for (const o of orders || []) {
        const crmId = String((o as any)?.custom_attributes?.keycrm?.order_id ?? '').trim();
        if (!crmId) { stats.no_crm_id++; continue; }
        stats.scanned++;

        let lines: any[] = [];
        try {
            const payload = await keycrmRequest(`/order/${encodeURIComponent(crmId)}?include=products`);
            lines = Array.isArray(payload?.products) ? payload.products : [];
        } catch (e: any) {
            stats.failed++;
            if (errors.length < 10) errors.push(`${o.order_number}: ${e?.message || 'запит не вдався'}`);
            continue;
        }

        // Специфікації зіставляємо з позиціями за порядком: дзеркало будує
        // items із того самого масиву products, тож порядок збігається.
        const items: any[] = Array.isArray((o as any).items) ? (o as any).items : [];
        const filled: Array<{ name: string; comment: string }> = [];
        const merged = items.map((it, idx) => {
            const comment = String(lines[idx]?.comment ?? '').trim();
            if (!comment) return it;
            filled.push({ name: String(it?.product_name || it?.name || ''), comment });
            return { ...it, personalization_note: comment };
        });

        if (!filled.length) { stats.without_comment++; continue; }

        stats.with_comment++;
        stats.lines_filled += filled.length;
        if (filled.some(f => /гравіюв|гравірув|engrav/i.test(f.comment))) stats.mentions_engraving++;
        if (sample.length < 8) sample.push({ order_number: o.order_number, lines: filled });

        if (apply) {
            const { error: updErr } = await admin.from('orders').update({ items: merged }).eq('id', o.id);
            if (updErr) {
                stats.failed++;
                if (errors.length < 10) errors.push(`${o.order_number}: запис не вдався — ${updErr.message}`);
            } else {
                stats.written++;
            }
        }

        // Пауза між зверненнями до CRM: прохід разовий, поспішати нікуди.
        await new Promise(r => setTimeout(r, 120));
    }

    return NextResponse.json({
        mode: apply ? 'ЗАПИС' : 'лише перегляд (додайте ?apply=1, щоб записати)',
        stats,
        sample,
        errors,
    });
}
