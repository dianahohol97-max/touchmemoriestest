// 
// Client-side order submission helper.
// 
// Previously this file inserted into `orders` directly via the anon
// Supabase client. That stopped working when we tightened RLS on
// `orders` — there's no anon INSERT policy, and giving anon write
// access to orders means trusting the client not to set
// payment_status='paid' / skip Monobank. Bad bet.
//
// Now we POST to /api/orders/submit, which validates the payload
// server-side and inserts via service role. Same shape, same return
// contract — callers in the checkout flow don't change.
//

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
  with_designer?: boolean
  designer_service_fee?: number
}

export async function submitOrder(data: OrderData): Promise<{ success: boolean; order_id?: string; order_number?: string; error?: string }> {
  try {
    const res = await fetch('/api/orders/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error('Order submission failed:', res.status, json);
      return { success: false, error: json?.error || `HTTP ${res.status}` };
    }
    return { success: true, order_id: json.order_id, order_number: json.order_number };
  } catch (err: any) {
    console.error('Order submission error:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}
