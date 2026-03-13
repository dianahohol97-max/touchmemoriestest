import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendBriefLinkEmail } from '@/lib/designer-service/emails';
import { sendTelegramMessage } from '@/lib/automation/telegram-notifications';

/**
 * Called after payment is confirmed to create design brief and send email
 * This should be called from your payment webhook or order confirmation handler
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(name, email),
        items:order_items(
          *,
          product:products(
            id,
            title,
            has_designer_option,
            designer_service_price,
            max_free_revisions
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order has designer service
    if (!order.with_designer) {
      return NextResponse.json(
        { message: 'Order does not have designer service' },
        { status: 200 }
      );
    }

    // Check if order is paid
    if (!order.paid_at) {
      return NextResponse.json(
        { error: 'Order is not paid yet' },
        { status: 400 }
      );
    }

    // Check if brief already exists
    const { data: existingBrief } = await supabase
      .from('design_briefs')
      .select('id, token')
      .eq('order_id', orderId)
      .single();

    let briefToken;

    if (existingBrief) {
      // Brief already exists, just resend email
      briefToken = existingBrief.token;
    } else {
      // Create new brief
      const { data: newBrief, error: briefError } = await supabase
        .from('design_briefs')
        .insert({
          order_id: orderId,
          status: 'waiting_brief',
        })
        .select('token')
        .single();

      if (briefError) {
        console.error('Error creating brief:', briefError);
        return NextResponse.json(
          { error: 'Failed to create brief' },
          { status: 500 }
        );
      }

      briefToken = newBrief.token;
    }

    // Send email to customer
    const emailResult = await sendBriefLinkEmail({
      customerEmail: order.customer.email,
      customerName: order.customer.name,
      orderNumber: order.order_number,
      token: briefToken,
    });

    if (!emailResult.success) {
      console.error('Failed to send brief link email:', emailResult.error);
      // Don't fail the request, just log the error
    }

    // Send Telegram notification to designer
    const telegramChatId = process.env.TELEGRAM_DESIGNER_CHAT_ID;
    if (telegramChatId) {
      await sendTelegramMessage({
        chat_id: telegramChatId,
        text: `🎨 Нове замовлення з послугою дизайнера!\n\n` +
          `Замовлення: #${order.order_number}\n` +
          `Клієнт: ${order.customer.name}\n` +
          `Email: ${order.customer.email}\n` +
          `Вартість послуги: ${order.designer_service_fee || 500} грн\n\n` +
          `Клієнту надіслано email з посиланням на бриф.\n` +
          `Токен: ${briefToken}`,
      });
    }

    return NextResponse.json({
      success: true,
      briefToken,
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error('Error in on-payment handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
