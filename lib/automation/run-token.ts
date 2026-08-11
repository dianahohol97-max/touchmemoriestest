import { getAdminClient } from '@/lib/supabase/admin';

/**
 * One-time tokens for running a protected route by hand.
 *
 * Cron routes authenticate with CRON_SECRET, which nobody types into a browser
 * bar. When a route has to be run out of schedule — «запости таки сьогодні» —
 * or a diagnostic has to be read once from production, a token row is placed in
 * settings and consumed on the first attempt:
 *
 *   settings[<key>] = { token: '…', expires_at: '2026-08-11T19:30:00Z' }
 *
 * Issuing one already requires admin access to the database, the row is deleted
 * whether or not the token turned out to be valid, and it expires on its own.
 * So a leaked URL is worth nothing after the run it was made for.
 */
export async function consumeRunToken(req: Request, key: string): Promise<boolean> {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return false;

    try {
        const supabase = getAdminClient();
        const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
        const stored = data?.value as any;
        if (!stored?.token) return false;
        await supabase.from('settings').delete().eq('key', key);
        if (stored.token !== token) return false;
        return !!stored.expires_at && new Date(stored.expires_at).getTime() > Date.now();
    } catch (e) {
        console.error(`[run-token] check failed for ${key}:`, e);
        return false;
    }
}

/** True for the Vercel Cron bearer. */
export function isCronRequest(req: Request): boolean {
    const auth = req.headers.get('authorization');
    return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}
