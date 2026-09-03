import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/subscribers — база підписників розсилки.
 *
 * Читалась прямо з браузера, а таблиця закрита політикою is_admin_user().
 * Маркетолог і менеджер, яким роль дає marketing, бачили порожній список і
 * нуль підписників — при тому, що кампанії поруч вантажаться через власний
 * роут і працюють у всіх.
 */
export async function GET() {
    const guard = await requireSection('marketing', 'view');
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const { data, error } = await admin
        .from('subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false });

    if (error) {
        console.error('[admin/subscribers] read failed', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ subscribers: data || [] });
}
