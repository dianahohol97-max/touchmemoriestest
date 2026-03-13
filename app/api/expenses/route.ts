import { NextRequest, NextResponse } from 'next/server';
import { getExpenses, createExpense } from '@/lib/supabase/expenses';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category_id = searchParams.get('category_id') || undefined;
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    const is_recurring = searchParams.get('is_recurring') === 'true' ? true : undefined;

    const expenses = await getExpenses({
      category_id,
      start_date,
      end_date,
      is_recurring,
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const expense = await createExpense(body, user.id);
    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    );
  }
}
