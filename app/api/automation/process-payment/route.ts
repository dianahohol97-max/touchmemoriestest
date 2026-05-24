import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateProductionDeadline } from '@/lib/automation/deadline-calculator';
import { calculatePriorityScore } from '@/lib/automation/priority-calculator';
import { autoAssignDesigner } from '@/lib/automation/designer-assignment';
import { sendStatusChangeNotification } from '@/lib/automation/email-notifications';
import { notifyDesignerNewOrder } from '@/lib/automation/telegram-notifications';
import { requireAdmin } from '@/lib/auth/guards';
import type { OrderStatus } from '@/lib/types/automation';

/**
 * Process order payment and trigger automation
 * Called after payment is confirmed.
 *
 * Auth: admin OR internal cron-secret. Without a guard, anyone could call
 * this with an arbitrary order_id and trigger designer assignment + email
 * dispatch + Telegram notifications + production deadline calculation —
 * all of which write back to the order. The Monobank webhook calls this
 * via cron-secret; admins can call it from the panel.
 */
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  const cronOk = !!process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;
  if (!cronOk) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;
  }

  try {
    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'order_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get automation settings
    const { data: settings } = await supabase
      .from('automation_settings')
      .select('*')
      .single();

    if (!settings) {
      return NextResponse.json(
        { error: 'Automation settings not found' },
        { status: 500 }
      );
    }

    // Get order details. Schema notes:
    //   - `products` has `name`, not `title`
    //   - Line items live in items JSONB (no order_items / orders.product_id)
    //   - customer:customers(...) returns an object, not an array
    const { data: order } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        paid_at,
        custom_attributes,
        items,
        customer_name,
        customer_email,
        customer:customers(id, name, email, is_vip)
      `)
      .eq('id', order_id)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const customAttrs = order.custom_attributes as any;
    const pageCount = customAttrs?.page_count || 0;
    const hasExpressTag = customAttrs?.tags?.includes(' Відправити швидше') || false;
    const customerRecord = Array.isArray((order as any).customer)
      ? (order as any).customer[0]
      : (order as any).customer;
    const isVipCustomer = customerRecord?.is_vip || false;
    const customerName = customerRecord?.name || order.customer_name || '';
    const customerEmail = customerRecord?.email || order.customer_email || '';
    const productTitle = Array.isArray(order.items) && order.items[0]
      ? ((order.items[0] as any).product_name || '')
      : '';

    // Get active orders count for queue load calculation. order_status, not status.
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('order_status', ['confirmed', 'in_production', 'quality_check']);

    const activeOrdersCount = activeOrders?.length || 0;

    // Calculate production deadline
    const paidAt = order.paid_at ? new Date(order.paid_at) : new Date();
    const deadline = calculateProductionDeadline({
      paid_at: paidAt,
      page_count: pageCount,
      has_express_tag: hasExpressTag,
      active_orders_count: activeOrdersCount,
    });

    // Calculate priority score
    const priorityScore = calculatePriorityScore({
      production_deadline: deadline,
      has_express_tag: hasExpressTag,
      is_vip_customer: isVipCustomer,
    });

    // Update order with deadline and priority. Column is `deadline`,
    // not `production_deadline`; status column is `order_status`.
    await supabase
      .from('orders')
      .update({
        deadline: deadline.toISOString(),
        priority_score: priorityScore,
        order_status: 'confirmed',
      })
      .eq('id', order_id);

    // Auto-assign designer if enabled
    let assignedDesigner: any = null;
    if (settings.auto_assign_designer) {
      const assignResult = await autoAssignDesigner(order_id);

      if (assignResult.success && assignResult.designer) {
        assignedDesigner = assignResult.designer;

        // Send Telegram notification if enabled
        if (settings.notify_designer_telegram && assignedDesigner.telegram_chat_id) {
          await notifyDesignerNewOrder({
            designerName: assignedDesigner.designer_name,
            telegramChatId: assignedDesigner.telegram_chat_id,
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: customerName || 'N/A',
            productTitle: productTitle || 'N/A',
            pageCount,
            deadline: deadline.toLocaleDateString('uk-UA'),
            isExpress: hasExpressTag,
          });
        }
      }
    }

    // Send customer notification if enabled
    if (settings.notify_customer_email) {
      await sendStatusChangeNotification({
        orderId: order.id,
        customerEmail,
        customerName,
        orderNumber: order.order_number,
        productTitle,
        newStatus: 'confirmed' as OrderStatus,
        oldStatus: 'pending' as OrderStatus,
        productionDeadline: deadline.toLocaleDateString('uk-UA'),
      });
    }

    return NextResponse.json({
      success: true,
      production_deadline: deadline.toISOString(),
      priority_score: priorityScore,
      assigned_designer: assignedDesigner,
    });
  } catch (error) {
    console.error('Error processing payment automation:', error);
    return NextResponse.json(
      { error: 'Failed to process payment automation' },
      { status: 500 }
    );
  }
}
