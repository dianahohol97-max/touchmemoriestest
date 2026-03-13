import { createClient } from '@supabase/supabase-js';
import { generateChatbotReply } from './anthropic';

import { getAdminClient } from '@/lib/supabase/admin';

export async function processReceivedMessage(platform: string, externalUserId: string, externalUsername: string, messageText: string, platformMessageId: string) {
    const supabase = getAdminClient();
    try {
        console.log(`[Chatbot] Received message from ${platform} user ${externalUserId}: "${messageText}"`);

        // 1. Find or create conversation
        let { data: conversation } = await supabase
            .from('social_conversations')
            .select('*')
            .eq('platform', platform)
            .eq('external_user_id', externalUserId)
            .single();

        if (!conversation) {
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
            conversation = newConv;
        }

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
            return { action: 'none', reason: `Conversation status is ${conversation.status}` };
        }

        // 4. Check for Order Numbers via regex
        const orderRegex = /PB-\d{4}-[A-Z0-9]+/i;
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
            aiMessages = sortedHistory.map(h => ({
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
        const escalationKeywords = ['підключу менеджера', 'needs_human', 'покличу', 'senior manager', 'зв\'яжемось з вами'];
        const shouldEscalate = escalationKeywords.some(keyword => aiReplyText.toLowerCase().includes(keyword));

        if (shouldEscalate) {
            newStatus = 'needs_human';
            // Here you could trigger a Telegram notification to the Admin.
        }

        // Also check auto escalate count
        const nextMessageCount = conversation.ai_message_count + 1;
        const { data: escCountData } = await supabase.from('settings').select('value').eq('key', 'chatbot_auto_escalate_count').single();
        const autoEscalateLimit = parseInt(escCountData?.value || '10');

        if (nextMessageCount >= autoEscalateLimit && newStatus !== 'needs_human') {
            newStatus = 'needs_human';
            aiReplyText += '\n\nЯ бачу, що ми довго спілкуємося. Я підключив менеджера, щоб допомогти вам швидше!';
        }

        // 8. Save AI reply and update conversation status
        await supabase
            .from('social_messages')
            .insert({
                conversation_id: conversation.id,
                sender: 'ai',
                original_text: aiReplyText
            });

        await supabase
            .from('social_conversations')
            .update({
                status: newStatus,
                ai_message_count: nextMessageCount
            })
            .eq('id', conversation.id);

        // 9. Return the reply so platform handler sends it to user
        return { action: 'reply', text: aiReplyText };

    } catch (e: any) {
        console.error('Chatbot Core Error:', e);
        return { action: 'error', text: 'Виникла технічна помилка.' };
    }
}
