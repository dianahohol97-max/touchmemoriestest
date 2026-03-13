import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  faq: string[];
  products: string[];
  pricing: string[];
  delivery: string[];
}

/**
 * Load context from database for AI assistant
 */
export async function loadAIChatContext(): Promise<ChatContext> {
  const supabase = await createClient();

  // Get FAQ and knowledge base
  const { data: contextSources } = await supabase
    .from('ai_chat_context_sources')
    .select('category, question, answer')
    .eq('enabled', true)
    .order('priority', { ascending: false });

  const context: ChatContext = {
    faq: [],
    products: [],
    pricing: [],
    delivery: [],
  };

  contextSources?.forEach((source) => {
    const text = source.question
      ? `Q: ${source.question}\nA: ${source.answer}`
      : source.answer;

    switch (source.category) {
      case 'faq':
        context.faq.push(text);
        break;
      case 'product':
        context.products.push(text);
        break;
      case 'pricing':
        context.pricing.push(text);
        break;
      case 'delivery':
        context.delivery.push(text);
        break;
      case 'custom':
        context.faq.push(text); // Add custom to FAQ
        break;
    }
  });

  // Get current products and prices from database
  const { data: products } = await supabase
    .from('products')
    .select('title, price, description, custom_attributes')
    .eq('is_active', true)
    .limit(20);

  products?.forEach((product) => {
    const attrs = product.custom_attributes as any;
    const size = attrs?.size || '';
    const pages = attrs?.pages || '';

    context.products.push(
      `${product.title} (${size}${pages ? `, ${pages} сторінок` : ''}) - ${product.price} грн`
    );
  });

  return context;
}

/**
 * Build system prompt with current context
 */
export function buildSystemPrompt(context: ChatContext, businessName: string = 'TouchMemories'): string {
  return `You are a helpful customer support assistant for ${businessName}, a Ukrainian photo book printing service.

Your role:
- Help customers with questions about products, prices, formats, delivery, and production time
- Be warm, friendly, and concise
- Always respond in the SAME language as the customer (Ukrainian, English, Russian, etc.)
- If you don't know something, be honest and say a human manager will help

IMPORTANT CONTEXT:

Products & Formats:
${context.products.length > 0 ? context.products.join('\n') : 'Various photo book formats available'}

FAQ:
${context.faq.length > 0 ? context.faq.join('\n\n') : ''}

Pricing Info:
${context.pricing.length > 0 ? context.pricing.join('\n') : 'Prices vary by format and page count'}

Delivery Info:
${context.delivery.length > 0 ? context.delivery.join('\n') : 'Delivery via Nova Poshta across Ukraine'}

WHEN TO ESCALATE TO HUMAN:
- Questions about a specific order number
- Complaints or conflicts
- Non-standard requests (bulk orders, special customizations)
- If customer seems frustrated or unsatisfied
- If you've tried to help but customer still has issues

How to escalate:
Say: "Дозвольте мені передати вас нашому менеджеру, який зможе краще допомогти з цим питанням. Один момент..."

Guidelines:
- Keep responses concise (2-3 sentences max)
- Use emojis sparingly and only when appropriate
- Be professional but friendly
- Match the customer's tone and language
- Don't make up information - use only the context provided above`;
}

/**
 * Check if message indicates need for human handoff
 */
export function shouldHandoffToHuman(
  userMessage: string,
  conversationHistory: ChatMessage[],
  failedAttemptsCount: number
): { shouldHandoff: boolean; reason?: string } {
  const lowerMessage = userMessage.toLowerCase();

  // Check for order-specific questions
  if (
    lowerMessage.includes('замовлення') ||
    lowerMessage.includes('order') ||
    lowerMessage.includes('тт') ||
    lowerMessage.includes('трек') ||
    /№?\s*\d{4,}/.test(userMessage) // Order number pattern
  ) {
    return {
      shouldHandoff: true,
      reason: 'Order-specific question',
    };
  }

  // Check for complaints/conflicts
  const complaintKeywords = [
    'скарга',
    'незадовол',
    'поганий',
    'жахлив',
    'complaint',
    'unhappy',
    'dissatisfied',
    'terrible',
    'awful',
    'проблема',
    'problem',
    'issue',
  ];

  if (complaintKeywords.some((keyword) => lowerMessage.includes(keyword))) {
    return {
      shouldHandoff: true,
      reason: 'Complaint or issue detected',
    };
  }

  // Check for explicit human request
  const humanRequestKeywords = [
    'менеджер',
    'людина',
    'человек',
    'manager',
    'human',
    'person',
    'оператор',
    'operator',
  ];

  if (humanRequestKeywords.some((keyword) => lowerMessage.includes(keyword))) {
    return {
      shouldHandoff: true,
      reason: 'Customer requested human manager',
    };
  }

  // Check for repeated failed attempts
  if (failedAttemptsCount >= 2) {
    return {
      shouldHandoff: true,
      reason: 'Too many failed resolution attempts',
    };
  }

  // Check conversation length (if too long, might need human)
  if (conversationHistory.length > 10) {
    return {
      shouldHandoff: true,
      reason: 'Extended conversation requiring human expertise',
    };
  }

  return { shouldHandoff: false };
}

