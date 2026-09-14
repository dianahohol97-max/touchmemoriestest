import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { classifyIncomingPayment, formatUah } from '@/lib/payment/misapplied-payment';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/admin/payments/invoice-audit
 *
 * Разова звірка: що про наші неоплачені рахунки думає банк.
 *
 * НАВІЩО. До 14.09.2026 вебхук Monobank відповідав на розбіжність суми кодом
 * 400 і не писав у базу нічого. Якщо клієнт заплатив за посиланням, виставленим
 * ДО того, як суму замовлення змінили, гроші списувались, а замовлення
 * лишалося неоплаченим — і сліду не було ніде, бо відмова нічого не записує.
 * Вебхук уже виправлено, але він не бачить минулого: платежі, відкинуті раніше,
 * Monobank давно перестав повторювати. Єдине джерело правди про них — банк.
 *
 * ЩО РОБИТЬ. Бере всі неоплачені й нескасовані замовлення, у яких є
 * monobank_invoice_id, і питає банк про кожен рахунок через invoice/status.
 * Повертає ті, які банк вважає оплаченими, із сумою, датою і номером
 * замовлення, і окремо позначає ті, де сума банку не збігається з сумою
 * замовлення — це і є випадок, який вебхук колись відкинув.
 *
 * ЩО НЕ РОБИТЬ. Не пише НІЧОГО: ні статусів, ні paid_amount, ні історії. Це
 * свідомо: рішення про гроші, які знайдуться, ухвалює людина, подивившись на
 * список. Маршрут читає базу і банк, і більше нічого.
 *
 * Параметри: ?limit=N (типово 200), ?include_cancelled=1 щоб додати скасовані.
 */
export async function GET(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 200, 1), 500);
    const includeCancelled = url.searchParams.get('include_cancelled') === '1';

    const admin = getAdminClient();

    let query = admin
        .from('orders')
        .select('id, order_number, created_at, total, prepaid_amount, payment_type, payment_status, order_status, monobank_invoice_id, monobank_invoice_status, paid_amount, customer_name')
        .not('monobank_invoice_id', 'is', null)
        .neq('payment_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (!includeCancelled) query = query.neq('order_status', 'cancelled');

    const { data: orders, error } = await query;
    if (error) {
        return NextResponse.json({ error: `Не вдалося прочитати замовлення: ${error.message}` }, { status: 500 });
    }

    // Той самий набір токенів, що й у ручній перевірці оплати: обидва активні
    // рахунки з bank_accounts плюс env як запасний варіант. Перший токен, який
    // упізнав рахунок, пробуємо першим і далі — рахунки майже завжди одного ФОПа.
    const tokens: string[] = [];
    const { data: accounts } = await admin
        .from('bank_accounts')
        .select('api_key')
        .eq('bank_name', 'Monobank')
        .eq('is_active', true);
    for (const a of accounts || []) if (a.api_key) tokens.push(a.api_key);
    if (process.env.MONOBANK_TOKEN) tokens.push(process.env.MONOBANK_TOKEN);
    if (process.env.MONOBANK_TOKEN_INTL) tokens.push(process.env.MONOBANK_TOKEN_INTL);
    const uniqueTokens = Array.from(new Set(tokens));
    if (uniqueTokens.length === 0) {
        return NextResponse.json({ error: 'Немає жодного токена Monobank' }, { status: 500 });
    }
    let preferred = 0;

    const paidAtBank: any[] = [];
    const errors: any[] = [];
    const statusCounts: Record<string, number> = {};

    let first = true;
    for (const order of orders || []) {
        // Ввічлива пауза між запитами: шістдесят рахунків підряд — це наш
        // разовий сплеск, а не нормальний трафік банку.
        if (!first) await new Promise(r => setTimeout(r, 120));
        first = false;

        const invoiceId = String(order.monobank_invoice_id);
        let bank: any = null;
        let lastErr = '';

        const order2 = [uniqueTokens[preferred], ...uniqueTokens.filter((_, i) => i !== preferred)];
        for (let i = 0; i < order2.length; i++) {
            const token = order2[i];
            try {
                const r = await fetch(
                    `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
                    { headers: { 'X-Token': token }, cache: 'no-store' },
                );
                if (r.ok) {
                    bank = await r.json();
                    preferred = uniqueTokens.indexOf(token);
                    break;
                }
                lastErr = `HTTP ${r.status}`;
            } catch (e: any) {
                lastErr = e?.message || 'запит не вдався';
            }
        }

        if (!bank?.status) {
            errors.push({ order_number: order.order_number, invoice_id: invoiceId, reason: lastErr || 'банк не відповів' });
            continue;
        }

        const status = String(bank.status);
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (status !== 'success' && status !== 'hold') continue;

        // Та сама арифметика, що й у вебхуку: split платить передоплату, решта
        // повну суму. Розбіжність рахує спільне правило, щоб два місця не
        // розійшлися у визначенні «збіглося».
        const isSplit = order.payment_type === 'split' && Number(order.prepaid_amount) > 0;
        const expectedUah = isSplit ? Number(order.prepaid_amount) : Number(order.total);
        const verdict = classifyIncomingPayment({
            invoiceId,
            currentInvoiceId: invoiceId,
            paidKopecks: Number(bank.amount),
            expectedUah,
        });

        paidAtBank.push({
            order_number: order.order_number,
            order_id: order.id,
            customer: order.customer_name,
            created: String(order.created_at).slice(0, 16).replace('T', ' '),
            invoice_id: invoiceId,
            bank_status: status,
            bank_amount: formatUah(Number(bank.amount) / 100),
            bank_date: String(bank.modifiedDate || bank.createdDate || '').slice(0, 16).replace('T', ' '),
            order_total: formatUah(Number(order.total)),
            expected: formatUah(expectedUah),
            mismatch: verdict.kind === 'misapplied',
            diff: verdict.kind === 'misapplied' ? formatUah(verdict.diffUah) : null,
            site_status: `${order.payment_status} / ${order.monobank_invoice_status || '—'}`,
        });
    }

    return NextResponse.json({
        checked: (orders || []).length,
        paid_at_bank_count: paidAtBank.length,
        mismatched_count: paidAtBank.filter(r => r.mismatch).length,
        bank_status_counts: statusCounts,
        paid_at_bank: paidAtBank,
        errors,
        note: 'Тільки читання — жодне замовлення не змінено.',
    });
}
