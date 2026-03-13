import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function generateChatbotReply(systemPrompt: string, messages: { role: 'user' | 'assistant', content: string }[], contextData: any) {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('Missing ANTHROPIC_API_KEY, returning fallback response.');
        return 'Вибачте, наразі я не можу відповісти (ШІ тимчасово недоступний).';
    }

    try {
        // Construct Context Markdown
        let dynamicContext = '\n\n--- КОНТЕКСТ ДЛЯ AI ---\n';

        if (contextData.products) {
            dynamicContext += '\n[PRODUCTS_CONTEXT]\n';
            contextData.products.forEach((p: any) => {
                dynamicContext += `- ${p.name}: ${p.price} грн. (${p.is_active ? 'В наявності' : 'Немає'})\n`;
            });
        }

        if (contextData.order) {
            dynamicContext += '\n[ORDER_CONTEXT]\n';
            dynamicContext += `Замовлення: ${contextData.order.order_number}\n`;
            dynamicContext += `Статус: ${contextData.order.order_status}\n`;
            dynamicContext += `Сума: ${contextData.order.total} грн.\n`;
            dynamicContext += `ТТН: ${contextData.order.ttn || 'Ще не сформовано'}\n`;
        }

        dynamicContext += '\n[DELIVERY_CONTEXT]\nВідправки Новою Поштою протягом 1-3 днів. Є самовивіз у Києві.\n';

        const finalSystemPrompt = systemPrompt + dynamicContext;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 300,
            temperature: 0.7,
            system: finalSystemPrompt,
            messages: messages,
        });

        const reply = response.content[0].type === 'text' ? response.content[0].text : '';
        return reply;

    } catch (error) {
        console.error('Anthropic API Error:', error);
        return 'Вибачте, сталася помилка при обробці вашого запиту. Я передам це менеджеру.';
    }
}
