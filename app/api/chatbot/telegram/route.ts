import { NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { processReceivedMessage, recordMessageOnly } from '@/lib/chatbot/core';
import {
    saveBusinessConnection,
    getBusinessConnection,
    getBusinessMode,
    getAlertChatId,
    getHumanSilenceHours,
    humanRepliedRecently,
    sendViaPublicBot,
    describeNonTextMessage,
} from '@/lib/chatbot/telegram-business';
import { handleWorkCommand } from '@/lib/chatbot/work-commands';

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

        // --- Telegram Business: Diana's personal client dialogs -------------
        // These updates only arrive after the bot is connected in her
        // Settings → Telegram Business → Chatbots AND the webhook was
        // re-registered with business updates in allowed_updates
        // (POST /api/chatbot/telegram/setup does that).

        if (body.business_connection) {
            await handleBusinessConnection(body.business_connection);
            return NextResponse.json({ ok: true });
        }

        if (body.business_message) {
            await handleBusinessMessage(body.business_message);
            return NextResponse.json({ ok: true });
        }

        // Edits/deletes in business chats: acknowledge so Telegram doesn't
        // retry; the monitoring history keeps the original text on purpose.
        if (body.edited_business_message || body.deleted_business_messages) {
            return NextResponse.json({ ok: true });
        }

        // Telegram sends updates. We only care about messages.
        if (body.message) {
            const chatId = body.message.chat.id.toString();
            const username = body.message.from?.username || body.message.from?.first_name || 'Unknown User';
            const text = body.message.text || '';
            const messageId = body.message.message_id.toString();

            // Work-chat mode: group chats and the owner's own private chat are
            // a control panel (/status, /order, …) — the customer-facing AI
            // must never answer there, and nothing is recorded as a client
            // dialog.
            const chatType = body.message.chat?.type;
            const isGroup = chatType === 'group' || chatType === 'supergroup';
            const businessState = isGroup || chatType === 'private' ? await getBusinessConnection() : null;
            const isOwnerPrivate = chatType === 'private'
                && !!businessState
                && Number(body.message.from?.id) === businessState.user_id;

            if (isGroup || isOwnerPrivate) {
                const reply = await handleWorkCommand(body.message);
                if (reply) await bot.sendMessage(chatId, reply);
                return NextResponse.json({ ok: true });
            }

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

/**
 * Diana (dis)connected the bot to her personal account. Store the connection
 * so business messages can be attributed (her user_id vs client) and replied
 * to (connection_id), then confirm in her chat with the bot.
 */
async function handleBusinessConnection(conn: any) {
    // Newer Bot API versions moved can_reply into a rights object — read both.
    const canReply = conn.can_reply ?? conn.rights?.can_reply ?? false;
    const state = {
        connection_id: String(conn.id),
        user_id: Number(conn.user?.id),
        user_chat_id: conn.user_chat_id ? Number(conn.user_chat_id) : null,
        can_reply: !!canReply,
        is_enabled: conn.is_enabled !== false,
        updated_at: new Date().toISOString(),
    };
    await saveBusinessConnection(state);

    if (!state.user_chat_id) return;
    if (state.is_enabled) {
        const mode = await getBusinessMode();
        const modeLine = mode === 'auto'
            ? 'Режим: автовідповідь — я відповідаю клієнтам від твого імені.'
            : mode === 'off'
                ? 'Режим: тільки моніторинг — я зберігаю переписки, але нічого не пропоную.'
                : 'Режим: чернетки — я надсилатиму тобі пропозиції відповідей, клієнтам сама не пишу.';
        const replyLine = state.can_reply
            ? ''
            : '\n\nЗверни увагу: дозвіл «відповідати на повідомлення» не надано, тож автовідповідь буде недоступна, поки ти не увімкнеш його в налаштуваннях Telegram Business.';
        await sendViaPublicBot({
            chat_id: state.user_chat_id,
            text: `Підключення Telegram Business активне ✅\n\nТепер я бачу твої діалоги з клієнтами і стежу, щоб жодне повідомлення не лишилось без відповіді.\n${modeLine}${replyLine}`,
        });
    } else {
        await sendViaPublicBot({
            chat_id: state.user_chat_id,
            text: 'Підключення Telegram Business вимкнено. Я більше не бачу твої діалоги з клієнтами.',
        });
    }
}

/**
 * A message in one of Diana's personal dialogs. Outgoing = her own reply
 * (recorded as human_manager so the silence window and the unanswered-cron
 * see it). Incoming = client message: always recorded; depending on mode the
 * AI either drafts a reply for Diana, answers the client directly, or stays
 * quiet.
 */
async function handleBusinessMessage(msg: any) {
    const state = await getBusinessConnection();
    const chatId = msg.chat?.id?.toString();
    const fromId = msg.from?.id ? Number(msg.from.id) : null;
    if (!chatId) return;

    const clientName = [msg.chat?.first_name, msg.chat?.last_name].filter(Boolean).join(' ')
        || msg.chat?.username || 'Клієнт';
    const rawText = msg.text || msg.caption || '';
    const messageId = msg.message_id?.toString() || '';

    // Diana's own outgoing message in the dialog.
    if (state && fromId === state.user_id) {
        await recordMessageOnly('telegram', chatId, clientName, rawText || describeNonTextMessage(msg), messageId, 'human_manager');
        return;
    }

    // Client message. Media without text is recorded for monitoring only —
    // Diana sees her own chats, so there is nothing useful to draft here.
    if (!rawText) {
        await recordMessageOnly('telegram', chatId, clientName, describeNonTextMessage(msg), messageId, 'customer');
        return;
    }

    const mode = await getBusinessMode();
    if (mode === 'off') {
        await recordMessageOnly('telegram', chatId, clientName, rawText, messageId, 'customer');
        return;
    }

    // Human-is-in-charge rule: if Diana replied in this dialog recently, the
    // bot neither answers nor drafts — it only records.
    const silenceHours = await getHumanSilenceHours();
    if (await humanRepliedRecently('telegram', chatId, silenceHours)) {
        await recordMessageOnly('telegram', chatId, clientName, rawText, messageId, 'customer');
        return;
    }

    // Auto mode requires the reply permission on the business connection;
    // without it we degrade to draft so nothing is silently lost.
    const effectiveMode = mode === 'auto' && state?.can_reply && state?.connection_id ? 'auto' : 'draft';

    const result = await processReceivedMessage(
        'telegram', chatId, clientName, rawText, messageId,
        { persistAiReply: effectiveMode === 'auto' }
    );

    const alertChatId = await getAlertChatId();

    if (effectiveMode === 'auto') {
        if (result.action === 'reply' && result.text) {
            const sent = await sendViaPublicBot({
                chat_id: chatId,
                text: result.text,
                businessConnectionId: state!.connection_id,
            });
            if (!sent.success && alertChatId) {
                await sendViaPublicBot({
                    chat_id: alertChatId,
                    text: `⚠️ Не вдалося відповісти клієнту ${clientName} від твого імені (${sent.error}). Повідомлення клієнта: «${rawText}»`,
                });
            }
        }
        if (result.needsHuman && alertChatId) {
            await sendViaPublicBot({
                chat_id: alertChatId,
                text: `❗ Діалог з ${clientName} потребує твоєї уваги — питання складне, я передала його тобі.\n\nОстаннє повідомлення: «${rawText}»`,
            });
        }
        return;
    }

    // Draft mode: the suggestion goes to Diana, never to the client.
    if (result.action === 'reply' && result.text && alertChatId) {
        const header = result.needsHuman
            ? `❗ Повідомлення від ${clientName} — питання складне, краще відповісти самій`
            : `💬 Нове повідомлення від ${clientName}`;
        await sendViaPublicBot({
            chat_id: alertChatId,
            text: `${header}\n\n«${rawText}»\n\nПропоную відповісти так:\n\n«${result.text}»\n\nЯкщо відповідь підходить — просто скопіюй її в діалог. Я працюю в режимі чернетки і сама клієнту нічого не надсилаю.`,
        });
    }
}
