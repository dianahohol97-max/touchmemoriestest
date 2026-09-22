import { NextResponse } from 'next/server';
import { requireStaff, getSession } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { layoutsReplacedBy, newerThanDraft } from '@/lib/orders/layout-replacement';

export const dynamic = 'force-dynamic';

/**
 * Заміна макета замовлення виправленою копією дизайнера.
 *
 * НАВІЩО. Оверлей розмітки на /print?guides=1 регулярно ловить реальну біду:
 * клієнт заганяє підпис під лінію обрізу, і в друк це пускати не можна
 * (TM-001257 — текст журналу залазив за край і на корінець). Виправити це
 * дизайнер не міг: у таблиці projects єдина політика доступу — auth.uid() =
 * user_id, тобто відкрити чужий макет у конструкторі не має права ніхто, крім
 * власника. Кнопка «Макет → мої чернетки» вже робила половину справи —
 * копіювала макет у власні чернетки співробітника, де він СВІЙ і редагується
 * вільно, — але зворотного шляху не існувало: «Перегенерувати макет» рендерить
 * проєкт, привʼязаний до замовлення, тобто оригінал клієнта, а копію не бачить.
 * Виправлення доводилось вивантажувати з конструктора руками і заливати як
 * файли. Цей роут замикає цикл.
 *
 * GET  — чернетки ЦЬОГО співробітника, придатні як заміна для цього замовлення.
 * POST — ставить обрану чернетку на замовлення замість поточного макета.
 *
 * Оригінал клієнта не чіпаємо: рядок лишається цілим у його акаунті, лише
 * знімається привʼязка до замовлення. Що саме на що замінили, пишемо в
 * order_history — інакше після заміни неможливо довести, який макет клієнт
 * подав насправді.
 */

/**
 * Чернетки співробітника, придатні як заміна для цього замовлення.
 *
 * Основне джерело — позначка fix_for_order_id, яку ставить clone-project-to-me.
 * Пошук за збігом назви лишається запасним: копії, зроблені до появи колонки,
 * мають лише назву «TM-XXXXXX — переекспорт», і викидати їх зі списку не можна.
 * Перейменована чернетка з новим механізмом уже не зникає.
 */
async function candidatesFor(
    admin: ReturnType<typeof getAdminClient>,
    staffUserId: string,
    orderId: string,
    orderNumber: string,
) {
    // created_at і cart_payload їдуть у список свідомо: перше показує людині,
    // коли зроблено кандидата (щоб не поставити старішу версію замість
    // новішої), друге — ключ позиції, за яким рахується заміна.
    const fields = 'id, name, product_type, format, total_pages, updated_at, created_at, order_id, cart_payload';
    const [marked, named] = await Promise.all([
        admin.from('projects').select(fields)
            .eq('user_id', staffUserId).is('order_id', null)
            .eq('fix_for_order_id', orderId)
            .order('updated_at', { ascending: false }).limit(20),
        admin.from('projects').select(fields)
            .eq('user_id', staffUserId).is('order_id', null)
            .is('fix_for_order_id', null)
            .ilike('name', `${orderNumber}%`)
            .order('updated_at', { ascending: false }).limit(20),
    ]);
    const seen = new Set<string>();
    const out: any[] = [];
    for (const row of [...(marked.data || []), ...(named.data || [])]) {
        const key = String((row as any).id);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
    }
    return out.slice(0, 20);
}

/**
 * Скільки файлів макета має кожна чернетка.
 *
 * Рядок у картці казав лише назву, і з нього не було видно найважливішого: чи
 * цей макет узагалі колись рендерився. Чернетка з нулем файлів — не помилка
 * (її щойно скопіювали або її рендер обірвало), але поставити таку на
 * замовлення означає лишити замовлення без файлів, доки не натиснути
 * «Перегенерувати». Хай це буде видно ДО натискання, а не після.
 *
 * Рахуємо по `project_id`, без прив'язки до замовлення: чернетка на замовленні
 * не стоїть, тож її файли лежать під своїм макетом, а не під цим order_id.
 */
