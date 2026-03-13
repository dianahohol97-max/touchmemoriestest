import { NextRequest, NextResponse } from 'next/server';
import { sendStatusChangeNotification } from '@/lib/automation/email-notifications';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus } from '@/lib/types/automation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        production_deadline,
        tracking_number,
        customer:customers(name, email),
        product:products(title)
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
    if (order.tracking_number) {
      // Nova Poshta tracking URL
      trackingUrl = `https://novaposhta.ua/tracking/?cargo_number=${order.tracking_number}`;
    }

    // Send notification
    const result = await sendStatusChangeNotification({
      orderId: order.id,
      customerEmail: (order.customer as any)?.[0]?.email || '',
      customerName: (order.customer as any)?.[0]?.name || '',
      orderNumber: order.order_number,
      productTitle: (order.product as any)?.[0]?.title || '',
      newStatus: new_status as OrderStatus,
      oldStatus: old_status as OrderStatus,
      productionDeadline: order.production_deadline
        ? new Date(order.production_deadline).toLocaleDateString('uk-UA')
        : undefined,
      trackingNumber: order.tracking_number || undefined,
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
