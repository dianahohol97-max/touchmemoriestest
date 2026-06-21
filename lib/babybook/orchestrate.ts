import type { SupabaseClient } from '@supabase/supabase-js';
import { getEngineConfig } from './config';
import { createEngineOrder, startEngineGeneration } from './engineClient';

/**
 * Kick off story generation after an order is paid.
 *
 * Safe no-op until the engine is configured (BABYBOOK_INTERNAL_KEY). For the
 * 'self' scenario we start full generation immediately; for 'designer' we only
 * create the engine order (the designer drives stages from the cabin).
 *
 * Idempotent: if design_briefs already has a babybook_order_slug, we skip
 * creating a second engine order.
 */
export async function startBabybookForPaidOrder(
    admin: SupabaseClient,
    orderId: string,
): Promise<void> {
    // Is this a babybook order?
    const { data: brief } = await admin
        .from('babybook_briefs')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
    if (!brief) return; // not a babybook order

    const { data: db } = await admin
        .from('design_briefs')
        .select('id, babybook_order_slug')
        .eq('order_id', orderId)
        .maybeSingle();

    // Mark the brief as paid/generating regardless of engine availability, so
    // the admin dashboard reflects reality.
    await admin.from('babybook_briefs')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('order_id', orderId);

    const engine = getEngineConfig();
    if (!engine.enabled) {
        // Engine not wired yet — stop here. Generation will be started manually
        // (or by a backfill) once BABYBOOK_INTERNAL_KEY is configured.
        return;
    }

    // Don't double-create an engine order.
    if (db?.babybook_order_slug) return;

    const created = await createEngineOrder({
        child_name: brief.child_name,
        age: brief.child_age || '',
        gender: brief.child_gender || '',
        theme: brief.theme || '',
        language: brief.language || 'Ukrainian',
        personal_details: Array.isArray(brief.personal_details) ? brief.personal_details : [],
        additional_characters: Array.isArray(brief.additional_characters) ? brief.additional_characters : [],
    });
    if (!created.ok) {
        console.error('babybook: engine order creation failed', created);
        return;
    }

    const slug = created.data.order_slug;

    // Persist the engine slug on both tables.
    await admin.from('babybook_briefs').update({ engine_order_slug: slug }).eq('order_id', orderId);
    if (db?.id) {
        await admin.from('design_briefs')
            .update({ babybook_order_slug: slug, babybook_stage: 'character' })
            .eq('id', db.id);
    }

    // 'self' → start full generation now. 'designer' → leave for the cabin.
    if (brief.scenario === 'self') {
        await startEngineGeneration(slug, 'full');
    }
}
