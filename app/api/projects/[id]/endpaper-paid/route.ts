import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/guards';
import { paidForzatSides } from '@/lib/print/forzat-expectation';

export const runtime = 'nodejs';

/**
 * GET /api/projects/[id]/endpaper-paid — за які форзаци заплачено цим макетом.
 *
 * ЧОМУ ЦЕ ОКРЕМИЙ МАРШРУТ, А НЕ ЩЕ ОДНЕ ПОЛЕ В КОНФІГУ. Оплата форзаца живе в
 * трьох місцях, і вони не рівні. Найсильніше — `config.endpaperPaid`, яке
 * конструктор пише разом із макетом. Далі йде `cart_payload.options`, знімок
 * рядка кошика, який оформлення кладе поруч із макетом. Обидва читає
 * `resolveEndpaperPaid`, і обом достатньо самого рядка `projects`.
 *
 * Але є макети, у яких `cart_payload` — це сама лише позначка `{ id }` без
 * опцій. Прохід по живій базі 23.09.2026 дав шість таких серед двадцяти
 * макетів на замовленнях з оплаченим форзацом. Для них у браузері джерел не
 * лишається зовсім: справжня відповідь лежить у `orders.items`, а `orders`
 * клієнтові не дає RLS — і саме тому `openDesignInConstructor` донині
 * відкочувався на `config.enableEndpaper`. Для журналу з мʼякою обкладинкою
 * той прапорець не може бути нічим, окрім false, тож людина, яка заплатила за
 * друк на форзаці, отримувала форзац замкненим, а `clearShifted()` при
 * видаленні розвороту стирав із нього фото як із неоплаченого.
 *
 * Сервер `orders` читає, тож відповідь тут є завжди, коли вона взагалі існує.
 * Двом замовленням — TM-001309 і TM-001091 — форзац довелося розблоковувати
 * руками, дописуючи `endpaperPaid` прямо в конфіг; цей маршрут існує, щоб
 * третього разу не було.
 *
 * ЦЕ ЧИТАННЯ. У базу тут не пишеться нічого: нове поле зʼявиться в макеті
 * тільки тоді, коли людина сама його збереже, і то вже з конструктора.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'project id required' }, { status: 400 });

    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: 'no admin client' }, { status: 500 });

    const { data: project, error } = await admin
        .from('projects')
        .select('id, user_id, order_id, cart_payload')
        .eq('id', id)
        .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
    // Той самий доступ, що й у photo-variants: власник макета, і окремо
    // адміністратор, якому буває треба відкрити чужий макет для виправлення.
    if (project.user_id !== user.id) {
        const guard = await requireAdmin();
        if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    // Чернетка без замовлення — питати нема про що, і це не помилка.
    if (!project.order_id) return NextResponse.json({ ok: true, paid: null });

    const { data: order } = await admin
        .from('orders')
        .select('items')
        .eq('id', project.order_id)
        .maybeSingle();
    const items: any[] = Array.isArray((order as any)?.items) ? (order as any).items : [];
    if (items.length === 0) return NextResponse.json({ ok: true, paid: null });

    /**
     * ЯКИЙ САМЕ РЯДОК КОШИКА НАЛЕЖИТЬ ЦЬОМУ МАКЕТУ.
     *
     * По ключу, а не по порядку — гоча 18. На замовленні з кількома книгами
     * порядок макетів і порядок позицій збігаються не завжди, а записати
     * макетові чужу позицію гірше, ніж не записати нічого: замкнений форзац
     * видно сторожу і перевірці файлів, а розблокований чужою оплатою виглядає
     * справним рівно до рахунку.
     *
     * Виняток рівно один і він не здогадка. `cart_item_id` зʼявився в позиціях
     * недавно, і старі замовлення його не несуть узагалі — саме такі й стоять
     * у списку сліпих. Коли на замовленні одна позиція і один макет, пара
     * однозначна без жодного ключа. Усе інше лишається без відповіді.
     */
    const cartId = String((project as any)?.cart_payload?.id || '').trim();
    let line = cartId
        ? items.find(it => String(it?.cart_item_id || '').trim() === cartId)
        : undefined;
    if (!line && items.length === 1) {
        const { count } = await admin
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('order_id', project.order_id);
        if ((count ?? 0) === 1) line = items[0];
    }
    if (!line) return NextResponse.json({ ok: true, paid: null });

    const sides = paidForzatSides(line?.options);
    return NextResponse.json({
        ok: true,
        paid: (sides.first || sides.last) ? sides : null,
    });
}
