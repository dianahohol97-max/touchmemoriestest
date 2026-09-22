import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Стан автопублікації для шапки списку статей.
 *
 * ЧОМУ ОКРЕМИЙ РОУТ, А НЕ ЧИТАННЯ З БРАУЗЕРА. Рядок `blog_queue_watch` лежить
 * у `settings`, де політика читання відкриває лише чотири технічні ключі, а
 * решту — тільки тим, хто є в `admin_users`. Для решти співробітників запит із
 * браузера повернув би не помилку, а порожньо. Тобто «крон не запускався» і
 * «у вас немає прав це бачити» виглядали б однаково — саме та підміна, через
 * яку сторожа й заводять (гоча 15 у CLAUDE.md).
 *
 * Тому стан читає сервер сервісним ключем, а право дивитися перевіряє розділ
 * контенту — той самий, яким відкривається сам список статей.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    const guard = await requireSection('content', 'view');
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const { data } = await admin
        .from('settings').select('value').eq('key', 'blog_queue_watch').maybeSingle();

    return NextResponse.json({ watch: data?.value ?? null });
}
