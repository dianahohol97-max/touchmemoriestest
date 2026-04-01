import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateProductionDeadline } from '@/lib/automation/deadline-calculator';
import { calculatePriorityScore } from '@/lib/automation/priority-calculator';
import { autoAssignDesigner } from '@/lib/automation/designer-assignment';
import { sendStatusChangeNotification } from '@/lib/automation/email-notifications';
import { notifyDesignerNewOrder } from '@/lib/automation/telegram-notifications';
import type { OrderStatus } from '@/lib/types/automation';

/**
 * Process order payment and trigger automation
 * Called after payment is confirmed
 */
export async function POST(request: NextRequest) {
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

    // Get order details
    const { data: order } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        paid_at,
        custom_attributes,
        customer:customers(id, name, email, is_vip),
        product:products(id, title)
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
    const hasExpressTag = customAttrs?.tags?.includes('⚡ Відправити швидше') || false;
    const isVipCustomer = (order.customer as any)?.[0]?.is_vip || false;

    // Get active orders count for queue load calculation
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'in_production', 'quality_check']);

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

    // Update order with deadline and priority
    await supabase
      .from('orders')
      .update({
        production_deadline: deadline.toISOString(),
        priority_score: priorityScore,
        status: 'confirmed',
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
            customerName: (order.customer as any)?.[0]?.name || 'N/A',
            productTitle: (order.product as any)?.[0]?.title || 'N/A',
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
        customerEmail: (order.customer as any)?.[0]?.email || '',
        customerName: (order.customer as any)?.[0]?.name || '',
        orderNumber: order.order_number,
        productTitle: (order.product as any)?.[0]?.title || '',
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
