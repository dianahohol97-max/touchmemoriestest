import { createClient } from '@supabase/supabase-js';
import { generateChatbotReply } from './anthropic';

import { getAdminClient } from '@/lib/supabase/admin';

async function findOrCreateConversation(supabase: any, platform: string, externalUserId: string, externalUsername: string) {
    const { data: existing } = await supabase
        .from('social_conversations')
        .select('*')
        .eq('platform', platform)
        .eq('external_user_id', externalUserId)
        .single();
    if (existing) return existing;

    const { data: newConv, error: createErr } = await supabase
        .from('social_conversations')
        .insert({
            platform,
            external_user_id: externalUserId,
            external_username: externalUsername,
        })
        .select()
        .single();
    if (createErr) throw createErr;
    return newConv;
}

/**
 * Persist a message into the conversation history WITHOUT running the AI.
 * Used by the Telegram Business flow for Diana's own outgoing replies
 * (sender 'human_manager') and for customer messages that should only be
 * monitored, not answered (media-only, mode=off, human-silence window).
 */
export async function recordMessageOnly(
    platform: string,
    externalUserId: string,
    externalUsername: string,
    messageText: string,
    platformMessageId: string,
    sender: 'customer' | 'human_manager'
) {
    const supabase = getAdminClient();
    try {
        const conversation = await findOrCreateConversation(supabase, platform, externalUserId, externalUsername);
        const { error } = await supabase
            .from('social_messages')
            .insert({
                conversation_id: conversation.id,
                sender,
                original_text: messageText,
                platform_message_id: platformMessageId || null,
            });
        if (error) console.error('Error recording message:', error);
        return { conversationId: conversation.id as string };
    } catch (e: any) {
        console.error('recordMessageOnly error:', e);
        return { conversationId: null };
    }
}

export async function processReceivedMessage(
    platform: string,
    externalUserId: string,
    externalUsername: string,
    messageText: string,
    platformMessageId: string,
    options?: {
        // false = draft mode: the AI reply is returned to the caller but NOT
        // saved as a sent 'ai' message (the customer never received it, so it
        // must not appear in the visible history or feed future AI context).
        persistAiReply?: boolean;
    }
) {
    const supabase = getAdminClient();
    const persistAiReply = options?.persistAiReply !== false;
    try {
        console.log(`[Chatbot] Received message from ${platform} user ${externalUserId}: "${messageText}"`);

        // 1. Find or create conversation
        const conversation = await findOrCreateConversation(supabase, platform, externalUserId, externalUsername);

        // 2. Save incoming user message
        const { error: msgErr } = await supabase
            .from('social_messages')
            .insert({
                conversation_id: conversation.id,
                sender: 'customer',
                original_text: messageText,
                platform_message_id: platformMessageId
            });
        if (msgErr) console.error('Error saving user message:', msgErr);

        // 3. Status check: Should AI respond?
        // If human is handling it, simple save and return.
        if (conversation.status === 'human_handling' || conversation.status === 'needs_human') {
            return { action: 'none', reason: `Conversation status is ${conversation.status}`, needsHuman: false };
        }

        // 4. Check for Order Numbers via regex
        // Real order numbers are TM-001170 (site) and CRM-13800 (KeyCRM mirror);
        // PB- is the legacy format this bot was originally written against.
        const orderRegex = /(?:TM|CRM|PB)-[\dA-Z][\dA-Z-]*/i;
        const match = messageText.match(orderRegex);

        let orderContext = null;
        if (match) {
            const orderNumber = match[0].toUpperCase();
            // Fetch order context
            const { data: order } = await supabase.from('orders').select('*').eq('order_number', orderNumber).single();
            if (order) {
                orderContext = order;
                // Update conversation with order_id
                await supabase.from('social_conversations').update({ order_id: order.id }).eq('id', conversation.id);
            }
        }

        // 5. Gather full context for AI
        // a. Fetch base products (prices/availability)
        const { data: products } = await supabase.from('products').select('name, price, is_active, format_options');

        // b. Fetch system settings prompt
        const { data: settingData } = await supabase.from('settings').select('value').eq('key', 'chatbot_system_prompt').single();
        const baseSystemPrompt = settingData?.value || 'Ти привітний ШІ асистент TouchMemories.';

        // c. Fetch conversation history (last 10 messages)
        const { data: history } = await supabase
            .from('social_messages')
            .select('sender, original_text')
            .eq('conversation_id', conversation.id)
            .order('sent_at', { ascending: false })
            .limit(10);

        // Map to Anthropic format
        let aiMessages: { role: 'user' | 'assistant', content: string }[] = [];
        if (history) {
            const sortedHistory = history.reverse(); // oldest first
            aiMessages = sortedHistory.map((h: any) => ({
                role: (h.sender === 'customer') ? 'user' : 'assistant',
                content: h.original_text
            }));
        }

        // Add the current message if it wasn't picked up due to delay
        if (aiMessages.length === 0 || aiMessages[aiMessages.length - 1].content !== messageText) {
            aiMessages.push({ role: 'user', content: messageText });
        }

        // 6. Call Anthropic
        let aiReplyText = await generateChatbotReply(
            baseSystemPrompt,
            aiMessages,
            { products, order: orderContext }
        );

        // 7. Post-process AI Reply (Check for escalation keywords)
        let newStatus = conversation.status;
        // 'передаю діані' is the marker phrase the system prompt instructs the
        // model to include whenever a human should take over — keep the two in sync.
        const escalationKeywords = ['підключу менеджера', 'needs_human', 'покличу', 'senior manager', 'зв\'яжемось з вами', 'передаю діані', 'передам діані', 'передаю діалог діані'];
        const shouldEscalate = escalationKeywords.some(keyword => aiReplyText.toLowerCase().includes(keyword));

        if (shouldEscalate) {
            newStatus = 'needs_human';
            // Here you could trigger a Telegram notification to the Admin.
        }

        // Also check auto escalate count
        const nextMessageCount = (conversation.ai_message_count ?? 0) + 1;
        const { data: escCountData } = await supabase.from('settings').select('value').eq('key', 'chatbot_auto_escalate_count').single();
        const autoEscalateLimit = parseInt(escCountData?.value || '10');

        if (nextMessageCount >= autoEscalateLimit && newStatus !== 'needs_human') {
            newStatus = 'needs_human';
            aiReplyText += '\n\nБачу, що питання непросте, тож передаю нашу розмову Діані — вона допоможе швидше 💛';
        }

        // 8. Save AI reply and update conversation status. In draft mode the
        // reply was never delivered, so only the status change (escalation)
        // is persisted — not the message, not the ai_message_count.
        if (persistAiReply) {
            await supabase
                .from('social_messages')
                .insert({
                    conversation_id: conversation.id,
                    sender: 'ai',
                    original_text: aiReplyText
                });
        }

        await supabase
            .from('social_conversations')
            .update({
                status: newStatus,
                ai_message_count: persistAiReply ? nextMessageCount : (conversation.ai_message_count ?? 0)
            })
            .eq('id', conversation.id);

        // 9. Return the reply so platform handler sends it to user
        return { action: 'reply', text: aiReplyText, needsHuman: newStatus === 'needs_human' };

    } catch (e: any) {
        console.error('Chatbot Core Error:', e);
        // needsHuman on errors so the platform side can alert a manager instead
        // of leaving the customer with a dead bot.
        return { action: 'error', text: 'Виникла технічна помилка.', needsHuman: true };
    }
}
