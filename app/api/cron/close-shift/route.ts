import { NextResponse } from 'next/server';
import { CheckboxService } from '@/lib/checkbox';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Close the Checkbox shift for EVERY active fiscal account (both ФОП).
 * Checkbox requires the shift to be closed daily; with two cash registers we
 * must close each. Falls back to env credentials if the table is empty.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const results: Array<{ account: string; closed: boolean; error?: string }> = [];

    let accounts: Array<{ label?: string; login: string; password?: string; license_key: string }> = [];
    try {
        const { data } = await supabase
            .from('fiscal_accounts')
            .select('label, login, password, license_key')
            .eq('is_active', true);
        accounts = data || [];
    } catch { /* fall through to env */ }

    if (accounts.length === 0 && process.env.CHECKBOX_LOGIN && process.env.CHECKBOX_LICENSE_KEY) {
        accounts = [{
            label: 'env',
            login: process.env.CHECKBOX_LOGIN,
            password: process.env.CHECKBOX_PASSWORD,
            license_key: process.env.CHECKBOX_LICENSE_KEY,
        }];
    }

    for (const acc of accounts) {
        try {
            const checkbox = new CheckboxService({ login: acc.login, password: acc.password, licenseKey: acc.license_key });
            const result = await checkbox.closeShift();
            results.push({ account: acc.label || acc.login, closed: !!result });
        } catch (error: any) {
            console.error('Cron Error (Close Shift):', acc.label || acc.login, error);
            results.push({ account: acc.label || acc.login, closed: false, error: error?.message });
        }
    }

    return NextResponse.json({ status: 'success', count: results.length, results });
}
