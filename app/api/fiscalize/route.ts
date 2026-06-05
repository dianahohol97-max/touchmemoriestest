import { NextResponse } from 'next/server';
import { fiscalizeOrder, fiscalizePostpayment } from '@/lib/fiscalize';

export const dynamic = 'force-dynamic';

/**
 * Internal fiscalisation trigger. Called fire-and-forget from the Monobank
 * webhook (payment), the admin "mark paid" flow, and the tracking cron
 * (postpayment on delivery). Guarded by the cron secret. Idempotent downstream.
 *
 * body: { orderId, stage?: 'payment' | 'postpayment' }  (default 'payment')
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let orderId: string | undefined;
  let stage: string | undefined;
  try {
    ({ orderId, stage } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const result = stage === 'postpayment'
    ? await fiscalizePostpayment(orderId)
    : await fiscalizeOrder(orderId);
  return NextResponse.json(result);
}
