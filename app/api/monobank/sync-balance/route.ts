import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { accountId, apiKey } = await req.json();
        if (!accountId || !apiKey) {
            return NextResponse.json({ error: 'accountId та apiKey обов\'язкові' }, { status: 400 });
        }

        // Call Monobank client-info API to get balance
        const monoRes = await fetch('https://api.monobank.ua/personal/client-info', {
            headers: { 'X-Token': apiKey }
        });

        if (!monoRes.ok) {
            const err = await monoRes.json().catch(() => ({}));
            return NextResponse.json({
                error: err.errorDescription || `Monobank API помилка ${monoRes.status}. Перевір API ключ.`
            }, { status: 400 });
        }

        const clientInfo = await monoRes.json();
        // Sum balance across all UAH accounts
        const uahAccounts = (clientInfo.accounts || []).filter((a: any) => a.currencyCode === 980);
        const totalBalance = uahAccounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0);
        const balanceUah = totalBalance / 100; // Convert kopecks to UAH

        // Update balance in DB
        const supabase = getAdminClient();
        await supabase.from('bank_accounts')
            .update({ balance: balanceUah, updated_at: new Date().toISOString() })
            .eq('id', accountId);

        return NextResponse.json({
            success: true,
            balance: balanceUah,
            accounts: uahAccounts.length,
            name: clientInfo.name
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
