import { NextRequest, NextResponse } from 'next/server';
import { updateExpenseCategory, deleteExpenseCategory, getExpenseCategoryById } from '@/lib/supabase/expenses';
import { requireAdmin } from '@/lib/auth/guards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    const category = await getExpenseCategoryById(id);
    if (!category) {
      return NextResponse.json({ error: 'Expense category not found' }, { status: 404 });
    }
    return NextResponse.json(category);
  } catch (error) {
    console.error('Error fetching expense category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense category' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    const body = await request.json();
    const category = await updateExpenseCategory(id, body);
    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating expense category:', error);
    return NextResponse.json(
      { error: 'Failed to update expense category' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    await deleteExpenseCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense category:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense category' },
      { status: 500 }
    );
  }
}
