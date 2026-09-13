import { NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';
import { parseDeliveryEvent, shouldApplyEvent, type DeliveryEvent } from '@/lib/email/delivery-events';

export const dynamic = 'force-dynamic';

/**
 * Статуси доставки від Brevo.
 *
 * Журнал вихідних листів знав лише «ми віддали листа провайдеру». Чи він дійшов
 * до людини, чи відскочив, чи впав у спам — не знав ніхто, і менеджер не мав
 * жодного сигналу про те, що клієнт листа не бачив. Цей маршрут і закриває цю
 * діру: Brevo присилає сюди подію, вона звіряється з рядком за
 * provider_message_id, і рядок дізнається свою долю.
 *
 * ЗАХИСТ. Ендпоінт публічний, і на відміну від Monobank, Brevo не підписує
 * вебхуки — перевіряти криптографію нічим. Тому спільний секрет у заголовку
 * x-webhook-secret, який знає тільки налаштований у панелі Brevo вебхук.
 * Порівняння в постійному часі, бо посимвольне порівняння тече через тайминг.
 * Секрет живе ТІЛЬКИ в заголовку: параметр в URL осідав би в логах кожного
 * проксі на шляху.
 *
 * Без BREVO_WEBHOOK_SECRET маршрут відповідає 503 і не приймає нічого. Це та
 * сама позиція, що й у вебхука Monobank без публічного ключа: краще не
 * працювати, ніж мовчки приймати неперевірені дані в базу.
 */

/** Скільки подій приймаємо за один запит. Brevo шле по одній, пакет — запас. */
const MAX_EVENTS_PER_REQUEST = 100;

function secretMatches(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    // timingSafeEqual кидає на різній довжині, а сама довжина — це вже витік,
    // тож спершу зводимо до однакової довжини через хеш.
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: Request) {
    const expected = process.env.BREVO_WEBHOOK_SECRET || '';
    if (!expected) {
        console.error('[brevo-webhook] BREVO_WEBHOOK_SECRET не налаштовано — події не приймаються');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const provided = req.headers.get('x-webhook-secret') || '';
    if (!provided || !secretMatches(provided, expected)) {
        // Без подробиць: тому, хто вгадує, не треба підказувати, чи він близько.
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Тіло читається ДО відповіді — потік не можна прочитати після того, як
    // відповідь пішла. Це дешево; важка робота нижче.
    let payload: any;
    try {
        payload = await req.json();
    } catch {
        // Нерозбірливе тіло не варто просити повторити: повтор буде таким самим.
        console.error('[brevo-webhook] тіло не є JSON');
        return NextResponse.json({ ok: true, ignored: 'unparsable body' });
    }

    const events = Array.isArray(payload) ? payload.slice(0, MAX_EVENTS_PER_REQUEST) : [payload];

    // Відповідь іде ЗАРАЗ, робота — після неї.
    //
    // Brevo повторює запит на таймаут, і кожен повтор — це ще одна спроба
    // застосувати ту саму подію. Робота тут коротка (один пошук за індексом і
    // один update), але «коротка» не означає «гарантовано швидка»: холодний
    // старт функції плюс повільна відповідь бази складаються рівно в той
    // таймаут, якого ми хочемо уникнути.
    //
    // after() з next/server — єдиний надійний спосіб на Vercel. Проста
    // плаваюча проміса тут не годиться: лямбда засинає одразу після відповіді,
    // і робота просто не виконується. Цей репозиторій уже наступав на це в
    // create-invoice, де лист «замовлення прийнято» два дні нікуди не йшов.
    after(async () => {
        for (const raw of events) {
            try {
                await applyEvent(raw);
            } catch (e) {
                console.error('[brevo-webhook] подія не оброблена', e);
            }
        }
    });

    return NextResponse.json({ ok: true, accepted: events.length }, { status: 202 });
}

async function applyEvent(raw: any): Promise<void> {
    const parsed = parseDeliveryEvent(raw);

    if (parsed.kind === 'ignored') return;

    if (parsed.kind === 'unknown') {
        // Невідома подія — це сигнал, що Brevo додав щось нове, а не привід
        // упасти. Її видно в логах, і відповідь клієнту вже пішла як 2xx.
        console.warn('[brevo-webhook] невідомий тип події:', parsed.rawEvent);
        return;
    }

    if (parsed.kind === 'unusable') {
        console.warn('[brevo-webhook] подію не вдалося розібрати:', parsed.reason);
        return;
    }

    await applyDeliveryEvent(parsed.event);
}

async function applyDeliveryEvent(event: DeliveryEvent): Promise<void> {
    const admin = getAdminClient();

    // Пошук за нормалізованим ідентифікатором. logOutgoingEmail зберігає його
    // вже нормалізованим, тож обидва боки в одному вигляді.
    const { data: row, error } = await admin
        .from('email_logs')
        .select('id, delivery_status, delivery_updated_at, delivered_at')
        .eq('provider_message_id', event.messageId)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[brevo-webhook] пошук рядка впав', { messageId: event.messageId, error: error.message });
        return;
    }
    if (!row) {
        // Нормальний випадок, а не поломка: сюди потрапляють листи розсилки
        // (їхній messageId не зберігається ніде) і вся пошта, надіслана до
        // 13.09.2026, коли provider_message_id ще не писався.
        console.warn('[brevo-webhook] рядка під подію немає', { messageId: event.messageId, event: event.rawEvent });
        return;
    }

    if (!shouldApplyEvent(event.occurredAt, (row as any).delivery_updated_at)) {
        // Подія старша за те, що вже стоїть. Саме так виглядає deferred, який
        // доїхав після delivered.
        return;
    }

    const patch: Record<string, any> = {
        delivery_status: event.status,
        delivery_detail: event.detail,
        delivery_updated_at: (event.occurredAt || new Date()).toISOString(),
    };

    // delivered_at ставиться один раз і більше не рухається: пізніша скарга на
    // спам не скасовує того, що лист свого часу дійшов.
    if (event.status === 'delivered' && !(row as any).delivered_at) {
        patch.delivered_at = (event.occurredAt || new Date()).toISOString();
    }

    const { error: updErr } = await admin.from('email_logs').update(patch).eq('id', (row as any).id);
    if (updErr) {
        console.error('[brevo-webhook] запис події впав', { id: (row as any).id, error: updErr.message });
    }
}

/**
 * Brevo під час налаштування вебхука перевіряє URL звичайним GET.
 * Відповідаємо коротко і без секретів — тіла тут немає, тож і захищати нічого.
 */
export async function GET() {
    return NextResponse.json({ ok: true, endpoint: 'brevo-delivery-events' });
}
