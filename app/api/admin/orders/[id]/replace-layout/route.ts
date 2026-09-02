import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

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

/** Чернетки співробітника, названі під це замовлення (див. clone-project-to-me). */
async function candidatesFor(admin: ReturnType<typeof getAdminClient>, staffUserId: string, orderNumber: string) {
    const { data } = await admin
        .from('projects')
        .select('id, name, product_type, format, total_pages, updated_at, order_id')
        .eq('user_id', staffUserId)
        .is('order_id', null)
        .ilike('name', `${orderNumber}%`)
        .order('updated_at', { ascending: false })
        .limit(20);
    return data || [];
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;
    const { id } = await params;

    const admin = getAdminClient();
    const { data: order } = await admin
        .from('orders').select('id, order_number').eq('id', id).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

    return NextResponse.json({ drafts: await candidatesFor(admin, guard.userId, String(order.order_number || '')) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;
    const { id } = await params;

    const body = await req.json().catch(() => ({} as any));
    const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    const admin = getAdminClient();
    const { data: order } = await admin
        .from('orders').select('id, order_number').eq('id', id).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

    // Ставити можна ЛИШЕ власну чернетку. Без цієї перевірки staff-запитом
    // можна було б причепити до замовлення будь-який чужий макет.
    const { data: draft } = await admin
        .from('projects')
        .select('id, user_id, order_id, product_type, name')
        .eq('id', projectId)
        .maybeSingle();
    if (!draft) return NextResponse.json({ error: 'Макет не знайдено' }, { status: 404 });
    if (draft.user_id !== guard.userId) {
        return NextResponse.json({ error: 'Це не ваша чернетка' }, { status: 403 });
    }
    if (draft.order_id && draft.order_id !== id) {
        return NextResponse.json({ error: 'Цей макет уже стоїть на іншому замовленні' }, { status: 409 });
    }

    // Поточні макети замовлення. Того ж типу товару — саме їх і замінюємо;
    // решта (інший виріб у тому ж замовленні) лишається як була.
    const { data: current } = await admin
        .from('projects')
        .select('id, product_type')
        .eq('order_id', id);
    const replaced = (current || []).filter(p => p.product_type === draft.product_type && p.id !== draft.id);

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

    try {
        await admin.from('order_history').insert({
            order_id: id,
            action: 'layout_replaced',
            notes: replaced.length
                ? `Макет замінено виправленим від дизайнера. Було: ${replaced.map(p => p.id).join(', ')}. Стало: ${draft.id}. Знято файлів попереднього рендеру: ${staleIds.length}.`
                : `На замовлення поставлено макет дизайнера: ${draft.id}.`,
        });
    } catch (e) {
        console.error('[replace-layout] order_history insert failed', e);
    }

    return NextResponse.json({ ok: true, projectId: draft.id, unlinked: replaced.length, staleRemoved: staleIds.length });
}
