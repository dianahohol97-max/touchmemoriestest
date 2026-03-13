import { createClient } from '@/lib/supabase/server';
import type { DesignerWorkload } from '@/lib/types/automation';

/**
 * Get workload for all designers
 */
export async function getDesignerWorkloads(): Promise<DesignerWorkload[]> {
  const supabase = await createClient();

  // Get all designers (staff with role = 'designer' or 'admin')
  const { data: designers, error: designersError } = await supabase
    .from('staff')
    .select('id, name, email, telegram_chat_id, role')
    .in('role', ['designer', 'admin']);

  if (designersError) throw designersError;

  const workloads: DesignerWorkload[] = [];

  for (const designer of designers || []) {
    // Count active orders assigned to this designer
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, custom_attributes')
      .in('status', ['confirmed', 'in_production', 'quality_check'])
      .eq('assigned_designer_id', designer.id);

    if (ordersError) throw ordersError;

    // Calculate total pages in queue
    let totalPages = 0;
    for (const order of orders || []) {
      const customAttrs = order.custom_attributes as any;
      const pageCount = customAttrs?.page_count || 0;
      totalPages += pageCount;
    }

    workloads.push({
      designer_id: designer.id,
      designer_name: designer.name,
      designer_email: designer.email,
      telegram_chat_id: designer.telegram_chat_id,
      active_orders_count: orders?.length || 0,
      total_pages_in_queue: totalPages,
    });
  }

  return workloads;
}

/**
 * Find designer with least workload
 * Prioritizes by: 1) fewest active orders, 2) fewest total pages
 */
export async function findLeastBusyDesigner(): Promise<DesignerWorkload | null> {
  const workloads = await getDesignerWorkloads();

  if (workloads.length === 0) return null;

  // Sort by active orders count, then by total pages
  workloads.sort((a, b) => {
    if (a.active_orders_count !== b.active_orders_count) {
      return a.active_orders_count - b.active_orders_count;
    }
    return a.total_pages_in_queue - b.total_pages_in_queue;
  });

  return workloads[0];
}

/**
 * Auto-assign designer to an order
 */
export async function autoAssignDesigner(orderId: string): Promise<{
  success: boolean;
  designer?: DesignerWorkload;
  error?: string;
}> {
  try {
    const designer = await findLeastBusyDesigner();

    if (!designer) {
      return {
        success: false,
        error: 'No available designers found',
      };
    }

    const supabase = await createClient();

    // Update order with assigned designer
    const { error: updateError } = await supabase
      .from('orders')
      .update({ assigned_designer_id: designer.designer_id })
      .eq('id', orderId);

    if (updateError) {
      return {
        success: false,
        error: updateError.message,
      };
    }

    return {
      success: true,
      designer,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Manually assign designer to order
 */
export async function assignDesigner(
  orderId: string,
  designerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('orders')
      .update({ assigned_designer_id: designerId })
      .eq('id', orderId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Unassign designer from order
 */
export async function unassignDesigner(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('orders')
      .update({ assigned_designer_id: null })
      .eq('id', orderId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get designer statistics
 */
export async function getDesignerStatistics(designerId: string): Promise<{
  active_orders: number;
  completed_this_month: number;
  total_pages_in_queue: number;
  average_completion_time_days: number;
}> {
  const supabase = await createClient();

  // Active orders
  const { data: activeOrders } = await supabase
    .from('orders')
    .select('id, custom_attributes')
    .in('status', ['confirmed', 'in_production', 'quality_check'])
    .eq('assigned_designer_id', designerId);

  let totalPagesInQueue = 0;
  for (const order of activeOrders || []) {
    const customAttrs = order.custom_attributes as any;
    totalPagesInQueue += customAttrs?.page_count || 0;
  }

  // Completed this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: completedOrders } = await supabase
    .from('orders')
    .select('id, confirmed_at, shipped_at')
    .in('status', ['shipped', 'delivered'])
    .eq('assigned_designer_id', designerId)
    .gte('shipped_at', monthStart);

  // Calculate average completion time
  let totalDays = 0;
  let count = 0;

  for (const order of completedOrders || []) {
    if (order.confirmed_at && order.shipped_at) {
      const start = new Date(order.confirmed_at);
      const end = new Date(order.shipped_at);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      totalDays += days;
      count++;
    }
  }

  const averageCompletionDays = count > 0 ? totalDays / count : 0;

  return {
    active_orders: activeOrders?.length || 0,
    completed_this_month: completedOrders?.length || 0,
    total_pages_in_queue: totalPagesInQueue,
    average_completion_time_days: Math.round(averageCompletionDays),
  };
}
