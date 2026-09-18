import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { RENDER_BUILD_KEY, describeRenderBuild, type RenderBuild } from '@/lib/print/render-build';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/render-build — що саме крутить Railway і коли воно востаннє
 * щось відрендерило.
 *
 * Потрібне рівно для одного питання, на яке досі не було відповіді: чи доїхало
 * виправлення в сервісі рендеру до продакшну. Пуш у main розкочує Vercel, а
 * Railway треба розкочувати окремо, і сервіс зі старим кодом нічим себе не
 * виявляє — він відповідає і рендерить, просто по-старому.
 */
export async function GET() {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const { data } = await getAdminClient()
        .from('settings').select('value').eq('key', RENDER_BUILD_KEY).maybeSingle();

    const build = (data?.value as RenderBuild) || null;
    return NextResponse.json({ build, summary: describeRenderBuild(build) });
}
