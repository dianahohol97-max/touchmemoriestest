import { NextRequest, NextResponse } from 'next/server';
import { getPLReport } from '@/lib/supabase/expenses';

export async function GET(request: NextRequest) {
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
