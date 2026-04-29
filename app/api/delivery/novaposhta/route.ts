import { NextResponse } from 'next/server';

/**
 * Public-facing helper used by the cart UI to look up Nova Poshta warehouses
 * for a given city. This is a fixed-purpose proxy — unlike `/api/novaposhta`,
 * which (until the 2026-04-29 hardening) was a fully open passthrough — it
 * only ever calls Address.getWarehouses with a sanitised city name.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const cityRaw = body?.city;
        if (typeof cityRaw !== 'string') {
            return NextResponse.json({ success: false, error: 'city required' }, { status: 400 });
        }
        const city = cityRaw.trim();
        if (!city || city.length > 100) {
            return NextResponse.json({ success: false, error: 'invalid city' }, { status: 400 });
        }

        const apiKey = process.env.NOVA_POSHTA_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'service unavailable' }, { status: 503 });
        }

        const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey,
                modelName: 'Address',
                calledMethod: 'getWarehouses',
                methodProperties: { CityName: city },
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err: any) {
        console.error('delivery/novaposhta error', err);
        return NextResponse.json({ error: 'Request failed' }, { status: 500 });
    }
}
