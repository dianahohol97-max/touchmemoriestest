import { NextResponse } from 'next/server';

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const API_KEY = process.env.NOVA_POSHTA_API_KEY;

// Allowlist of (modelName, calledMethod) pairs that the public cart/checkout
// flow legitimately needs. Anything else gets rejected — the proxy used to be
// fully open and would happily forward billable requests with our API key.
const ALLOWED_CALLS = new Set<string>([
    'Address|getCities',
    'Address|getWarehouses',
    'Address|getSettlements',
    'Address|searchSettlements',
    'Address|searchSettlementStreets',
    'AddressGeneral|getAreas',
]);

function safeString(v: unknown, max = 200): string | undefined {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    if (!trimmed || trimmed.length > max) return undefined;
    return trimmed;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const modelName = safeString(body.modelName, 50);
        const calledMethod = safeString(body.calledMethod, 50);

        if (!modelName || !calledMethod) {
            return NextResponse.json(
                { success: false, error: 'modelName and calledMethod required' },
                { status: 400 }
            );
        }

        if (!ALLOWED_CALLS.has(`${modelName}|${calledMethod}`)) {
            return NextResponse.json(
                { success: false, error: 'Method not allowed' },
                { status: 403 }
            );
        }

        // methodProperties — accept only a small set of known fields.
        // Reject anything else to keep the surface tight (no `Limit: 1000000`,
        // no payment-account fields, etc).
        const props = body.methodProperties || {};
        const ALLOWED_PROPS = ['FindByString', 'CityName', 'CityRef', 'Limit', 'Page', 'Ref', 'AreaRef', 'SettlementRef', 'StreetName'];
        const safeProps: Record<string, string> = {};
        for (const k of ALLOWED_PROPS) {
            const v = safeString(props[k], 200);
            if (v !== undefined) safeProps[k] = v;
        }

        const response = await fetch(NP_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: API_KEY,
                modelName,
                calledMethod,
                methodProperties: safeProps,
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Request failed' }, { status: 500 });
    }
}
