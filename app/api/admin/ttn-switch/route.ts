import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { TTN_DISABLED_MESSAGE, readTtnSwitch } from '@/lib/shipping/ttn-switch';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ttn-switch — чи можна створювати накладні з сайту.
 *
 * Потрібен картці замовлення, щоб не показувати кнопку, яка однаково відмовить.
 * Заборона живе на сервері (обидва маршрути створення), а це лише вітрина.
 */
export async function GET() {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const state = await readTtnSwitch(getAdminClient());
    return NextResponse.json({
        enabled: state.enabled,
        reason: state.reason,
        message: state.enabled ? null : TTN_DISABLED_MESSAGE,
    });
}
