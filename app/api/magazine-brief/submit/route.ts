import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

const supabase = getAdminClient();

function getScheduledTime(): Date {
  const now = new Date();
  // Kyiv time = UTC+3
  const kyivHour = (now.getUTCHours() + 3) % 24;

  // If between 08:00 and 19:00 Kyiv time — generate after 3 hours
  if (kyivHour >= 8 && kyivHour < 19) {
    return new Date(now.getTime() + 3 * 60 * 60 * 1000);
  }

  // If night (19:00–08:00) — schedule for 08:00 next morning
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(5, 0, 0, 0); // 08:00 Kyiv = 05:00 UTC
  
  // But if we are early morning before 8 — schedule for today 08:00
  if (kyivHour < 8) {
    const today = new Date(now);
    today.setUTCHours(5, 0, 0, 0);
    return today;
  }

  return tomorrow;
}

// Only these fields may be written by the client. Spreading the raw body
// (`...briefData`) let a caller set any column — including server-owned ones like
// `status`, `scheduled_for`, or `id` — so the brief could be pre-marked done or
// its generation time tampered with. Whitelisting the known form fields closes that.
const TEXT_FIELDS = [
  'subject_name', 'relationship', 'subject_age', 'subject_city',
  'three_words', 'what_amazes', 'in_hard_moments', 'superpower', 'never_does',
  'unforgettable_moment', 'when_you_feel_bad', 'funny_situation', 'loves',
  'small_habit', 'morning_ritual', 'music_film', 'how_she_laughs',
  'tone', 'language', 'customer_email', 'customer_name',
] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    const brief: Record<string, unknown> = {};
    for (const key of TEXT_FIELDS) {
      if (body[key] !== undefined && body[key] !== null) {
        brief[key] = typeof body[key] === 'string' ? String(body[key]).slice(0, 5000) : body[key];
      }
    }
    // page_topics is an array of short topic ids — accept it explicitly, capped.
    if (Array.isArray(body.page_topics)) {
      brief.page_topics = body.page_topics.slice(0, 8).map((t: unknown) => String(t).slice(0, 100));
    }

    const scheduledFor = getScheduledTime();

    const { data, error } = await supabase
      .from('magazine_briefs')
      .insert({
        order_id: orderId || null,
        ...brief,
        status: 'scheduled',
        scheduled_for: scheduledFor.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, briefId: data.id, scheduledFor: scheduledFor.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
