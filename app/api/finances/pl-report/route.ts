import { NextRequest, NextResponse } from 'next/server';
import { getPLReport } from '@/lib/supabase/expenses';
import { requireAdmin } from '@/lib/auth/guards';

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }

    // ISO date validation — these are interpolated into the query, validate shape
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(start_date) || !dateRe.test(end_date)) {
      return NextResponse.json(
        { error: 'Dates must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const report = await getPLReport(start_date, end_date);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Error fetching P&L report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch P&L report' },
      { status: 500 }
    );
  }
}
