import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/inbound
 *
 * Inbound-email webhook (Brevo Inbound parsing, or any forwarder that posts
 * JSON). When a lead replies to an offer, this matches the reply back to the
 * lead by the sender's email and appends it to the conversation thread, so the
 * manager sees the reply in the admin inbox and the lead flips to 'replied'.
 *
 * Protected by a shared secret (LEADS_INBOUND_KEY) via header or ?key=.
 *
 * Brevo inbound posts an array of items; we also accept a single normalized
 * object. We read sender, subject and text/plain body defensively because
 * different providers shape the payload differently.
 */
export async function POST(request: Request) {
    const url = new URL(request.url);
    const key = request.headers.get('x-inbound-key') || url.searchParams.get('key');
    const expected = process.env.LEADS_INBOUND_KEY;
    if (!expected || key !== expected) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let payload: any;
    try { payload = await request.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const items: any[] = Array.isArray(payload?.items) ? payload.items
        : Array.isArray(payload) ? payload : [payload];

    const admin = getAdminClient();
    let matched = 0, unmatched = 0;

    for (const item of items) {
        // Defensive extraction across provider shapes.
        const fromEmail = (
            item?.from?.[0]?.address || item?.From || item?.sender?.email ||
            item?.from || item?.email || ''
        ).toString().trim().toLowerCase();
        const subject = (item?.subject || item?.Subject || '').toString().slice(0, 300);
        const text = (
            item?.text || item?.RawTextBody || item?.['text/plain'] ||
            item?.body || item?.html || ''
        ).toString().slice(0, 20000);
        const messageId = (item?.messageId || item?.['message-id'] || item?.MessageID || '').toString() || null;

        if (!fromEmail) { unmatched++; continue; }

        // Find the lead by sender email.
        const { data: lead } = await admin
            .from('leads')
            .select('id, status')
            .ilike('email', fromEmail)
            .maybeSingle();
        if (!lead) { unmatched++; continue; }

        // Append the inbound message.
        await admin.from('lead_messages').insert({
            lead_id: lead.id,
            direction: 'in',
            channel: 'email',
            subject,
            body: text,
            from_email: fromEmail,
            to_email: 'hello@touchmemories.com.ua',
            message_id: messageId,
            meta: { provider_raw: true },
        });

        // Bump status to 'replied' (unless already further along).
        if (['new', 'contacted'].includes(lead.status)) {
            await admin.from('leads').update({ status: 'replied', updated_at: new Date().toISOString() }).eq('id', lead.id);
        }
        matched++;
    }

    return NextResponse.json({ ok: true, matched, unmatched });
}
