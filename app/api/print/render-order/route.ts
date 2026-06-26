import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Trigger the print render for a paid order.
 *
 * Called fire-and-forget from the Monobank webhook on the first transition to
 * paid (and reusable from an admin "re-render" button). It finds the saved
 * constructor project for this order, then asks the Railway render service to
 * screenshot every spread at 300 DPI and upload the JPEGs to Supabase storage.
 *
 * Guarded by CRON_SECRET like the other internal on-payment routes. Always
 * returns 200-ish JSON describing what happened; the caller ignores the body
 * and never lets a render problem break payment confirmation.
 */
export async function POST(request: NextRequest) {
  // Internal auth — same secret the webhook uses for fiscalize / email.
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== (process.env.CRON_SECRET || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orderId } = await request.json().catch(() => ({ orderId: undefined }));
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const renderUrl = process.env.RENDER_SERVICE_URL;       // https://...up.railway.app
  const renderToken = process.env.RENDER_SERVICE_TOKEN;   // shared secret with the service
  if (!renderUrl || !renderToken) {
    // Not configured yet — treat as a no-op so payment flow is unaffected.
    console.warn('[render-order] RENDER_SERVICE_URL/TOKEN not set, skipping render', { orderId });
    return NextResponse.json({ ok: false, skipped: 'service-not-configured' });
  }

  const admin = getAdminClient();

  // Find the design saved for this order. saveDesignToProjects writes order_id
  // onto the project at checkout. If a single order ever has multiple book
  // items, there can be multiple projects — render them all.
  const { data: projects, error } = await admin
    .from('projects')
    .select('id, name')
    .eq('order_id', orderId);

  if (error) {
    console.error('[render-order] project lookup failed', { orderId, error: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!projects || projects.length === 0) {
    // No constructor project for this order (e.g. a non-book product, or an
    // order placed before order_id linking shipped). Nothing to render.
    return NextResponse.json({ ok: true, rendered: 0, note: 'no project for order' });
  }

  const results: Array<{ projectId: string; ok: boolean; detail?: unknown }> = [];
  for (const project of projects) {
    try {
      const res = await fetch(`${renderUrl.replace(/\/$/, '')}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-render-token': renderToken,
        },
        body: JSON.stringify({ projectId: project.id }),
      });
      const detail = await res.json().catch(() => ({}));
      results.push({ projectId: project.id, ok: res.ok, detail });
      if (!res.ok) {
        console.error('[render-order] render failed', { orderId, projectId: project.id, status: res.status, detail });
      }
    } catch (e: any) {
      console.error('[render-order] render request threw', { orderId, projectId: project.id, error: e?.message });
      results.push({ projectId: project.id, ok: false, detail: e?.message });
    }
  }

  const okCount = results.filter(r => r.ok).length;
  return NextResponse.json({ ok: okCount === results.length, rendered: okCount, total: results.length, results });
}
