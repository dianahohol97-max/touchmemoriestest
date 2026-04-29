import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Called by Make.com every 15 minutes
// Make.com scenario: Schedule (every 15 min) → HTTP POST to /api/magazine-brief/cron
export async function POST(request: NextRequest) {
  // Cron auth: require the secret to be configured AND match. No fallback
  // value (the previous fallback to 'tm_cron_2026' was checked into git
  // history, so anyone could call this endpoint and trigger generation).
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();

  // Check current Kyiv time (UTC+3)
  const now = new Date();
  const kyivHour = (now.getUTCHours() + 3) % 24;

  // Don't generate between 22:00 and 08:00 Kyiv time
  if (kyivHour >= 22 || kyivHour < 8) {
    return NextResponse.json({ skipped: true, reason: 'night_hours', kyivHour });
  }

  // Find briefs that are ready to generate
  const { data: briefs, error } = await supabase
    .from('magazine_briefs')
    .select('id, customer_email, customer_name, subject_name')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now.toISOString())
    .limit(5); // Process max 5 at a time

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!briefs || briefs.length === 0) return NextResponse.json({ processed: 0 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';
  const results: string[] = [];

  for (const brief of briefs) {
    // Fire generation (don't await — let it run)
    fetch(`${siteUrl}/api/magazine-brief/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({ briefId: brief.id }),
    }).catch(e => console.error('[cron] generate error:', e));

    results.push(brief.id);
  }

  return NextResponse.json({ processed: results.length, briefIds: results });
}

// Also support GET for easy testing
export async function GET() {
  return NextResponse.json({ message: 'Magazine brief cron endpoint. Use POST with x-cron-secret header.' });
}
