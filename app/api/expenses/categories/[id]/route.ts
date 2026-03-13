import { NextRequest, NextResponse } from 'next/server';
import { updateExpenseCategory, deleteExpenseCategory } from '@/lib/supabase/expenses';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const category = await updateExpenseCategory(params.id, body);
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
  { params }: { params: { id: string } }
) {
  try {
    await deleteExpenseCategory(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense category:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense category' },
      { status: 500 }
    );
  }
}
