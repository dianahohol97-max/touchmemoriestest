import { NextResponse } from 'next/server';
import { getExpenseMetrics } from '@/lib/supabase/expenses';
import { requireAdmin } from '@/lib/auth/guards';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const metrics = await getExpenseMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching expense metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense metrics' },
      { status: 500 }
    );
  }
}
