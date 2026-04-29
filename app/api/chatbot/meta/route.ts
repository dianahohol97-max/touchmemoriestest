import { NextResponse } from 'next/server';
import { processReceivedMessage } from '@/lib/chatbot/core';
import crypto from 'crypto';
import fetch from 'node-fetch';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_APP_SECRET = process.env.META_APP_SECRET;

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

/**
 * Verify Meta's X-Hub-Signature-256 header. Meta signs every webhook with
 * HMAC-SHA256 of the raw body using your app secret. Without this check
 * anyone could POST a forged payload to this endpoint, triggering DB writes
 * via processReceivedMessage and outbound Meta Graph API calls (spam) on our
 * behalf.
 *
 * We require META_APP_SECRET in production. If it's missing, we refuse to
 * process the webhook rather than failing open.
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!META_APP_SECRET) return false;
    if (!signatureHeader) return false;
    // Header format: "sha256=<hex>"
    const expected = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(rawBody).digest('hex');
    // Constant-time comparison
    try {
        return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
    } catch {
        return false;
    }
}

// Handling Incoming Messages
export async function POST(req: Request) {
    if (!META_ACCESS_TOKEN) {
        console.error('Meta access token not configured');
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    // Read the raw body BEFORE parsing JSON — HMAC must run on bytes Meta
    // signed, not a re-serialised version.
    const rawBody = await req.text();

    if (META_APP_SECRET) {
        const signature = req.headers.get('x-hub-signature-256');
        if (!verifyMetaSignature(rawBody, signature)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
    } else if (process.env.NODE_ENV === 'production') {
        // In production, refuse to accept unverified webhooks. Set
        // META_APP_SECRET in Vercel env vars to enable the chatbot.
        console.error('META_APP_SECRET not configured in production — refusing webhook');
        return NextResponse.json({ error: 'Webhook signing not configured' }, { status: 503 });
    }

    try {
        const body = JSON.parse(rawBody);

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
