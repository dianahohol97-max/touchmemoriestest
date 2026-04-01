import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Vercel Cron job to process recurring expenses
 * Schedule: Daily at 00:00 UTC
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/recurring-expenses",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // Get all active recurring expenses
    const { data: recurringExpenses, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('is_recurring', true);

    if (fetchError) throw fetchError;

    const expensesToCreate: any[] = [];

    for (const expense of recurringExpenses || []) {
      const lastDate = new Date(expense.date);
      const now = new Date();
      let shouldCreate = false;

      switch (expense.recurring_interval) {
        case 'weekly':
          // Check if 7 days have passed
          const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          shouldCreate = daysDiff >= 7;
          break;

        case 'monthly':
          // Check if we're in a new month
          const monthsDiff = (now.getFullYear() - lastDate.getFullYear()) * 12 +
                            (now.getMonth() - lastDate.getMonth());
          shouldCreate = monthsDiff >= 1;
          break;

        case 'yearly':
          // Check if we're in a new year
          const yearsDiff = now.getFullYear() - lastDate.getFullYear();
          shouldCreate = yearsDiff >= 1;
          break;
      }

      if (shouldCreate) {
        // Calculate new date based on interval
        let newDate = new Date(lastDate);

        switch (expense.recurring_interval) {
          case 'weekly':
            newDate.setDate(newDate.getDate() + 7);
            break;
          case 'monthly':
            newDate.setMonth(newDate.getMonth() + 1);
            break;
          case 'yearly':
            newDate.setFullYear(newDate.getFullYear() + 1);
            break;
        }

        expensesToCreate.push({
          category_id: expense.category_id,
          name: expense.name,
          amount: expense.amount,
          currency: expense.currency,
          amount_uah: expense.amount_uah,
          exchange_rate: expense.exchange_rate,
          date: newDate.toISOString().split('T')[0],
          period_start: expense.period_start,
          period_end: expense.period_end,
          is_recurring: true,
          recurring_interval: expense.recurring_interval,
          supplier: expense.supplier,
          invoice_number: expense.invoice_number,
          notes: expense.notes ? `${expense.notes} (автоматично створено)` : 'Автоматично створено',
          added_by: expense.added_by,
        });
      }
    }

    // Insert new expenses
    if (expensesToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('expenses')
        .insert(expensesToCreate);

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      success: true,
      processed: recurringExpenses?.length || 0,
      created: expensesToCreate.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing recurring expenses:', error);
    return NextResponse.json(
      { error: 'Failed to process recurring expenses' },
      { status: 500 }
    );
  }
}
