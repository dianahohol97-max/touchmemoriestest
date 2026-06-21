import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import type { LeadBusinessType } from '@/lib/leads/offers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/ingest
 *
 * Receives B2B leads collected by the Make.com Google Places scenario.
 * Protected by a shared secret in the X-Leads-Key header (LEADS_INGEST_KEY).
 *
 * Accepts either a single lead object or { leads: [...] }. Dedupes on
 * google_place_id and email. Returns counts.
 *
 * Expected lead shape (all optional except business_name):
 *   { business_type, business_name, contact_name, email, phone, website,
 *     instagram, city, google_place_id, raw }
 */
const VALID_TYPES: LeadBusinessType[] = ['photographer', 'wedding_agency', 'travel_agency', 'corporate', 'other'];

export async function POST(request: Request) {
    // Auth: shared secret. Configure LEADS_INGEST_KEY in Vercel + Make.com.
    const key = request.headers.get('x-leads-key');
    const expected = process.env.LEADS_INGEST_KEY;
    if (!expected || key !== expected) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let payload: any;
    try { payload = await request.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const rawLeads: any[] = Array.isArray(payload?.leads)
        ? payload.leads
        : Array.isArray(payload) ? payload : [payload];

    if (rawLeads.length === 0 || rawLeads.length > 200) {
        return NextResponse.json({ error: 'leads must be 1–200 items' }, { status: 400 });
    }

    const admin = getAdminClient();
    let inserted = 0, skipped = 0;
    const errors: string[] = [];

    for (const l of rawLeads) {
        const businessName = String(l?.business_name || l?.name || '').trim();
        if (!businessName) { skipped++; continue; }

        const businessType: LeadBusinessType = VALID_TYPES.includes(l?.business_type)
            ? l.business_type : 'other';
        const email = l?.email ? String(l.email).trim().toLowerCase() : null;
        const placeId = l?.google_place_id ? String(l.google_place_id) : null;

        // Dedupe: skip if this place or email already exists.
        if (placeId) {
            const { data: dup } = await admin.from('leads').select('id').eq('google_place_id', placeId).maybeSingle();
            if (dup) { skipped++; continue; }
        }
        if (email) {
            const { data: dupE } = await admin.from('leads').select('id').ilike('email', email).maybeSingle();
            if (dupE) { skipped++; continue; }
        }

        const { error } = await admin.from('leads').insert({
            business_type: businessType,
            business_name: businessName.slice(0, 200),
            contact_name: l?.contact_name ? String(l.contact_name).slice(0, 120) : null,
            email,
            phone: l?.phone ? String(l.phone).slice(0, 50) : null,
            website: l?.website ? String(l.website).slice(0, 300) : null,
            instagram: l?.instagram ? String(l.instagram).slice(0, 200) : null,
            city: l?.city ? String(l.city).slice(0, 120) : null,
            source: 'google_places',
            google_place_id: placeId,
            raw: l?.raw ?? l ?? null,
            status: 'new',
        });
        if (error) { errors.push(error.message); skipped++; }
        else inserted++;
    }

    return NextResponse.json({ ok: true, inserted, skipped, errors: errors.slice(0, 5) });
}
