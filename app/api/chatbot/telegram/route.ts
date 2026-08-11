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
    reactToMessage,
} from '@/lib/chatbot/telegram-business';
import { handleWorkCommand } from '@/lib/chatbot/work-commands';
import { captureWorkChatOrderMentions } from '@/lib/chatbot/work-chat-monitor';
import { handleWorkQuestion, refreshTaskRecommendations, isMetaWorkQuestion, recordWorkChatMessage } from '@/lib/chatbot/work-questions';
import { getWorkChatIds } from '@/lib/chatbot/telegram-business';
import { getAdminClient } from '@/lib/supabase/admin';

// Two model calls (recommendation + answer) can outlive the default
// serverless budget; a killed invocation never answers Telegram, Telegram
// re-delivers, and the chat gets the same reply again.
export const maxDuration = 60;

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

        // Exactly-once per update (live case: «13576 …?» answered THREE
        // times). Telegram re-delivers an update whenever the previous
        // delivery did not respond fast enough, and each delivery used to run
        // the full pipeline again. The update_id is claimed in the DB first;
        // a unique-violation means an earlier delivery owns this update and
        // this one exits silently. Any OTHER insert error falls through to
        // normal processing — a DB hiccup must not silently drop messages.
        const updateId = Number(body?.update_id);
        if (Number.isFinite(updateId)) {
            const admin = getAdminClient();
            const { error: dupError } = await admin
                .from('telegram_updates')
                .insert({ update_id: updateId });
            if (dupError?.code === '23505') {
                return NextResponse.json({ ok: true, deduped: true });
            }
            // The table only needs to cover Telegram's retry window; two days
            // is generous. Cheap delete keeps it from growing forever.
            await admin
                .from('telegram_updates')
                .delete()
                .lt('received_at', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());
        }

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
                if (reply) {
                    await bot.sendMessage(chatId, reply);
                    return NextResponse.json({ ok: true });
                }

                // Silent monitoring: a non-command group message that mentions
                // an order («13808 обов'язково 12.08 відправити») is captured
                // onto the order itself — history note + tightened deadline.
                // The bot stays quiet in the chat; a ✍ reaction on the message
                // is the only acknowledgement. Requires the bot to be a group
                // admin (otherwise Telegram only delivers commands).
                const noteText = body.message.text || body.message.caption || '';
                const replyMsg = body.message.reply_to_message;
                const replyText = replyMsg ? (replyMsg.text || replyMsg.caption || '') : undefined;

                // A report request to Софія («які доручення не виконані»)
                // must not be captured as an instruction or a completion
                // report — it is a question about the queue, not an event on
                // an order.
                const metaQuestion = isMetaWorkQuestion(noteText);

                if (isGroup && !metaQuestion) {
                    if (noteText && !noteText.startsWith('/')) {
                        try {
                            const result = await captureWorkChatOrderMentions({
                                text: noteText,
                                replyText,
                                chatId,
                                chatTitle: body.message.chat?.title || 'робочий чат',
                                senderName: body.message.from?.first_name || 'учасник',
                            });
                            // ✍ = instruction captured; 👌 = completion report.
                            // Pending counts too: the order just hasn't arrived
                            // from the CRM mirror yet, but the mention is safe.
                            if (result.captured.length || result.pending.length) {
                                await reactToMessage(chatId, body.message.message_id, result.done ? '👌' : '✍');
                            }
                            // Keep the task card's «рекомендована дія» in step
                            // with the thread that just grew.
                            if (result.captured.length) {
                                await refreshTaskRecommendations(result.captured);
                            }
                        } catch (e) {
                            console.error('work-chat monitor failed:', e);
                        }
                    }
                }

                // Natural questions get an answer (Diana, 2026-08-11): «що
                // сьогодні термінового треба відправити», «які доручення не
                // виконані», «13644 коли відправка». Registered work chats and
                // the owner's private chat only; anything ambiguous stays
                // silent so the chat doesn't drown in bot noise.
                if (noteText && !noteText.startsWith('/')) {
                    const allowed = isOwnerPrivate || (isGroup && (await getWorkChatIds()).includes(Number(chatId)));
                    if (allowed) {
                        try {
                            // The answer is built BEFORE the current message
                            // is recorded, so «last messages» context means
                            // the conversation before this one.
                            const answer = await handleWorkQuestion({ text: noteText, replyText, chatId });
                            await recordWorkChatMessage(chatId, {
                                text: noteText,
                                sender: body.message.from?.first_name || username,
                                messageId,
                            });
                            if (answer) {
                                await bot.sendMessage(chatId, answer, { reply_to_message_id: body.message.message_id } as any);
                                await recordWorkChatMessage(chatId, { text: answer, isBot: true });
                            }
                        } catch (e) {
                            console.error('work-chat question failed:', e);
                        }
                    }
                }
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
