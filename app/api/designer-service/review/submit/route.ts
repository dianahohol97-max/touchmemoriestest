import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/automation/telegram-notifications';

export async function POST(request: NextRequest) {
  try {
    const { token, decision, pageComments, generalFeedback } = await request.json();

    if (!token || !decision) {
      return NextResponse.json(
        { error: 'Token and decision are required' },
        { status: 400 }
      );
    }

    if (!['approved', 'revision_requested'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get revision
    const { data: revision, error: revisionError } = await supabase
      .from('design_revisions')
      .select(`
        *,
        order:orders(
          id,
          order_number,
          customer:customers(name, email)
        )
      `)
      .eq('client_token', token)
      .single();

    if (revisionError || !revision) {
      return NextResponse.json(
        { error: 'Revision not found' },
        { status: 404 }
      );
    }

    // Check if already reviewed
    if (revision.client_decision) {
      return NextResponse.json(
        { error: 'Already reviewed' },
        { status: 400 }
      );
    }

    // Update revision
    const { error: updateError } = await supabase
      .from('design_revisions')
      .update({
        client_decision: decision,
        client_comments: pageComments || [],
        general_feedback: generalFeedback || '',
        reviewed_at: new Date().toISOString(),
      })
      .eq('client_token', token);

    if (updateError) {
      console.error('Error updating revision:', updateError);
      return NextResponse.json(
        { error: 'Failed to update revision' },
        { status: 500 }
      );
    }

    // Update brief status
    const newBriefStatus = decision === 'approved' ? 'approved' : 'revision_requested';
    await supabase
      .from('design_briefs')
      .update({ status: newBriefStatus })
      .eq('order_id', (revision as any).order.id);

    // Send Telegram notification to designer
    const telegramChatId = process.env.TELEGRAM_DESIGNER_CHAT_ID;
    if (telegramChatId) {
      const order = (revision as any).order;

      if (decision === 'approved') {
        await sendTelegramMessage({
          chat_id: telegramChatId,
          text: `✅ Клієнт затвердив дизайн!\n\n` +
            `Замовлення: #${order.order_number}\n` +
            `Клієнт: ${order.customer.name}\n` +
            `Загальний відгук: ${generalFeedback || 'Немає'}\n\n` +
            `Можна відправляти у виробництво! 🎉`,
        });
      } else {
        const commentsText = pageComments && pageComments.length > 0
          ? pageComments.map((c: any) => `  • Стор. ${c.page}: ${c.text}`).join('\n')
          : '  Немає';

        await sendTelegramMessage({
          chat_id: telegramChatId,
          text: `✏️ Клієнт запросив правки\n\n` +
            `Замовлення: #${order.order_number}\n` +
            `Клієнт: ${order.customer.name}\n` +
            `Ревізія: ${revision.revision_number + 1}\n\n` +
            `Коментарі до сторінок:\n${commentsText}\n\n` +
            `Загальний відгук: ${generalFeedback || 'Немає'}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      decision,
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
