import { NextRequest, NextResponse } from 'next/server';
import { submitBrief } from '@/lib/designer-service/brief-helpers';
import { triggerAIProcessing } from '@/lib/designer-service/ai-processing';
import { sendTelegramMessage } from '@/lib/automation/telegram-notifications';
import { getResendClient } from '@/lib/email/resend';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

// Strip values that would break Telegram MarkdownV2 / HTML formatting if
// processed downstream as anything other than plain text. We send plain text
// here, so the only realistic risk is a `formData.style_preference` or
// occasion containing newlines or extreme length — clamp.
function safeShort(s: unknown, max = 80): string {
    return String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, max);
}

export async function POST(request: NextRequest) {
  const resend = getResendClient();
  try {
    const body = await request.json();
    const { token, formData } = body;

    if (!token || !formData) {
      return NextResponse.json(
        { error: 'Token and form data are required' },
        { status: 400 }
      );
    }

    // Validate token format up-front. submitBrief() does a DB lookup, but
    // an explicit regex check at the entry point prevents weird payload
    // shapes from reaching downstream code (and stops the AI processing
    // call below from even firing on a malformed token).
    if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Submit brief
    const result = await submitBrief(token, formData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Trigger AI processing in background (don't wait for completion).
    // submitBrief succeeded → token is known-valid in DB, safe to forward.
    triggerAIProcessing(token).catch((error) => {
      console.error('AI processing failed:', error);
      // Error is logged but doesn't affect the response
      // Designer will see the error in the dashboard and can retry
    });

    // Send notification to designer
    const telegramChatId = process.env.TELEGRAM_DESIGNER_CHAT_ID;
    if (telegramChatId) {
      await sendTelegramMessage({
        chat_id: telegramChatId,
        text: ` Новий бриф отримано!\n\nТокен: ${token}\nСтиль: ${safeShort(formData.style_preference)}\nПодія: ${safeShort(formData.occasion)}\nФото: перевірте у системі\n\nAI обробляє фото автоматично.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Brief submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting brief:', error);
    return NextResponse.json(
      { error: 'Failed to submit brief' },
      { status: 500 }
    );
  }
}
