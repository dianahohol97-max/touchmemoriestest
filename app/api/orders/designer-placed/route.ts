import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';
import DesignerOrderPlacedEmail from '@/components/email/DesignerOrderPlacedEmail';
import { getAutomationConfig } from '@/lib/email/automation-config';
import {
    findRecentSuccessfulSend,
    htmlToTextSnapshot,
    logOutgoingEmail,
    readSendOutcome,
} from '@/lib/email/log-outgoing';

export const dynamic = 'force-dynamic';

/**
 * Лист «заявку прийнято» для потоку з дизайнером.
 *
 * ЧОМУ ОКРЕМИЙ РОУТ. Звичайний чекаут шле цей лист із сервера, бо і замовлення
 * створюється там. Потік із дизайнером вставляє замовлення прямо з браузера і
 * через /api/orders/submit не проходить, тож листа не слав НІХТО — людина
 * бачила екран «Замовлення відправлено» і після того тишу. TM-001320 (Юлія
 * Джулай, девʼятнадцять фото) пролежало так дві доби, поки клієнтка не
 * написала в дирекг сама (Діана, 17.09.2026).
 *
 * /api/email/transactional сюди не годиться: він вимагає або адмінської сесії,
 * або службового секрета, а тут кличе браузер клієнта.
 *
 * ЧОМУ ЦЕ НЕ ВІДКРИТИЙ РЕЛЕЙ. Адреса не приходить у запиті взагалі — вона
 * читається з самого замовлення, тож надіслати листа комусь іншому неможливо.
 * Далі три засувки: замовлення мусить бути саме з дизайнером, створене не
 * більш ніж WINDOW_MIN хвилин тому, і лист за ним ще не йшов. Найгірше, що
 * може зробити чужий, — змусити нас надіслати справжньому клієнтові рівно той
 * лист, який він і так отримає за секунду.
 */

/** Наскільки свіжим має бути замовлення. Форму щойно відправили, отже хвилини. */
const WINDOW_MIN = 30;

export async function POST(req: Request) {
    let orderId = '';
    try {
        const body = await req.json();
        orderId = String(body?.orderId || '');
    } catch {
        return NextResponse.json({ error: 'expected json' }, { status: 400 });
    }
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: 'storage unavailable' }, { status: 503 });

    const { data: order, error } = await admin
        .from('orders')
        .select('id, order_number, customer_name, customer_email, with_designer, created_at, notes, custom_attributes')
        .eq('id', orderId)
        .single();

    if (error || !order) return NextResponse.json({ error: 'order not found' }, { status: 404 });
    if (!order.with_designer) return NextResponse.json({ error: 'not a designer order' }, { status: 400 });

    const ageMs = Date.now() - new Date(order.created_at).getTime();
    if (!(ageMs >= 0) || ageMs > WINDOW_MIN * 60 * 1000) {
        return NextResponse.json({ error: 'order is not fresh' }, { status: 409 });
    }
    if (!order.customer_email) {
        return NextResponse.json({ ok: true, skipped: 'no email' });
    }

    // Той самий вимикач, що й для решти листів про оформлення.
    const cfg = await getAutomationConfig('order_placed');
    if (cfg && !cfg.enabled) {
        return NextResponse.json({ ok: true, skipped: 'order_placed disabled in admin' });
    }

    // Повтор не шлемо. Перевіряється факт успішної відправки, а не намір, тож
    // провалена спроба лишається повторюваною.
    const already = await findRecentSuccessfulSend({ orderId: order.id, template: 'order_placed' });
    if (already) return NextResponse.json({ ok: true, skipped: 'already sent', firstSentAt: already.sent_at });

    const attrs = (order.custom_attributes || {}) as any;
    const attached = Number(attrs.photos_attached) || 0;
    const submitted = Number(attrs.photos_submitted) || attached;
    const delivery = [attrs.city, attrs.address].filter(Boolean).join(', ');

    // Побажання лежить у notes між роздільниками, у рядку «Коментар: …».
    const wish = String(order.notes || '')
        .split('\n---\n')
        .map(s => s.trim())
        .find(s => s.startsWith('Коментар:'))
        ?.replace(/^Коментар:\s*/, '') || '';

    const subject = `Заявку №${order.order_number} прийнято`;
    const html = await render(DesignerOrderPlacedEmail({
        orderNumber: order.order_number,
        customerName: String(order.customer_name || '').split(' ')[0] || String(order.customer_name || ''),
        photosAttached: attached,
        photosSubmitted: submitted,
        deliveryAddress: delivery,
        wish,
    }));

    const res = await sendEmail({ to: order.customer_email, subject, html }).catch(e => ({ success: false, error: e }));
    const outcome = readSendOutcome(res);

    await logOutgoingEmail({
        orderId: order.id,
        to: order.customer_email,
        template: 'order_placed',
        subject,
        body: htmlToTextSnapshot(html),
        actor: null,
        outcome,
    });

    return NextResponse.json({ ok: outcome.sent, error: outcome.error || undefined });
}
