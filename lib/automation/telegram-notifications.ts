/**
 * Telegram Bot Integration for Designer Notifications
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram
 * 2. Get bot token and add to env: TELEGRAM_BOT_TOKEN
 * 3. Designers start chat with bot and send /start
 * 4. Bot responds with their chat_id
 * 5. Admin adds chat_id to designer's staff profile
 */

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  disable_notification?: boolean;
}

/**
 * Send message via Telegram Bot API
 */
export async function sendTelegramMessage(params: TelegramMessage): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return {
        success: false,
        error: 'TELEGRAM_BOT_TOKEN not configured',
      };
    }

    const response = await fetch(
      `${TELEGRAM_API_URL}${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: params.chat_id,
          text: params.text,
          parse_mode: params.parse_mode || 'Markdown',
          disable_notification: params.disable_notification || false,
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return {
        success: false,
        error: data.description || 'Failed to send Telegram message',
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Notify designer about new order assignment
 */
export async function notifyDesignerNewOrder(params: {
  designerName: string;
  telegramChatId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  productTitle: string;
  pageCount: number;
  deadline: string;
  isExpress: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const expressTag = params.isExpress ? '⚡ *ЕКСПРЕС* ' : '';

  const message = `
${expressTag}🎨 *Нове замовлення призначено вам!*

*Замовлення:* #${params.orderNumber}
*Клієнт:* ${params.customerName}
*Товар:* ${params.productTitle}
*Сторінок:* ${params.pageCount}
*Дедлайн:* ${params.deadline}

Деталі: [Переглянути замовлення](https://touchmemories.com/admin/orders/${params.orderId})

Успішної роботи! 💙
  `.trim();

  return sendTelegramMessage({
    chat_id: params.telegramChatId,
    text: message,
    parse_mode: 'Markdown',
  });
}

/**
 * Notify designer about approaching deadline
 */
export async function notifyDesignerDeadlineApproaching(params: {
  telegramChatId: string;
  orderId: string;
  orderNumber: string;
  deadline: string;
  daysRemaining: number;
}): Promise<{ success: boolean; error?: string }> {
  const urgencyEmoji = params.daysRemaining <= 1 ? '🔥🔥🔥' : '⚠️';

  const message = `
${urgencyEmoji} *Наближається дедлайн!*

*Замовлення:* #${params.orderNumber}
*Дедлайн:* ${params.deadline}
*Залишилось:* ${params.daysRemaining} ${getDaysWord(params.daysRemaining)}

[Переглянути замовлення](https://touchmemories.com/admin/orders/${params.orderId})
  `.trim();

  return sendTelegramMessage({
    chat_id: params.telegramChatId,
    text: message,
    parse_mode: 'Markdown',
  });
}

/**
 * Notify designer about overdue order
 */
export async function notifyDesignerOverdue(params: {
  telegramChatId: string;
  orderId: string;
  orderNumber: string;
  deadline: string;
  daysOverdue: number;
}): Promise<{ success: boolean; error?: string }> {
  const message = `
🚨 *ПРОСТРОЧЕНО!*

*Замовлення:* #${params.orderNumber}
*Дедлайн був:* ${params.deadline}
*Прострочено на:* ${params.daysOverdue} ${getDaysWord(params.daysOverdue)}

Будь ласка, терміново завершіть це замовлення або зв'яжіться з адміністратором.

[Переглянути замовлення](https://touchmemories.com/admin/orders/${params.orderId})
  `.trim();

  return sendTelegramMessage({
    chat_id: params.telegramChatId,
    text: message,
    parse_mode: 'Markdown',
  });
}

/**
 * Send daily digest to designer
 */
export async function sendDesignerDailyDigest(params: {
  telegramChatId: string;
  designerName: string;
  activeOrders: number;
  totalPages: number;
  todayDeadlines: number;
  thisWeekDeadlines: number;
}): Promise<{ success: boolean; error?: string }> {
  const message = `
☀️ *Доброго ранку, ${params.designerName}!*

📊 Ваша робоча панель на сьогодні:

• Активних замовлень: *${params.activeOrders}*
• Всього сторінок: *${params.totalPages}*
• Дедлайн сьогодні: *${params.todayDeadlines}*
• Дедлайн цього тижня: *${params.thisWeekDeadlines}*

Продуктивного дня! 💪
  `.trim();

  return sendTelegramMessage({
    chat_id: params.telegramChatId,
    text: message,
    parse_mode: 'Markdown',
    disable_notification: true, // Don't wake them up if sent early
  });
}

/**
 * Get correct Ukrainian word form for days
 */
function getDaysWord(days: number): string {
  if (days === 1) return 'день';
  if (days >= 2 && days <= 4) return 'дні';
  return 'днів';
}

/**
 * Set up webhook for receiving messages from Telegram
 * (For /start command to get chat_id)
 */
export async function setupTelegramWebhook(webhookUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return {
        success: false,
        error: 'TELEGRAM_BOT_TOKEN not configured',
      };
    }

    const response = await fetch(
      `${TELEGRAM_API_URL}${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return {
        success: false,
        error: data.description || 'Failed to set webhook',
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get bot info
 */
export async function getBotInfo(): Promise<{
  success: boolean;
  bot?: any;
  error?: string;
}> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return {
        success: false,
        error: 'TELEGRAM_BOT_TOKEN not configured',
      };
    }

    const response = await fetch(
      `${TELEGRAM_API_URL}${botToken}/getMe`
    );

    const data = await response.json();

    if (!data.ok) {
      return {
        success: false,
        error: data.description || 'Failed to get bot info',
      };
    }

    return {
      success: true,
      bot: data.result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
