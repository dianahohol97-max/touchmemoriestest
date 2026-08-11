import { NextResponse } from 'next/server';
import { consumeRunToken } from '@/lib/automation/run-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Why the primary horoscope source returns nothing.
 *
 * It answers 200 for every sign but with an empty body, which usually means
 * the parameters are spelled in a way it does not recognise rather than that
 * it is down. Diana needs TOMORROW's forecast in the evening post, and
 * tomorrow is exactly what the fallback (ohmanda) cannot give — so it is worth
 * one probe of the spellings instead of guessing.
 *
 * Returns the first 400 characters of each raw response. One-time token.
 */
export async function GET(req: Request) {
    if (!(await consumeRunToken(req, 'horoscope_debug_run_token'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const urls = [
        'https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=gemini&day=TOMORROW',
        'https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=Gemini&day=TOMORROW',
        'https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=Gemini&day=tomorrow',
        'https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=Gemini&day=TODAY',
        'https://horoscope-app-api.vercel.app/api/v1/get-horoscope/weekly?sign=Gemini',
        'https://ohmanda.com/api/horoscope/gemini/',
        'https://aztro.sameerkumar.website/?sign=gemini&day=tomorrow',
        'https://horoscope-api.vercel.app/today/gemini',
    ];

    const out: Record<string, any> = {};
    for (const url of urls) {
        try {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(8000),
                headers: { accept: 'application/json' },
                method: url.includes('aztro') ? 'POST' : 'GET',
            });
            const body = await res.text();
            out[url] = { status: res.status, body: body.slice(0, 400) };
        } catch (e: any) {
            out[url] = { error: `${e?.name || 'error'}: ${String(e?.message || e).slice(0, 160)}` };
        }
    }

    return NextResponse.json(out);
}
