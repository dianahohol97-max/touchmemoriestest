import { NextRequest, NextResponse } from 'next/server';
import { sendStatusChangeNotification } from '@/lib/automation/email-notifications';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/guards';
import type { OrderStatus } from '@/lib/types/automation';

export const dynamic = 'force-dynamic';

/**
 * Auth: admin OR internal cron-secret. Without a guard, anyone could trigger
 * status-change emails to any customer (spam vector + leaks order data via
 * the email body).
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
    const { order_id, old_status, new_status } = body;

    if (!order_id || !new_status) {
      return NextResponse.json(
        { error: 'order_id and new_status are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get order details. Schema notes:
    //   - `deadline`, not `production_deadline`
    //   - `ttn`, not `tracking_number`
    //   - products has `name`, not `title`
    //   - Line items live in `items` JSONB (no order_items / orders.product_id);
    //     pull the first item's product_name for the email body.
    //   - customer:customers(...) returns an object, not an array (Supabase
    //     single-row foreign-key joins do not wrap in an array)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        deadline,
        ttn,
        items,
        customer_name,
        customer_email,
        customer:customers(name, email)
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Prepare tracking URL if available
    let trackingUrl = '';
    if (order.ttn) {
      // Nova Poshta tracking URL
      trackingUrl = `https://novaposhta.ua/tracking/?cargo_number=${order.ttn}`;
    }

    // Customer info: prefer joined customers row, fall back to inline
    // customer_email / customer_name on the order (guest checkout).
    const customerRecord = Array.isArray((order as any).customer)
      ? (order as any).customer[0]
      : (order as any).customer;
    const customerName = customerRecord?.name || order.customer_name || '';
    const customerEmail = customerRecord?.email || order.customer_email || '';
    const productTitle = Array.isArray(order.items) && order.items[0]
      ? ((order.items[0] as any).product_name || '')
      : '';

    // Send notification
    const result = await sendStatusChangeNotification({
      orderId: order.id,
      customerEmail,
      customerName,
      orderNumber: order.order_number,
      productTitle,
      newStatus: new_status as OrderStatus,
      oldStatus: old_status as OrderStatus,
      productionDeadline: order.deadline
        ? new Date(order.deadline).toLocaleDateString('uk-UA')
        : undefined,
      trackingNumber: order.ttn || undefined,
      trackingUrl: trackingUrl || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending status change notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
