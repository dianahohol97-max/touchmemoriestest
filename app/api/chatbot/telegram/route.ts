import { NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { processReceivedMessage } from '@/lib/chatbot/core';

// Note: In production we use webhooks, not polling. 
// We initialize the bot just to send messages.
const token = process.env.TELEGRAM_PUBLIC_BOT_TOKEN;
const bot = token ? new TelegramBot(token, { polling: false }) : null;

export async function POST(req: Request) {
    if (!bot) {
        console.error('Telegram bot token not configured');
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
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
