import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRate } from '@/lib/supabase/expenses';
import type { Currency } from '@/lib/types/expenses';
import { requireAdmin } from '@/lib/auth/guards';

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const currency = searchParams.get('currency') as Currency;
    const date = searchParams.get('date') || undefined;

    if (!currency || !['UAH', 'USD', 'EUR'].includes(currency)) {
      return NextResponse.json(
        { error: 'Invalid currency' },
        { status: 400 }
      );
    }

    const rate = await getExchangeRate(currency, date);
    return NextResponse.json({ currency, rate, date: date || new Date().toISOString().split('T')[0] });
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}
