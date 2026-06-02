import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { sendCertificateEmail } from '@/lib/certificates/sendCertificateEmail';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { code, amount, recipient_name, recipient_email, sender_name, message, expires_at } = body;

    if (!recipient_email) return NextResponse.json({ error: 'No email' }, { status: 400 });

    const result = await sendCertificateEmail({
        code,
        amount,
        recipient_name,
        recipient_email,
        sender_name,
        message,
        expires_at,
    });

    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}
