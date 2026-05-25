import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('orders')
    .select('id, order_number, payment_status, order_status, total, paid_at, customer_name, ttn, tracking_status, items, created_at, with_designer, brief_token')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('orders/[id]/public lookup error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const briefToken = (data.with_designer && data.payment_status === 'paid')
    ? data.brief_token
    : null;

  return NextResponse.json({
    id: data.id,
    order_number: data.order_number,
    payment_status: data.payment_status,
    order_status: data.order_status,
    total: data.total,
    paid_at: data.paid_at,
    customer_name: data.customer_name,
    ttn: data.ttn,
    tracking_status: data.tracking_status,
    items: data.items,
    created_at: data.created_at,
    with_designer: !!data.with_designer,
    brief_token: briefToken,
  });
}
