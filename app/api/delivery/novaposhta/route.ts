import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { city } = await req.json();

        const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            body: JSON.stringify({
                apiKey: process.env.NOVA_POSHTA_API_KEY,
                modelName: 'Address',
                calledMethod: 'getWarehouses',
                methodProperties: { CityName: city }
            })
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
