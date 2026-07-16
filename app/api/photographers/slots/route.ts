import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken } from '@/lib/photographers/helpers';

export const dynamic = 'force-dynamic';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DURATIONS = new Set([30, 60, 90, 120, 180, 240]);

/** List own slots (upcoming first), auth = cabinet token. */
export async function GET(req: NextRequest) {
  const photographer = await getPhotographerByToken(req.nextUrl.searchParams.get('token') || '');
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const admin = getAdminClient();
  const { data: slots, error } = await admin
    .from('photographer_slots')
    .select('id, slot_date, slot_time, duration_min, price, status, client_name, client_phone, client_email, client_comment, booked_at, payment_status')
    .eq('photographer_id', photographer.id)
    .gte('slot_date', new Date(Date.now() - 86400000).toISOString().slice(0, 10))
    .neq('status', 'cancelled')
    .order('slot_date', { ascending: true })
    .order('slot_time', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slots: slots || [] });
}

/** Add a slot: { token, date: 'YYYY-MM-DD', time: 'HH:MM', duration_min, price? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const photographer = await getPhotographerByToken(String(body?.token || ''));
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const date = String(body?.date || '');
  const time = String(body?.time || '');
  const duration = Number(body?.duration_min) || 60;
  if (!DATE_RE.test(date)) return NextResponse.json({ error: 'Невірна дата' }, { status: 400 });
  if (!TIME_RE.test(time)) return NextResponse.json({ error: 'Невірний час (ГГ:ХХ)' }, { status: 400 });
  if (!DURATIONS.has(duration)) return NextResponse.json({ error: 'Невірна тривалість' }, { status: 400 });
  if (date < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'Дата вже минула' }, { status: 400 });
  }

  const admin = getAdminClient();
  // No duplicate active slot at the same date+time.
  const { data: dup } = await admin
    .from('photographer_slots')
    .select('id')
    .eq('photographer_id', photographer.id)
    .eq('slot_date', date)
    .eq('slot_time', time)
    .neq('status', 'cancelled')
    .maybeSingle();
  if (dup) return NextResponse.json({ error: 'Слот на цей час уже існує' }, { status: 409 });

  const { data: slot, error } = await admin
    .from('photographer_slots')
    .insert({
      photographer_id: photographer.id,
      slot_date: date,
      slot_time: time,
      duration_min: duration,
      price: String(body?.price || '').trim() || null,
    })
    .select('id, slot_date, slot_time, duration_min, price, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slot });
}

/** Mark payment verified/unverified on a booked slot: { token, slot_id, paid } —
 *  the photographer checks their own bank (money never touches the platform)
 *  and flips the badge here. */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const photographer = await getPhotographerByToken(String(body?.token || ''));
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const paid = !!body?.paid;
  const admin = getAdminClient();
  const { data: updated, error } = await admin
    .from('photographer_slots')
    .update({ payment_status: paid ? 'paid' : 'unpaid', paid_at: paid ? new Date().toISOString() : null })
    .eq('id', String(body?.slot_id || ''))
    .eq('photographer_id', photographer.id)
    .eq('status', 'booked')
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated?.length) return NextResponse.json({ error: 'Бронювання не знайдено' }, { status: 404 });
  return NextResponse.json({ success: true });
}

/** Delete a slot (free ones only): { token, slot_id } */
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const photographer = await getPhotographerByToken(String(body?.token || ''));
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const admin = getAdminClient();
  const { data: deleted, error } = await admin
    .from('photographer_slots')
    .delete()
    .eq('id', String(body?.slot_id || ''))
    .eq('photographer_id', photographer.id)
    .eq('status', 'free')
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deleted?.length) return NextResponse.json({ error: 'Слот не знайдено або вже заброньований' }, { status: 404 });
  return NextResponse.json({ success: true });
}
