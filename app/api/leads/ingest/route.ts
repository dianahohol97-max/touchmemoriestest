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

    // Normalise first, with no I/O. Anything without a business name is not a
    // lead; deduping the batch against ITSELF here matters because one
    // Make.com run regularly returns the same place twice, and a bulk insert
    // would otherwise trip its own unique index.
    const seenPlace = new Set<string>();
    const seenEmail = new Set<string>();
    const candidates: Array<Record<string, any>> = [];
    let skipped = 0;

    for (const l of rawLeads) {
        const businessName = String(l?.business_name || l?.name || '').trim();
        if (!businessName) { skipped++; continue; }

        const email = l?.email ? String(l.email).trim().toLowerCase() : null;
        const placeId = l?.google_place_id ? String(l.google_place_id) : null;

        if (placeId && seenPlace.has(placeId)) { skipped++; continue; }
        if (email && seenEmail.has(email)) { skipped++; continue; }
        if (placeId) seenPlace.add(placeId);
        if (email) seenEmail.add(email);

        candidates.push({
            business_type: VALID_TYPES.includes(l?.business_type) ? l.business_type : 'other',
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
    }

    if (candidates.length === 0) {
        return NextResponse.json({ ok: true, inserted: 0, skipped, errors: [] });
    }

    // Two set lookups for the whole batch, replacing two per-lead round-trips.
    // The old loop ran a SELECT on google_place_id, a SELECT on email and an
    // INSERT for every lead — up to 600 sequential round-trips for a 200-lead
    // request, on a platform with a function timeout.
    //
    // `.in()` is case-sensitive where the old `.ilike()` was not. That is safe
    // because every writer normalises email to lower case before insert (this
    // route and /api/admin/leads both do, and all 593 existing rows are lower
    // case). The `lower(email)` unique index is the backstop if that ever
    // stops being true: a mixed-case duplicate fails with 23505 and is counted
    // as skipped by the fallback below, rather than being written twice.
    const placeIds = candidates.map(c => c.google_place_id).filter(Boolean) as string[];
    const emails = candidates.map(c => c.email).filter(Boolean) as string[];

    const [existingPlaces, existingEmails] = await Promise.all([
        placeIds.length
            ? admin.from('leads').select('google_place_id').in('google_place_id', placeIds)
            : Promise.resolve({ data: [] as any[] }),
        emails.length
            ? admin.from('leads').select('email').in('email', emails)
            : Promise.resolve({ data: [] as any[] }),
    ]);

    const knownPlaces = new Set((existingPlaces.data || []).map((r: any) => r.google_place_id));
    const knownEmails = new Set(
        (existingEmails.data || []).map((r: any) => String(r.email || '').toLowerCase()),
    );

    const fresh = candidates.filter(c => {
        if (c.google_place_id && knownPlaces.has(c.google_place_id)) return false;
        if (c.email && knownEmails.has(c.email)) return false;
        return true;
    });
    skipped += candidates.length - fresh.length;

    if (fresh.length === 0) {
        return NextResponse.json({ ok: true, inserted: 0, skipped, errors: [] });
    }

    // One insert for the batch. The lookup above is still check-then-insert, so
    // a concurrent ingest can slip a row in between — that race is now closed
    // by the unique indexes in
    // supabase/migrations/20260831_leads_dedupe_unique_indexes.sql, which make
    // the loser fail with 23505 instead of writing a duplicate. On that (rare)
    // collision fall back to inserting row by row so one contested lead does
    // not cost the whole batch.
    const errors: string[] = [];
    let inserted = 0;

    const { data: bulk, error: bulkError } = await admin.from('leads').insert(fresh).select('id');
    if (!bulkError) {
        inserted = bulk?.length ?? fresh.length;
    } else if (bulkError.code === '23505') {
        for (const row of fresh) {
            const { error } = await admin.from('leads').insert(row);
            if (!error) inserted++;
            else if (error.code === '23505') skipped++;      // lost the race — already there
            else { errors.push(error.message); skipped++; }
        }
    } else {
        console.error('leads/ingest: bulk insert failed', bulkError.message);
        return NextResponse.json({ error: 'insert_failed', detail: bulkError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inserted, skipped, errors: errors.slice(0, 5) });
}
