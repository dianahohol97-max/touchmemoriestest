import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Customer review action endpoint — token-gated, no auth required.
 *
 * POST /api/review/{token}/approve
 *   - Looks up customer_projects by share_token.
 *   - If found, marks project + linked design_brief as approved.
 *
 * POST /api/review/{token}/revision  (with body { note: string })
 *   - Same lookup, marks both as revision_requested with the note.
 *
 * The action is determined by the trailing `action` path segment.
 *
 * Security model: this is intentionally unauthenticated, but it cannot run as
 * the cookie-bound client because the underlying tables (customer_projects,
 * design_briefs) require admin/owner RLS to write. We use the service-role
 * client and validate the token here. Brute-forcing the token is impractical
 * (UUID v4) but a future improvement could add per-token rate limiting.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ token: string; action: string }> }
) {
    const { token, action } = await params;
    if (!token || !/^[a-zA-Z0-9_-]{8,128}$/.test(token)) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'revision') {
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: project, error: lookupErr } = await supabase
        .from('customer_projects')
        .select('id, order_id, status')
        .eq('share_token', token)
        .maybeSingle();

    if (lookupErr || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (action === 'approve') {
        const { error: upErr } = await supabase
            .from('customer_projects')
            .update({ status: 'approved', approved_at: new Date().toISOString() })
            .eq('share_token', token);
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

        if (project.order_id) {
            await supabase
                .from('design_briefs')
                .update({ status: 'approved' })
                .eq('order_id', project.order_id);
        }
        return NextResponse.json({ ok: true, status: 'approved' });
    }

    // action === 'revision'
    let body: { note?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const note = String(body?.note ?? '').trim();
    if (!note) {
        return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }
    if (note.length > 5000) {
        return NextResponse.json({ error: 'Note too long' }, { status: 400 });
    }

    const { error: revErr } = await supabase
        .from('customer_projects')
        .update({ status: 'revision_requested', revision_notes: note })
        .eq('share_token', token);
    if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 });

    if (project.order_id) {
        await supabase
            .from('design_briefs')
            .update({ status: 'revision_requested' })
            .eq('order_id', project.order_id);
    }
    return NextResponse.json({ ok: true, status: 'revision_requested' });
}
