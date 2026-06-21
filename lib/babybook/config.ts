/**
 * Babybook (personalized children's AI story) — shared config & types.
 *
 * The generation engine (`animated-babybook`) runs separately on Railway and is
 * still being finished by another team. Until BABYBOOK_INTERNAL_KEY is set, the
 * engine integration is DISABLED: the intake/payment/admin scaffold all work,
 * and engine calls short-circuit with a clear "engine not configured" result
 * instead of throwing. Setting the two env vars flips it on with no code change.
 */

export const BABYBOOK = {
    /** Slug of the catalog product (created hidden, is_active=false). */
    productSlug: 'personalized-ai-story',
    /** Fixed print spec agreed with Diana. */
    pages: 18,
    spreads: 9,
    language: 'Ukrainian',
    /** Free designer revisions included before extra charges. */
    maxFreeRevisions: 2,
    /** Ordered generation stages. babybook_stage holds the current one. */
    stages: ['brief', 'character', 'story', 'images', 'spreads', 'proof', 'done'] as const,
} as const;

export type BabybookStage = typeof BABYBOOK.stages[number];

/** Two intake scenarios shown on the product page. */
export type BabybookScenario = 'self' | 'designer';

export function getEngineConfig() {
    const url = process.env.BABYBOOK_ENGINE_URL || '';
    const key = process.env.BABYBOOK_INTERNAL_KEY || '';
    return { url, key, enabled: Boolean(url && key) };
}

/** Per-stage status stored in design_briefs.babybook_stages (jsonb). */
export interface StageStatus {
    status: 'pending' | 'in_progress' | 'awaiting_approval' | 'approved' | 'error';
    at?: string;
    note?: string;
}

export type BabybookStages = Partial<Record<BabybookStage, StageStatus>>;
