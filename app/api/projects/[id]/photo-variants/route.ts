import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/guards';
import { buildMissingVariants, VARIANTS_BATCH } from '@/lib/editor/photo-variants-server';
import { countPhotosNeedingVariants } from '@/lib/editor/photo-variant-paths';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/projects/[id]/photo-variants — догнати зменшені копії макета.
 *
 * Конструктор робить копії під час збереження, тож усе, збережене після цієї
 * зміни, приходить із ними. Старі макети копій не мають, і зробити їх у
 * браузері можна тільки завантаживши оригінали — тобто рівно ту роботу, через
 * яку TM-001342 відкривалося тринадцять хвилин. Тому їх ріже сервер, який бере
 * ті самі файли по внутрішньому каналу, а кабінет чекає секунд тридцять із
 * чесним написом замість мовчазного очікування.
 *
 * Маршрут ТІЛЬКИ ДОДАЄ поля `previewPath` і `thumbPath`. Оригінал у `path` не
 * переписується ніде: макет для друку збирає Railway саме з нього, і копія не
 * має права опинитися на його місці.
 *
 * Доступ має власник макета, і окремо адміністратор: Діані буває треба
 * підготувати макет наперед, щоб не просити клієнта чекати вдруге. Чужий
 * `uploaded_photos` стороння людина тут не зачепить — інакше будь-хто з
 * посиланням змушував би нас різати чужі фото.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'project id required' }, { status: 400 });

    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: 'no admin client' }, { status: 500 });

    const { data: project, error } = await admin
        .from('projects')
        .select('id, user_id, uploaded_photos')
        .eq('id', id)
        .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
    if (project.user_id !== user.id) {
        const guard = await requireAdmin();
        if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const pending = countPhotosNeedingVariants(project.uploaded_photos);
    if (pending === 0) {
        return NextResponse.json({ ok: true, made: 0, remaining: 0, photos: project.uploaded_photos || [] });
    }

    // Зупиняємося раніше за межу функції, щоб зроблене встигло записатися.
    // Обрив на середині коштував би нам усієї нарізаної роботи: файли лягли б у
    // сховище, а макет про них не дізнався б і різав би їх наступного разу знову.
    const deadline = Date.now() + 240_000;
    const result = await buildMissingVariants(admin, project.uploaded_photos, {
        limit: VARIANTS_BATCH,
        deadline,
    });

    if (result.made > 0) {
        const { error: upErr } = await admin
            .from('projects')
            .update({ uploaded_photos: result.photos })
            .eq('id', id);
        if (upErr) {
            console.error('[photo-variants] failed to store paths', { id, error: upErr.message });
            return NextResponse.json({ error: upErr.message }, { status: 500 });
        }
    }

    console.log('[photo-variants] done', {
        projectId: id,
        made: result.made,
        failed: result.failed,
        remaining: result.remaining,
    });
    return NextResponse.json({
        ok: true,
        made: result.made,
        failed: result.failed,
        remaining: result.remaining,
        photos: result.photos,
    });
}
