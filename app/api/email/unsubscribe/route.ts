import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/supabase/like-escape';

export const dynamic = 'force-dynamic';

/**
 * Unsubscribe a recipient. POST only, on purpose.
 *
 * The footer link in every newsletter is opened by more than people: Gmail
 * prefetches, corporate mail gateways and anti-phishing scanners follow links
 * in incoming mail automatically. A GET that unsubscribes would therefore drop
 * recipients who never touched it — silently, and with no way to tell which
 * removals were real. So the link opens a page, the page asks, and only the
 * button press reaches this route.
 *
 * Identification is by token; the address is accepted as a fallback so links
 * from letters sent before tokens existed keep working.
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const token = String(body?.token || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const campaignId = String(body?.campaignId || '').trim();

    if (!token && !email) {
        return NextResponse.json({ error: 'Не вказано адресу' }, { status: 400 });
    }
    if (token && !TOKEN_RE.test(token)) {
        return NextResponse.json({ error: 'Посилання пошкоджене' }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Некоректна адреса' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const query = supabase.from('subscribers').select('id, email, is_active');
    const { data: subscriber } = token
        ? await query.eq('unsubscribe_token', token).maybeSingle()
        : await query.ilike('email', likeEscape(email)).maybeSingle();

    // Not on the subscriber list. This is the normal case for the ~5.3k people
    // imported from KeyCRM: they receive win-back mail through
    // crm_imported_customers, which has no opt-out flag of its own. The only
    // thing get_winback_candidates() checks is whether an INACTIVE subscribers
    // row exists for the address — so writing exactly that row is what makes
    // the unsubscribe stick. Without it the button would appear to work and the
    // letters would keep coming.
    if (!subscriber) {
        if (!email) {
            // A token that matches nobody: stay vague rather than confirm that
            // the link is invalid, and do not create anything.
            return NextResponse.json({ ok: true, alreadyInactive: true, email: null });
        }

        const { error } = await supabase.from('subscribers').upsert(
            {
                email,
                is_active: false,
                unsubscribed_at: new Date().toISOString(),
                source: 'unsubscribe',
            },
            { onConflict: 'email', ignoreDuplicates: true },
        );
        if (error) {
            return NextResponse.json({ error: 'Не вдалося зберегти. Спробуйте ще раз.' }, { status: 500 });
        }

        await supabase.from('email_unsubscribes').insert({
            email,
            campaign_id: UUID_RE.test(campaignId) ? campaignId : null,
            source: 'suppression',
        });

        return NextResponse.json({ ok: true, alreadyInactive: false, email });
    }

    const already = (subscriber as any).is_active === false;

    if (!already) {
        const { error } = await supabase
            .from('subscribers')
            .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
            .eq('id', (subscriber as any).id);
        if (error) {
            return NextResponse.json({ error: 'Не вдалося зберегти. Спробуйте ще раз.' }, { status: 500 });
        }

        await supabase.from('email_unsubscribes').insert({
            email: (subscriber as any).email,
            campaign_id: UUID_RE.test(campaignId) ? campaignId : null,
            source: token ? 'link_token' : 'link_email',
        });
    }

    return NextResponse.json({
        ok: true,
        alreadyInactive: already,
        email: (subscriber as any).email,
    });
}
