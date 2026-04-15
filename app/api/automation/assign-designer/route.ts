import { NextRequest, NextResponse } from 'next/server';
import { autoAssignDesigner, assignDesigner, getDesignerWorkloads } from '@/lib/automation/designer-assignment';
import { notifyDesignerNewOrder } from '@/lib/automation/telegram-notifications';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, designer_id, auto } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'order_id is required' },
        { status: 400 }
      );
    }

    let result;

    if (auto) {
      // Auto-assign to least busy designer
      result = await autoAssignDesigner(order_id);
    } else if (designer_id) {
      // Manual assignment
      result = await assignDesigner(order_id, designer_id);

      if (result.success) {
        // Get designer info for notification
        const supabase = await createClient();
        const { data: designer } = await supabase
          .from('staff')
          .select('id, name, telegram_chat_id')
          .eq('id', designer_id)
          .single();

        if (designer?.telegram_chat_id) {
          // Get order details
          const { data: order } = await supabase
            .from('orders')
            .select('id, order_number, customer:customers(name), product:products(title), custom_attributes, production_deadline')
            .eq('id', order_id)
            .single();

          if (order) {
            const customAttrs = order.custom_attributes as any;
            const isExpress = customAttrs?.tags?.includes(' Відправити швидше') || false;

            // Send Telegram notification
            await notifyDesignerNewOrder({
              designerName: designer.name,
              telegramChatId: designer.telegram_chat_id,
              orderId: order.id,
              orderNumber: order.order_number,
              customerName: (order.customer as any)?.[0]?.name || 'N/A',
              productTitle: (order.product as any)?.[0]?.title || 'N/A',
              pageCount: customAttrs?.page_count || 0,
              deadline: new Date(order.production_deadline).toLocaleDateString('uk-UA'),
              isExpress,
            });
          }
        }

        (result as any).designer = designer;
      }
    } else {
      return NextResponse.json(
        { error: 'Either auto=true or designer_id must be provided' },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error assigning designer:', error);
    return NextResponse.json(
      { error: 'Failed to assign designer' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const workloads = await getDesignerWorkloads();
    return NextResponse.json(workloads);
  } catch (error) {
    console.error('Error fetching designer workloads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch designer workloads' },
      { status: 500 }
    );
  }
}
