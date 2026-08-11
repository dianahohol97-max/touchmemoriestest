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

    // Round two: who actually publishes TOMORROW. The two known sources do
    // not — one ignores the day parameter, the other has today only — and the
    // evening post is supposed to be about the next day.
    const urls = [
        'https://www.horoscope.com/us/horoscopes/general/horoscope-general-daily-tomorrow.aspx?sign=3',
        'https://ohmanda.com/api/horoscope/gemini/',
    ];

    const out: Record<string, any> = {};
    for (const url of urls) {
        try {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(8000),
                headers: {
                    accept: 'application/json, text/html;q=0.9',
                    'user-agent': 'Mozilla/5.0 (compatible; touchmemories-bot/1.0)',
                },
            });
            const body = await res.text();
            // HTML pages carry the forecast far below the head, so scraped
            // sources are reported as the text around the marker instead of
            // the first bytes of markup.
            if (url.includes('horoscope.com')) {
                // Where the forecast actually sits: report the markers present
                // and the markup around the first date-stamped paragraph, which
                // is the shape the parser has to match.
                const stamp = body.search(/<p>\s*<strong>/i);
                out[url] = {
                    status: res.status,
                    markers: ['main-horoscope', 'module-skin', 'horoscope-content', 'switch-horoscope']
                        .map(m => `${m}:${body.indexOf(m)}`),
                    around_paragraph: stamp > 0 ? body.slice(stamp - 200, stamp + 700) : null,
                    head: body.slice(0, 200),
                };
            } else {
                out[url] = { status: res.status, body: body.slice(0, 400) };
            }
        } catch (e: any) {
            out[url] = { error: `${e?.name || 'error'}: ${String(e?.message || e).slice(0, 160)}` };
        }
    }

    return NextResponse.json(out);
}
