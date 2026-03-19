import { createClient } from '@/lib/supabase/client'

export interface OrderItem {
  product_type: string
  product_name: string
  format?: string
  cover_type?: string
  pages?: number
  quantity: number
  unit_price: number
  total_price: number
  options?: Record<string, unknown>
}

export interface OrderData {
  customer_name: string
  customer_phone: string
  customer_email?: string
  items: OrderItem[]
  subtotal: number
  delivery_cost: number
  total: number
  delivery_method: string
  delivery_address?: any
  notes?: string
}

export async function submitOrder(data: OrderData): Promise<{ success: boolean; order_number?: string; error?: string }> {
  const supabase = createClient()
  
  const order_number = `TM-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
  
  const { error } = await supabase.from('orders').insert({
    order_number,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    customer_email: data.customer_email || null,
    items: data.items as any,
    subtotal: data.subtotal,
    delivery_cost: data.delivery_cost,
    total: data.total,
    delivery_method: data.delivery_method,
    delivery_address: data.delivery_address || null,
    notes: data.notes || null,
    order_status: 'new',
    payment_status: 'pending',
  })
  
  if (error) {
    console.error('Order submission error:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true, order_number }
}
