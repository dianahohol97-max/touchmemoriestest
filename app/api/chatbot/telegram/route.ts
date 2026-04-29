import { NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { processReceivedMessage } from '@/lib/chatbot/core';

// Note: In production we use webhooks, not polling. 
// We initialize the bot just to send messages.
const token = process.env.TELEGRAM_PUBLIC_BOT_TOKEN;
const bot = token ? new TelegramBot(token, { polling: false }) : null;

// Telegram sends an X-Telegram-Bot-Api-Secret-Token header on every webhook
// when you set a secret_token in setWebhook. Without verifying it, anyone can
// POST forged update payloads and spam customers via the bot.
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(req: Request) {
    if (!bot) {
        console.error('Telegram bot token not configured');
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    if (TELEGRAM_WEBHOOK_SECRET) {
        const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
        if (headerSecret !== TELEGRAM_WEBHOOK_SECRET) {
            return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
        }
    } else if (process.env.NODE_ENV === 'production') {
        // In production, refuse to accept unverified webhooks. Set
        // TELEGRAM_WEBHOOK_SECRET in env vars and pass it as the secret_token
        // when calling setWebhook on the bot.
        console.error('TELEGRAM_WEBHOOK_SECRET not configured in production — refusing webhook');
        return NextResponse.json({ error: 'Webhook signing not configured' }, { status: 503 });
    }

    try {
        const body = await req.json();

        // Telegram sends updates. We only care about messages.
        if (body.message) {
            const chatId = body.message.chat.id.toString();
            const username = body.message.from?.username || body.message.from?.first_name || 'Unknown User';
            const text = body.message.text || '';
            const messageId = body.message.message_id.toString();

            if (text === '/start') {
                const welcomeMsg = "Привіт! Я Софія з TouchMemories \nМожу розповісти про наші фотокниги, ціни та допомогти з замовленням.\nЩо вас цікавить?";
                await bot.sendMessage(chatId, welcomeMsg);
                return NextResponse.json({ ok: true });
            }

            // Route non-empty text to core logic
            if (text) {
                const result = await processReceivedMessage('telegram', chatId, username, text, messageId);

                // If AI decided to reply (or we have a generic message to send back)
                if (result.action === 'reply' && result.text) {
                    await bot.sendMessage(chatId, result.text);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('Telegram Webhook Error:', e);
        // Always return 200 to Telegram so it stops retrying the webhook
        return NextResponse.json({ ok: true });
    }
}
