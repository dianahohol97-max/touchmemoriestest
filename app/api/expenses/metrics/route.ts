import { NextResponse } from 'next/server';
import { getExpenseMetrics } from '@/lib/supabase/expenses';

export async function GET() {
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
