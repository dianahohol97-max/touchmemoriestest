import { NextResponse } from 'next/server';
import { processReceivedMessage } from '@/lib/chatbot/core';
import fetch from 'node-fetch';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

// Verification for Webhook (Meta Requirement)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// Handling Incoming Messages
export async function POST(req: Request) {
    if (!META_ACCESS_TOKEN) {
        console.error('Meta access token not configured');
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    try {
        const body = await req.json();

        // Ensure this is a page or instagram webhook
        if (body.object === 'page' || body.object === 'instagram') {
            for (const entry of body.entry) {
                for (const event of entry.messaging) {
                    // Ignore delivery or read receipts
                    if (event.delivery || event.read) continue;

                    if (event.message && event.message.text) {
                        const senderId = event.sender.id;
                        const text = event.message.text;
                        const messageId = event.message.mid;
                        const platform = body.object === 'instagram' ? 'instagram' : 'facebook';

                        // Route to core logic
                        const result = await processReceivedMessage(platform, senderId, `MetaUser_${senderId}`, text, messageId);

                        if (result.action === 'reply' && result.text) {
                            // Send reply via Graph API
                            await sendMetaMessage(senderId, result.text);
                        }
                    }
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('Meta Webhook Error:', e);
        return NextResponse.json({ ok: true }); // Acknowledge to stop retries
    }
}

// Helper to send message back via Meta Graph API v18.0
async function sendMetaMessage(recipientId: string, text: string) {
    const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${META_ACCESS_TOKEN}`;

    // Split long messages if necessary, Meta has 2000 char limits but we keep messages short.
    const payload = {
        recipient: { id: recipientId },
        message: { text }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const data = await res.json();
        console.error('Failed to send Meta message:', data);
    }
}
