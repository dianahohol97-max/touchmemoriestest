import { NextRequest, NextResponse } from 'next/server';
import { getExpenseCategories, createExpenseCategory } from '@/lib/supabase/expenses';
import { requireAdmin } from '@/lib/auth/guards';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const categories = await getExpenseCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const category = await createExpenseCategory(body);
    return NextResponse.json(category);
  } catch (error) {
    console.error('Error creating expense category:', error);
    return NextResponse.json(
      { error: 'Failed to create expense category' },
      { status: 500 }
    );
  }
}