/**
 * Send message to Claude API and get response
 */
export async function getChatResponse(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<{ response: string; error?: string }> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return { response: content.text };
    }

    return { response: '', error: 'Unexpected response format' };
  } catch (error: any) {
    console.error('Claude API error:', error);
    return {
      response: '',
      error: error.message || 'Failed to get AI response',
    };
  }
}

/**
 * Process chat message with AI
 */
export async function processAIChatMessage(params: {
  conversationId: string;
  userMessage: string;
  conversationHistory: ChatMessage[];
}): Promise<{
  response: string;
  shouldHandoff: boolean;
  handoffReason?: string;
  error?: string;
}> {
  const { conversationId, userMessage, conversationHistory } = params;

  // Load context
  const context = await loadAIChatContext();
  const systemPrompt = buildSystemPrompt(context);

  // Check if should handoff to human
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from('ai_chat_conversations')
    .select('id')
    .eq('id', conversationId)
    .single();

  // Count failed attempts
  const { data: failedMessages } = await supabase
    .from('ai_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('failed_attempt', true);

  const failedAttemptsCount = failedMessages?.length || 0;

  const handoffCheck = shouldHandoffToHuman(
    userMessage,
    conversationHistory,
    failedAttemptsCount
  );

  if (handoffCheck.shouldHandoff) {
    return {
      response: 'Дозвольте мені передати вас нашому менеджеру, який зможе краще допомогти з цим питанням. Один момент... 👤',
      shouldHandoff: true,
      handoffReason: handoffCheck.reason,
    };
  }

  // Get AI response
  const allMessages: ChatMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const aiResponse = await getChatResponse(allMessages, systemPrompt);

  if (aiResponse.error) {
    return {
      response: 'Вибачте, виникла технічна проблема. Зараз підключу менеджера... 👤',
      shouldHandoff: true,
      handoffReason: 'AI technical error',
      error: aiResponse.error,
    };
  }

  return {
    response: aiResponse.response,
    shouldHandoff: false,
  };
}

/**
 * Get chat statistics for a date range
 */
export async function getAIChatStatistics(startDate: string, endDate: string): Promise<{
  totalConversations: number;
  aiResolvedConversations: number;
  humanHandoffConversations: number;
  aiResolutionRate: number;
  averageMessagesPerConversation: number;
  averageSatisfaction: number;
}> {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from('ai_chat_conversations')
    .select('id, is_handled_by_ai, customer_satisfaction, created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const totalConversations = conversations?.length || 0;
  const aiResolvedConversations = conversations?.filter((c) => c.is_handled_by_ai).length || 0;
  const humanHandoffConversations = totalConversations - aiResolvedConversations;

  // Get message counts
  const { data: messages } = await supabase
    .from('ai_chat_messages')
    .select('conversation_id')
    .in('conversation_id', conversations?.map((c) => c.id) || []);

  const messageCountMap = new Map<string, number>();
  messages?.forEach((msg) => {
    messageCountMap.set(
      msg.conversation_id,
      (messageCountMap.get(msg.conversation_id) || 0) + 1
    );
  });

  const totalMessages = messages?.length || 0;
  const averageMessagesPerConversation = totalConversations > 0
    ? totalMessages / totalConversations
    : 0;

  // Calculate average satisfaction
  const satisfactionScores = conversations
    ?.filter((c) => c.customer_satisfaction)
    .map((c) => c.customer_satisfaction) || [];

  const averageSatisfaction = satisfactionScores.length > 0
    ? satisfactionScores.reduce((sum, score) => sum + (score || 0), 0) / satisfactionScores.length
    : 0;

  const aiResolutionRate = totalConversations > 0
    ? (aiResolvedConversations / totalConversations) * 100
    : 0;

  return {
    totalConversations,
    aiResolvedConversations,
    humanHandoffConversations,
    aiResolutionRate,
    averageMessagesPerConversation,
    averageSatisfaction,
  };
}
