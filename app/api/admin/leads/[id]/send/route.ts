import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { buildOfferEmail, type LeadBusinessType } from '@/lib/leads/offers';

export const dynamic = 'force-dynamic';

const FROM_EMAIL = 'hello@touchmemories.com.ua';
const FROM_NAME = 'Touch.Memories';

/**
 * POST /api/admin/leads/[id]/send
 *
 * Body:
 *   { mode: 'offer' }                          → send the personalized offer
 *   { mode: 'custom', subject, body }          → send a custom message
 *
 * In both cases the message is logged to lead_messages (direction 'out') so the
 * manager sees the full thread, and the lead is marked 'contacted'.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;
    const { id } = await params;

    const admin = getAdminClient();
    const { data: lead } = await admin.from('leads').select('*').eq('id', id).maybeSingle();
    if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (!lead.email) return NextResponse.json({ error: 'no_email', message: 'У ліда немає email' }, { status: 400 });

    const body = await request.json();
    const mode = body?.mode === 'custom' ? 'custom' : 'offer';

    let subject: string;
    let html: string;
    let textBody: string;

    if (mode === 'offer') {
        const offer = buildOfferEmail((lead.business_type as LeadBusinessType) || 'other', lead.contact_name || '');
        subject = offer.subject;
        html = offer.html;
        textBody = offer.text;
    } else {
        subject = String(body?.subject || '').trim().slice(0, 200);
        const raw = String(body?.body || '').trim();
        if (!subject || !raw) return NextResponse.json({ error: 'subject and body required' }, { status: 400 });
        textBody = raw.slice(0, 10000);
        // Wrap custom text in the branded shell
        const paragraphs = textBody.split('\n\n').map(p => p.replace(/\n/g, '<br>')).join('</p><p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#374151">');
        html = `
            <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto">
              <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
              <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#374151">${paragraphs}</p>
                <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Touch.Memories · touchmemories.com.ua</p>
              </div>
            </div>`;
    }

    // Send via Brevo
    let messageId: string | null = null;
    try {
        const result = await sendBrevoEmail({
            to: lead.email,
            toName: lead.contact_name || lead.business_name,
            subject,
            html,
            fromName: FROM_NAME,
            fromEmail: FROM_EMAIL,
        });
        messageId = result?.messageId || null;
    } catch (e: any) {
        return NextResponse.json({ error: 'send_failed', message: e?.message || 'Не вдалося надіслати' }, { status: 502 });
    }

    // Log to thread
    await admin.from('lead_messages').insert({
        lead_id: id,
        direction: 'out',
        channel: 'email',
        subject,
        body: textBody,
        from_email: FROM_EMAIL,
        to_email: lead.email,
        message_id: messageId,
    });

    // Update lead state
    await admin.from('leads').update({
        status: lead.status === 'new' ? 'contacted' : lead.status,
        offer_sent_at: lead.offer_sent_at || (mode === 'offer' ? new Date().toISOString() : lead.offer_sent_at),
        updated_at: new Date().toISOString(),
    }).eq('id', id);

    return NextResponse.json({ ok: true, messageId });
}
