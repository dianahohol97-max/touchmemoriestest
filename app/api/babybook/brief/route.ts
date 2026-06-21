import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { BABYBOOK, type BabybookScenario } from '@/lib/babybook/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/babybook/brief
 *
 * Saves the personalized-story intake for an order (both scenarios). Called
 * after the order is created (so we have order_id). For the designer scenario
 * it flags the order with_designer so it lands in the designer queue.
 *
 * Generation itself is NOT triggered here — that happens after payment
 * (webhook) and, for the engine, only once BABYBOOK_INTERNAL_KEY is set.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const orderId = String(body?.order_id || '').trim();
        const scenario: BabybookScenario = body?.scenario === 'designer' ? 'designer' : 'self';

        const childName = String(body?.child_name || '').trim();
        if (!orderId) return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
        if (!childName || childName.length > 100) {
            return NextResponse.json({ error: 'Вкажіть імʼя дитини' }, { status: 400 });
        }

        const childAge = body?.child_age ? String(body.child_age).slice(0, 40) : null;
        const childGender = ['boy', 'girl', 'other'].includes(body?.child_gender) ? body.child_gender : null;
        const theme = body?.theme ? String(body.theme).slice(0, 500) : null;
        const dedication = body?.dedication ? String(body.dedication).slice(0, 500) : null;

        // personal_details: array of short strings
        const personalDetails = Array.isArray(body?.personal_details)
            ? body.personal_details.map((d: any) => String(d).slice(0, 300)).slice(0, 20)
            : [];

        // additional_characters: [{ name, appearance, photo_path }]
        const additionalCharacters = Array.isArray(body?.additional_characters)
            ? body.additional_characters.slice(0, 5).map((c: any) => ({
                name: c?.name ? String(c.name).slice(0, 100) : '',
                appearance: c?.appearance ? String(c.appearance).slice(0, 500) : '',
                photo_path: c?.photo_path ? String(c.photo_path).slice(0, 500) : null,
            }))
            : [];

        // child_photos: array of storage paths (1–3)
        const childPhotos = Array.isArray(body?.child_photos)
            ? body.child_photos.map((p: any) => String(p).slice(0, 500)).slice(0, 3)
            : [];

        const admin = getAdminClient();

        // Verify the order exists.
        const { data: order } = await admin
            .from('orders')
            .select('id, with_designer')
            .eq('id', orderId)
            .maybeSingle();
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        // Upsert the babybook brief (one per order).
        const { error: briefErr } = await admin
            .from('babybook_briefs')
            .upsert({
                order_id: orderId,
                scenario,
                child_name: childName,
                child_age: childAge,
                child_gender: childGender,
                theme,
                language: BABYBOOK.language,
                dedication,
                personal_details: personalDetails,
                additional_characters: additionalCharacters,
                child_photos: childPhotos,
                status: 'submitted',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'order_id' });

        if (briefErr) {
            console.error('babybook/brief upsert error:', briefErr);
            return NextResponse.json({ error: 'Не вдалося зберегти анкету' }, { status: 500 });
        }

        // Initialize generation tracking on design_briefs (Part 0 columns). We
        // create/locate a design_briefs row for this order so the designer
        // dashboard and webhook share one place for stage tracking.
        const initialStages = { brief: { status: 'approved', at: new Date().toISOString() } };
        const { data: existingDb } = await admin
            .from('design_briefs')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle();
        if (existingDb) {
            await admin.from('design_briefs')
                .update({ babybook_stage: 'brief', babybook_stages: initialStages })
                .eq('id', existingDb.id);
        } else {
            await admin.from('design_briefs').insert({
                order_id: orderId,
                occasion: 'Персоналізована казка',
                babybook_stage: 'brief',
                babybook_stages: initialStages,
                status: 'waiting_brief',
            });
        }

        // Designer scenario → flag the order so it enters the designer queue.
        if (scenario === 'designer' && !order.with_designer) {
            await admin.from('orders').update({ with_designer: true }).eq('id', orderId);
        }

        return NextResponse.json({ ok: true, scenario });
    } catch (err: any) {
        console.error('babybook/brief error:', err);
        return NextResponse.json({ error: err?.message || 'Помилка' }, { status: 500 });
    }
}
