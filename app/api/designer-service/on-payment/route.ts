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

    // Get order details. Two things to note about this query:
    //
    // 1. There is no `order_items` table — order line items live as JSONB
    //    in `orders.items`. The earlier version of this handler joined a
    //    nonexistent table and silently bailed out; the products it
    //    needed to look up (`has_designer_option`, `designer_service_price`,
    //    `max_free_revisions`) aren't actually used downstream anyway —
    //    this handler only needs the customer's name/email/order_number
    //    + the designer fee already stored on the order.
    //
    // 2. customer_id is optional on orders (guest checkout). When it's
    //    null we fall back to the inline customer_* fields on the order
    //    itself so the brief email and Telegram ping still go out.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, order_number, with_designer, paid_at,
        designer_service_fee,
        customer_id, customer_name, customer_email,
        customer:customers(name, email)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Resolve customer info: prefer the joined customers row, fall back
    // to the inline guest-checkout fields. Either path can fail (the
    // join is nullable, the inline fields can be empty for incomplete
    // submissions) — if we have no email at all, the email send below
    // will skip on its own.
    const customerRecord = Array.isArray((order as any).customer)
      ? (order as any).customer[0]
      : (order as any).customer;
    const customerName = customerRecord?.name || order.customer_name || 'Клієнт';
    const customerEmail = customerRecord?.email || order.customer_email || '';

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

    // Send email to customer (only if we actually have an address)
    let emailResult: { success: boolean; error?: string } = { success: false };
    if (customerEmail) {
      emailResult = await sendBriefLinkEmail({
        customerEmail,
        customerName,
        orderNumber: order.order_number,
        token: briefToken,
      });
      if (!emailResult.success) {
        console.error('Failed to send brief link email:', emailResult.error);
        // Don't fail the request, just log the error
      }
    } else {
      console.warn('on-payment: order has no customer email; skipping brief link email', { orderId });
    }

    // Send Telegram notification to designer
    const telegramChatId = process.env.TELEGRAM_DESIGNER_CHAT_ID;
    if (telegramChatId) {
      await sendTelegramMessage({
        chat_id: telegramChatId,
        text: ` Нове замовлення з послугою дизайнера!\n\n` +
          `Замовлення: #${order.order_number}\n` +
          `Клієнт: ${customerName}\n` +
          `Email: ${customerEmail || '(відсутній)'}\n` +
          `Вартість послуги: ${order.designer_service_fee || 500} грн\n\n` +
          (customerEmail
            ? `Клієнту надіслано email з посиланням на бриф.\n`
            : `Email клієнта відсутній — зв'яжіться іншим каналом.\n`) +
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
