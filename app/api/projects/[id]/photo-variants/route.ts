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
 * Записує він їх ЗЛИТТЯМ у поточну версію рядка, а не перезаписом того масиву,
 * який прочитав на початку — див. `storeVariantPaths`. Нарізка триває до
 * чотирьох хвилин, і все, що людина збереже за цей час, мусить вціліти.
 *
 * Доступ має власник макета, і окремо адміністратор: Діані буває треба
 * підготувати макет наперед, щоб не просити клієнта чекати вдруге. Чужий
 * `uploaded_photos` стороння людина тут не зачепить — інакше будь-хто з
 * посиланням змушував би нас різати чужі фото.
 */
/** Скільки разів перечитати рядок, якщо хтось устиг зберегтися між читанням і записом. */
const MERGE_ATTEMPTS = 4;

/**
 * Записати шляхи копій, НЕ затираючи те, що людина зберегла тим часом.
 *
 * ЧОМУ НЕ МОЖНА ПРОСТО ЗАПИСАТИ МАСИВ. Раніше маршрут читав `uploaded_photos`
 * на початку, різав копії до чотирьох хвилин (`deadline` 240 с) і записував
 * назад ТУ САМУ версію, яку прочитав. Усе, що людина встигала зберегти за ці
 * чотири хвилини, зникало: додала десять фото в конструкторі — і вони щезли,
 * бо маршрут поклав поверх свій застарілий знімок. Вікно тут не секунди, а
 * хвилини, і виглядало б це як «фото пропали самі собою».
 *
 * Лікування: після нарізки перечитуємо рядок і зливаємо результат ЗА `id`
 * фото — дописуємо `previewPath` і `thumbPath` лише тим елементам, які є в
 * ПОТОЧНІЙ версії. Фото, додані за час нарізки, лишаються; фото, видалені за
 * цей час, не воскресають; поле `path` не чіпається взагалі, бо з нього
 * Railway збирає макет для друку.
 *
 * Запис іде під перевіркою `updated_at`: якщо між нашим читанням і записом
 * хтось зберігся, оновиться нуль рядків, і ми перечитуємо ще раз. Перевірка
 * саме на `updated_at` коректна, бо тригерів на `projects` немає, а обидва
 * писачі `uploaded_photos` — `persistDraft` у конструкторі і `save-design` —
 * виставляють його явно. Власний запис маршруту `updated_at` НЕ чіпає: копія
 * це не редагування макета, і підсовувати його в стрічку «востаннє змінено»
 * означало б брехати людині про її ж роботу.
 */
async function storeVariantPaths(
    admin: any,
    id: string,
    made: Array<{ id?: string; path?: string; previewPath?: string; thumbPath?: string }>,
): Promise<{ ok: true; photos: any[] } | { ok: false; error: string }> {
    const byId = new Map<string, { path?: string; previewPath?: string; thumbPath?: string }>();
    for (const p of made) {
        if (!p?.id || (!p.previewPath && !p.thumbPath)) continue;
        byId.set(String(p.id), { path: p.path, previewPath: p.previewPath, thumbPath: p.thumbPath });
    }
    if (byId.size === 0) return { ok: true, photos: [] };

    let lastError = 'merge failed';
    for (let attempt = 0; attempt < MERGE_ATTEMPTS; attempt++) {
        const { data: fresh, error: readErr } = await admin
            .from('projects')
            .select('uploaded_photos, updated_at')
            .eq('id', id)
            .maybeSingle();
        if (readErr) return { ok: false, error: readErr.message };
        if (!fresh) return { ok: false, error: 'project disappeared' };

        const current: any[] = Array.isArray(fresh.uploaded_photos) ? fresh.uploaded_photos : [];
        let changed = 0;
        const merged = current.map((p: any) => {
            const add = p && p.id ? byId.get(String(p.id)) : undefined;
            if (!add) return p;
            // Шлях оригіналу мусить бути тим самим, із якого ми різали. Якщо
            // фото за цей час перезавантажили, воно лежить уже за іншим шляхом,
            // і наші копії стосуються старого файлу — підставити їх означало б
            // показувати на полотні не той знімок.
            if (add.path && p.path && String(p.path) !== String(add.path)) return p;
            // Тільки те, чого в поточній версії ще немає: якщо людина тим часом
            // зберегла власну копію, її шлях головніший за наш.
            const patch: Record<string, string> = {};
            if (add.previewPath && !p.previewPath) patch.previewPath = add.previewPath;
            if (add.thumbPath && !p.thumbPath) patch.thumbPath = add.thumbPath;
            if (Object.keys(patch).length === 0) return p;
            changed++;
            return { ...p, ...patch };
        });
        if (changed === 0) return { ok: true, photos: current };

        const { data: saved, error: upErr } = await admin
            .from('projects')
            .update({ uploaded_photos: merged })
            .eq('id', id)
            .eq('updated_at', fresh.updated_at)
            .select('uploaded_photos');
        if (upErr) return { ok: false, error: upErr.message };
        if (saved && saved.length > 0) return { ok: true, photos: merged };
        // Нуль рядків означає, що `updated_at` зсунувся — хтось зберігся просто
        // зараз. Читаємо його версію і зливаємо в неї.
        lastError = 'project changed while variants were being built';
    }
    return { ok: false, error: lastError };
}

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
        const stored = await storeVariantPaths(admin, id, result.photos);
        if (!stored.ok) {
            console.error('[photo-variants] failed to store paths', { id, error: stored.error });
            return NextResponse.json({ error: stored.error }, { status: 500 });
        }
        // Віддаємо те, що СПРАВДІ лежить у рядку після злиття, а не наш
        // знімок: кабінет підписує посилання саме з цієї відповіді, і різниця
        // між нею і базою означала б посилання на фото, якого там уже немає.
        result.photos = stored.photos;
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
