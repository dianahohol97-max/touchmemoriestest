import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { shouldLinkOrder } from '@/lib/customers/name-match';
import { normaliseEmail } from '@/lib/customers/link-guest-orders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Скільки рядків PostgREST віддає за один запит. Те саме число, що в /api/admin/clients. */
const PAGE = 1000;

/**
 * Разовий прохід по гостьових замовленнях, які накопичилися ДО того, як
 * прив'язка з'явилася при реєстрації.
 *
 * Те, що робиться при реєстрації для однієї людини, тут робиться для всіх
 * одразу і тим самим правилом — lib/customers/name-match.ts. Двох різних
 * правил бути не має: розійшовшись, вони дали б два різні уявлення про те, чиє
 * замовлення чиє.
 *
 * ЗА ЗАМОВЧУВАННЯМ НІЧОГО НЕ ПИШЕ. Щоб щось змінилося в базі, у тілі запиту
 * має стояти рівно `dryRun: false`; будь-що інше, включно з відсутністю поля,
 * означає холостий прохід зі звітом. Це масовий запис по сотнях замовлень, і
 * випадковий виклик коштував би дорожче за будь-яку незручність.
 *
 * Дзеркалені з KeyCRM пропускаються, як і при реєстрації: вони приходять із
 * CRM зі своєю моделлю клієнта, і це чужа область.
 */

interface Plan {
    orderId: string;
    orderNumber: string | null;
    customerId: string;
    email: string;
    cardName: string | null;
    orderName: string | null;
    total: number;
    createdAt: string | null;
    verdict: 'match' | 'review';
    reason: string;
}

async function readAll(admin: any, table: string, select: string, shape: (q: any) => any) {
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await shape(admin.from(table).select(select)).range(from, from + PAGE - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        rows.push(...(data || []));
        if (!data || data.length < PAGE) break;
    }
    return rows;
}

export async function POST(req: Request) {
    // Право те саме, що на рішення по одній парі: це запис у чужі картки.
    const guard = await requireSection('customers', 'edit');
    if (!guard.ok) return guard.response;

    let body: { dryRun?: unknown } = {};
    try { body = await req.json(); } catch { /* порожнє тіло — холостий прохід */ }

    // Саме === false, а не !dryRun: відсутнє поле, null, 0 і рядок 'false' усі
    // мають лишатися холостим проходом.
    const dryRun = body?.dryRun !== false;

    const admin = getAdminClient();

    try {
        const customers = await readAll(
            admin, 'customers', 'id, email, name, phone',
            (q: any) => q.is('deleted_at', null).not('email', 'is', null).order('created_at', { ascending: true }),
        );

        // Пошта в customers унікальна (customers_email_key), тож мапа
        // однозначна. Якщо колись з'являться дублі, перший виграє, і це видно
        // в лічильнику нижче.
        const byEmail = new Map<string, any>();
        let duplicateEmails = 0;
        for (const c of customers) {
            const em = normaliseEmail(c.email);
            if (!em) continue;
            if (byEmail.has(em)) { duplicateEmails++; continue; }
            byEmail.set(em, c);
        }

        const orders = await readAll(
            admin, 'orders',
            'id, order_number, created_at, total, customer_email, customer_name, customer_phone, source',
            (q: any) => q.is('customer_id', null)
                .is('link_review_rejected_at', null)
                .not('customer_email', 'is', null)
                .order('created_at', { ascending: true }),
        );

        const plans: Plan[] = [];
        let skippedKeycrm = 0;
        let noAccount = 0;

        for (const o of orders) {
            if (o.source === 'keycrm') { skippedKeycrm++; continue; }
            const em = normaliseEmail(o.customer_email);
            const customer = em ? byEmail.get(em) : null;
            if (!customer) { noAccount++; continue; }

            const v = shouldLinkOrder({
                cardName: customer.name,
                orderName: o.customer_name,
                cardPhone: customer.phone,
                orderPhone: o.customer_phone,
            });

            plans.push({
                orderId: o.id,
                orderNumber: o.order_number ?? null,
                customerId: customer.id,
                email: em!,
                cardName: customer.name ?? null,
                orderName: o.customer_name ?? null,
                total: Number(o.total) || 0,
                createdAt: o.created_at ?? null,
                verdict: v.verdict,
                reason: v.reason,
            });
        }

        const toLink = plans.filter((p) => p.verdict === 'match');
        const toReview = plans.filter((p) => p.verdict === 'review');

        const summary = {
            dryRun,
            scannedOrders: orders.length,
            skippedKeycrm,
            noAccount,
            wouldLink: toLink.length,
            wouldReview: toReview.length,
            duplicateEmails,
        };

        if (dryRun) {
            return NextResponse.json({
                ...summary,
                note: 'Холостий прохід: у базі нічого не змінено. Щоб застосувати, надішліть {"dryRun": false}.',
                sampleLink: toLink.slice(0, 20),
                sampleReview: toReview.slice(0, 20),
            });
        }

        // ── бойовий прохід ───────────────────────────────────────────────
        const now = new Date().toISOString();
        let linked = 0;
        let flagged = 0;

        for (const p of toLink) {
            // Умова customer_id is null стоїть у WHERE: між читанням і записом
            // замовлення міг прив'язати хтось інший, і перезаписувати його
            // рішення не можна.
            const { data: updated } = await admin
                .from('orders')
                .update({ customer_id: p.customerId, updated_at: now })
                .eq('id', p.orderId)
                .is('customer_id', null)
                .select('id')
                .maybeSingle();

            if (!updated) continue;
            linked++;

            // Слід у історії. Без нього через півроку буде незрозуміло, чому
            // замовлення раптом належить акаунту, хоча оформлювалося гостем.
            await admin.from('order_history').insert({
                order_id: p.orderId,
                action: 'customer_linked',
                notes: `Прив'язано до акаунта ${p.email} разовим проходом, а не при оформленні. `
                     + `Ім'я в картці: «${p.cardName ?? '—'}», у замовленні: «${p.orderName ?? '—'}». `
                     + `Підстава: ${p.reason}.`,
                added_by: null,
            });
        }

        for (const p of toReview) {
            const { data: updated } = await admin
                .from('orders')
                .update({
                    link_candidate_customer_id: p.customerId,
                    link_candidate_at: now,
                    link_candidate_reason: p.reason,
                })
                .eq('id', p.orderId)
                .is('customer_id', null)
                .select('id')
                .maybeSingle();
            if (updated) flagged++;
        }

        console.log('[link-backfill] applied', { linked, flagged, ...summary });

        return NextResponse.json({
            ...summary,
            applied: true,
            linked,
            flagged,
            note: 'Прив’язано автоматично лише те, де ім’я зійшлося. Решта чекає на менеджера в розділі «Клієнти».',
        });
    } catch (e: any) {
        console.error('[link-backfill] failed', e?.message || e);
        return NextResponse.json({ error: e?.message || 'Прохід не вдався' }, { status: 500 });
    }
}
