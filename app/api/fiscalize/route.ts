import { NextResponse } from 'next/server';
import { fiscalizeOrder } from '@/lib/fiscalize';

export const dynamic = 'force-dynamic';

/**
 * Internal fiscalisation trigger. Called fire-and-forget from the Monobank
 * webhook and the admin "mark paid" flow. Guarded by the cron secret (same
 * shared secret the transactional-email route uses) so it can't be invoked
 * by the public. Idempotent downstream.
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let orderId: string | undefined;
  try {
    ({ orderId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const result = await fiscalizeOrder(orderId);
  return NextResponse.json(result);
}
