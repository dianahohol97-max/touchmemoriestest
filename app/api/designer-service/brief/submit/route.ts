import { NextRequest, NextResponse } from 'next/server';
import { submitBrief } from '@/lib/designer-service/brief-helpers';
import { triggerAIProcessing } from '@/lib/designer-service/ai-processing';
import { sendTelegramMessage } from '@/lib/automation/telegram-notifications';
import { Resend } from 'resend';



export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const body = await request.json();
    const { token, formData } = body;

    if (!token || !formData) {
      return NextResponse.json(
        { error: 'Token and form data are required' },
        { status: 400 }
      );
    }

    // Submit brief
    const result = await submitBrief(token, formData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Trigger AI processing in background (don't wait for completion)
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
        text: `📝 Новий бриф отримано!\n\nТокен: ${token}\nСтиль: ${formData.style_preference}\nПодія: ${formData.occasion}\nФото: перевірте у системі\n\nAI обробляє фото автоматично.`,
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