async function exportCounts(
    admin: ReturnType<typeof getAdminClient>,
    projectIds: string[],
): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    if (projectIds.length === 0) return out;
    try {
        const { data } = await admin
            .from('order_files')
            .select('project_id')
            .eq('file_type', 'export')
            .in('project_id', projectIds)
            .limit(1000);
        for (const row of data || []) {
            const pid = String((row as any)?.project_id || '');
            if (pid) out[pid] = (out[pid] || 0) + 1;
        }
    } catch { /* без числа рядок просто не покаже файлів */ }
    return out;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;
    const { id } = await params;

    const admin = getAdminClient();
    const { data: order } = await admin
        .from('orders').select('id, order_number').eq('id', id).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

    const drafts = await candidatesFor(admin, guard.userId, order.id, String(order.order_number || ''));
    const counts = await exportCounts(admin, drafts.map(d => String(d.id)));
    return NextResponse.json({
        drafts: drafts.map(d => ({ ...d, exportFiles: counts[String(d.id)] || 0 })),
    });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;
    const { id } = await params;

    const body = await req.json().catch(() => ({} as any));
    const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    // Згода поставити макет, СТВОРЕНИЙ РАНІШЕ за той, що вже на замовленні.
    // Без неї така заміна не відбувається — див. відмову нижче.
    const confirmOlder = body?.confirmOlder === true;

    const admin = getAdminClient();
    const { data: order } = await admin
        .from('orders').select('id, order_number').eq('id', id).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

    // Ставити можна ЛИШЕ власну чернетку. Без цієї перевірки staff-запитом
    // можна було б причепити до замовлення будь-який чужий макет.
    const { data: draft } = await admin
        .from('projects')
        .select('id, user_id, order_id, product_type, name, cart_payload, created_at')
        .eq('id', projectId)
        .maybeSingle();
    if (!draft) return NextResponse.json({ error: 'Макет не знайдено' }, { status: 404 });
    if (draft.user_id !== guard.userId) {
        return NextResponse.json({ error: 'Це не ваша чернетка' }, { status: 403 });
    }
    if (draft.order_id && draft.order_id !== id) {
        return NextResponse.json({ error: 'Цей макет уже стоїть на іншому замовленні' }, { status: 409 });
    }

    // Поточні макети замовлення. Заміщається той, що стоїть під ТИМ САМИМ
    // рядком кошика; решта (інший виріб у тому ж замовленні) лишається як була.
    // Порівняння за product_type лишилось запасним — див. lib/orders/layout-replacement.
    const { data: current } = await admin
        .from('projects')
        .select('id, product_type, cart_payload, created_at')
        .eq('order_id', id);
    const replaced = layoutsReplacedBy(draft as any, (current || []) as any[]);

    /**
     * СТАРІША ВЕРСІЯ ЗАМІСТЬ НОВІШОЇ.
     *
     * Кандидат і макет на замовленні — це дві версії одного виробу, і
     * дизайнер бачить у списку назву, а не час. На TM-001352 кандидат зроблено
     * об 11:36, а макет на замовленні — о 15:39, тобто натискання відкотило б
     * чотири години роботи, і сказати про це було б нікому.
     *
     * Це НЕ заборона: буває, що пізніший макет саме той, який треба відкотити.
     * Це вимога підтвердити свідомо — маршрут відмовляє один раз і називає
     * обидві дати, а картка перепитує людину і повторює запит із confirmOlder.
     */
    const newer = newerThanDraft(draft as any, replaced as any[]);
    if (newer.length > 0 && !confirmOlder) {
        return NextResponse.json({
            error: 'newer_attached',
            needsConfirm: true,
            draft: { id: draft.id, name: draft.name, createdAt: draft.created_at },
            newer: newer.map(p => ({ id: p.id, createdAt: p.created_at })),
            reason: 'На замовленні стоїть макет, зроблений ПІЗНІШЕ за цей.',
        }, { status: 409 });
    }

    for (const p of replaced) {
        const { error } = await admin.from('projects').update({ order_id: null }).eq('id', p.id);
        if (error) {
            return NextResponse.json({ error: `Не вдалося відчепити поточний макет: ${error.message}` }, { status: 500 });
        }
    }

    const { error: stampErr } = await admin
        .from('projects')
        .update({ order_id: id, updated_at: new Date().toISOString() })
        .eq('id', draft.id);
    if (stampErr) {
        // Повертаємо як було, щоб замовлення не лишилось узагалі без макета.
        for (const p of replaced) await admin.from('projects').update({ order_id: id }).eq('id', p.id);
        return NextResponse.json({ error: stampErr.message }, { status: 500 });
    }

    // Знімаємо з замовлення файли ПОПЕРЕДНЬОГО рендеру.
    //
    // Без цього на замовленні накопичуються повні набори від кожної заміни:
    // на TM-001257 дизайнерка пройшла цикл двічі й виробництво побачило 66
    // рядків — три однакові версії журналу без жодної позначки, яка з них
    // актуальна. Для друкарні це гірше, ніж відсутні файли: надрукувати можуть
    // будь-яку.
    //
    // Саме прибирання застарілого (pruneStaleExports) сюди не дістає свідомо:
    // воно обмежене проєктами, які рендерились у цьому запуску, бо інакше
    // рендер одного виробу зносив макети інших книг замовлення (TM-001234).
    // Відчеплений проєкт у жоден майбутній запуск уже не потрапить, тож його
    // файли не прибере ніхто ніколи — прибираємо тут.
    //
    // Видаляємо ЛИШЕ рядки в order_files, самі обʼєкти у сховищі лишаються.
    // Це навмисно: якщо новий рендер впаде, файли на місці й реєстрацію можна
    // повернути. А показувати старий рендер до приходу нового не можна — він
    // уже не відповідає тому макету, що піде у друк.
    const staleIds: string[] = [];
    if (replaced.length > 0) {
        const { data: exportRows } = await admin
            .from('order_files')
            .select('id, file_path')
            .eq('order_id', id)
            .eq('file_type', 'export');
        for (const row of exportRows || []) {
            const path = String((row as any).file_path || '');
            if (replaced.some(p => path.includes(p.id))) staleIds.push((row as any).id);
        }
        if (staleIds.length > 0) {
            const { error: delErr } = await admin.from('order_files').delete().in('id', staleIds);
            if (delErr) console.error('[replace-layout] stale export cleanup failed', delErr.message);
        }
    }

    // ХТО замінив макет — і слід, який видно в картці.
    //
    // Запис в order_history був, але без імені, а сама картка після заміни не
    // показувала нічого: блок «Ваші виправлені макети» просто зникав, і по
    // замовленню було не сказати, що макет клієнта вже не той, який піде в
    // друк, ким і коли його підмінили. Позначку кладемо в custom_attributes —
    // тим самим механізмом, яким уже живе банер «Клієнт змінив макет після
    // оформлення», тож у картці вона переживає будь-яке редагування нотаток.
    let whoReplaced = '';
    try {
        const { user } = await getSession();
        if (user?.email) {
            const { data: me } = await admin
                .from('staff').select('name').ilike('email', user.email).maybeSingle();
            whoReplaced = String(me?.name || user.email);
        }
    } catch { /* імʼя не критичне, запис усе одно робимо */ }

    try {
        await admin.from('order_history').insert({
            order_id: id,
            action: 'layout_replaced',
            notes: (replaced.length
                ? `Макет замінено виправленим від дизайнера. Було: ${replaced.map(p => p.id).join(', ')}. Стало: ${draft.id}. Знято файлів попереднього рендеру: ${staleIds.length}.`
                : `На замовлення поставлено макет дизайнера: ${draft.id}.`)
                + (whoReplaced ? ` Замінив: ${whoReplaced}.` : ''),
            details: { replacedProjectIds: replaced.map(p => p.id), newProjectId: draft.id, by: whoReplaced || null },
        });
    } catch (e) {
        console.error('[replace-layout] order_history insert failed', e);
    }

    try {
        const { data: cur } = await admin
            .from('orders').select('custom_attributes').eq('id', id).maybeSingle();
        const attrs = (cur?.custom_attributes && typeof cur.custom_attributes === 'object')
            ? cur.custom_attributes as Record<string, any>
            : {};
        await admin.from('orders').update({
            custom_attributes: {
                ...attrs,
                layout_replaced_at: new Date().toISOString(),
                layout_replaced_by: whoReplaced || null,
                layout_replaced_count: Number(attrs.layout_replaced_count || 0) + 1,
                // id оригіналу клієнта — щоб повернутися до нього було до чого,
                // а не тільки в історії текстом.
                layout_replaced_from: replaced.map(p => p.id),
            },
        }).eq('id', id);
    } catch (e) {
        console.error('[replace-layout] custom_attributes stamp failed', e);
    }

    return NextResponse.json({ ok: true, projectId: draft.id, unlinked: replaced.length, staleRemoved: staleIds.length });
}
