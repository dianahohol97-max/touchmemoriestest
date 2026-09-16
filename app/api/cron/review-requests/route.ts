import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getBrevoApiKey } from '@/lib/email/brevo';
import { sendReviewRequest, REVIEW_AUTOMATION_TYPE } from '@/lib/email/review-request';
import { pickReviewTargets, REVIEW_REQUEST_RULES } from '@/lib/email/review-request-targets';

export const dynamic = 'force-dynamic';

/**
 * Прохання про відгук — той самий крон, якого бракувало.
 *
 * Маршрут /api/reviews/request існує давно і написаний як виконавець: він чекає
 * POST із конкретним orderId. Того, хто вирішує «кому і коли», не було ніколи,
 * у vercel.json його не було, у коді на нього не посилався ніхто — і за весь
 * час він не надіслав жодного листа. При 724 доставлених замовленнях у нас
 * вісім відгуків (Діана, 16.09.2026).
 *
 * Відбір тут, відправка в lib/email/review-request — щоб цей крон і ручний
 * виклик слали однаково.
 */

/**
 * Скільки рядків тягнемо, перш ніж застосувати правила з журналу.
 *
 * Свідомо більше за все можливе вікно: у найгустіший день під умови дати
 * підпадало 124 замовлення. Відсівати в JS рядки ПІСЛЯ ліміту можна тільки
 * так — інакше це лотерея (гоча 13 у CLAUDE.md).
 */
const CANDIDATE_SCAN = 500;

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!getBrevoApiKey()) {
        return NextResponse.json({ message: 'BREVO_API_KEY not configured — skipped', sent: 0 });
    }

    const supabase = getAdminClient();
    const now = new Date();
    const R = REVIEW_REQUEST_RULES;
    const deliveredFrom = new Date(now.getTime() - R.maxDaysAfterDelivery * 86400000).toISOString();
    const deliveredTo = new Date(now.getTime() - R.minDaysAfterDelivery * 86400000).toISOString();
    const createdFrom = new Date(now.getTime() - R.maxOrderAgeDays * 86400000).toISOString();

    try {
        // Усі умови, які вміє база, стоять у самому запиті, а не після ліміту.
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, order_number, customer_name, customer_email, items, delivered_at, created_at')
            .eq('order_status', 'delivered')
            .not('customer_email', 'is', null)
            .neq('customer_email', '')
            .gte('delivered_at', deliveredFrom)
            .lte('delivered_at', deliveredTo)
            .gte('created_at', createdFrom)
            .order('delivered_at', { ascending: true })
            .limit(CANDIDATE_SCAN);
        if (error) throw error;

        if (!orders || orders.length === 0) {
            return NextResponse.json({ message: 'Немає замовлень під умови', candidates: 0, sent: 0 });
        }

        const ids = orders.map(o => o.id);
        const cooldownFrom = new Date(now.getTime() - R.customerCooldownDays * 86400000).toISOString();

        const [{ data: requestLog }, { data: reviewed }] = await Promise.all([
            supabase
                .from('email_automation_log')
                .select('email, sent_at, meta')
                .eq('automation_type', REVIEW_AUTOMATION_TYPE)
                .gte('sent_at', cooldownFrom),
            // Відгук по замовленню вже є — питати вдруге нема про що.
            supabase.from('reviews').select('order_id').in('order_id', ids),
        ]);

        const targets = pickReviewTargets({
            orders: orders as any,
            requestLog: (requestLog || []) as any,
            reviewedOrderIds: (reviewed || []).map((r: any) => r.order_id),
            now,
        });

        let sent = 0;
        let errors = 0;
        for (const target of targets) {
            const order = orders.find(o => o.id === target.id)!;
            const result = await sendReviewRequest(order as any);
            if (result.sent) sent++; else errors++;
        }

        return NextResponse.json({
            message: 'Review-request cron executed',
            candidates: orders.length,
            picked: targets.length,
            sent,
            errors,
        });
    } catch (err: any) {
        console.error('[review-requests] cron error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
