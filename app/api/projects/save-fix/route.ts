import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, getSession } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveMissingPhotoPaths } from '@/lib/print/resolve-photo-paths';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/save-fix — зберегти виправлення макета, яке дизайнер
 * робить для чужого замовлення.
 *
 * НАВІЩО ОКРЕМИЙ РОУТ. Кнопка «Макет → мої чернетки» дає дизайнеру копію
 * макета клієнта у власних чернетках. Копія — звичайний проєкт, тож у
 * конструкторі вона нічим не відрізнялася від власного дизайну, і «Зберегти
 * та замовити» робило рівно те, що завжди: додавало глянцевий журнал у кошик
 * дизайнера. У кошику oksanamatsopa зібралося три позиції на 3010 ₴, з них
 * дві однакові. Тобто виправлення чужого макета матеріалізувалося як нова
 * покупка — зайве замовлення, подвійний облік і зіпсована аналітика виручки.
 *
 * Тут збереження йде в ТОЙ САМИЙ рядок чернетки, без кошика й без нового
 * замовлення. Далі дизайнер повертається в картку замовлення й тисне
 * «Поставити на замовлення» — цикл замикається там, де й був задуманий.
 *
 * Доступ. requireStaff, і додатково рядок має належати саме тому, хто зберігає,
 * і бути позначеним як виправлення (fix_for_order_id). Тобто цим роутом не
 * можна переписати ні чужу чернетку, ні власний звичайний дизайн.
 */
export async function POST(req: NextRequest) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
    const design = body?.design;
    if (!projectId || !design) {
        return NextResponse.json({ error: 'projectId і design обовʼязкові' }, { status: 400 });
    }

    const { user } = await getSession();
    const userId = user?.id;
    if (!userId) return NextResponse.json({ error: 'Немає сесії' }, { status: 401 });

    const admin = getAdminClient();
    const { data: project } = await admin
        .from('projects')
        .select('id, user_id, fix_for_order_id, cart_payload, name')
        .eq('id', projectId)
        .maybeSingle();

    if (!project) return NextResponse.json({ error: 'Чернетку не знайдено' }, { status: 404 });
    if (String(project.user_id) !== String(userId)) {
        return NextResponse.json({ error: 'Це чужа чернетка' }, { status: 403 });
    }
    if (!project.fix_for_order_id) {
        return NextResponse.json(
            { error: 'Ця чернетка не є виправленням замовлення' },
            { status: 400 },
        );
    }

    const { pages, coverState, pageStickers, pageShapes, pageBgs, freeSlots,
            qrOverlays, generatedQRCount, config, uploadedPhotos } = design;

    const patch: Record<string, any> = {
        pages_data: pages || [],
        cover_data: coverState || null,
        overlays_data: { pageStickers, pageShapes, pageBgs, freeSlots, qrOverlays, generatedQRCount, config },
        uploaded_photos: uploadedPhotos || [],
        updated_at: new Date().toISOString(),
    };
    if (typeof body?.totalPages === 'number' && body.totalPages > 0) patch.total_pages = body.totalPages;

    // Та сама страховка, що й у save-design: браузер не є надійним сховищем
    // шляхів до фото, і чернетка, відкрита повторно, легко втрачає path. Без
    // цього рендер зібрав би порожні сторінки з цілими файлами у сховищі.
    try {
        const resolved = await resolveMissingPhotoPaths(admin, {
            user_id: project.user_id,
            cart_payload: project.cart_payload,
            uploaded_photos: patch.uploaded_photos,
        });
        if (resolved.changed) {
            patch.uploaded_photos = resolved.photos as any;
            console.warn('[save-fix] recovered photo paths from storage', {
                projectId, recovered: resolved.recovered, unresolved: resolved.unresolved,
            });
        }
    } catch (e: any) {
        console.error('[save-fix] photo path recovery failed', { projectId, error: e?.message });
    }

    const { error } = await admin.from('projects').update(patch).eq('id', projectId);
    if (error) {
        console.error('[save-fix] update failed', { projectId, error: error.message });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: order } = await admin
        .from('orders')
        .select('order_number')
        .eq('id', project.fix_for_order_id)
        .maybeSingle();

    return NextResponse.json({
        ok: true,
        projectId,
        orderId: project.fix_for_order_id,
        orderNumber: order?.order_number || null,
    });
}
