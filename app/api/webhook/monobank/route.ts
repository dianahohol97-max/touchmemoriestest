// Redirect legacy endpoint → /api/monobank/webhook
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());
    
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app'}/api/monobank/webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-sign': headers['x-sign'] || ''
        },
        body
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}
