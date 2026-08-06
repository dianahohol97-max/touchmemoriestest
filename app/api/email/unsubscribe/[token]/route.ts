import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Legacy unsubscribe link, kept alive for letters already in people's inboxes.
 *
 * It used to unsubscribe on GET and then write to email_logs.subscriber_id — a
 * column that does not exist on that table, so the handler threw before it
 * could render anything. Worse, unsubscribing on GET is unsafe on its own:
 * mail gateways and link scanners open footer links by themselves and would
 * have removed recipients who never clicked.
 *
 * It now redirects to the confirmation page, which asks first and does the
 * removal over POST.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const base = new URL(request.url).origin;

    if (!token || !TOKEN_RE.test(token)) {
        return NextResponse.redirect(`${base}/unsubscribe`, 302);
    }
    return NextResponse.redirect(`${base}/unsubscribe?token=${encodeURIComponent(token)}`, 302);
}
