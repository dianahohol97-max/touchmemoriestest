import { getEngineConfig } from './config';

/**
 * Thin client for the animated-babybook engine internal API.
 *
 * Every call is gated by getEngineConfig().enabled. While the engine isn't
 * configured (no BABYBOOK_INTERNAL_KEY yet), calls return a structured
 * { ok: false, reason: 'engine_disabled' } instead of throwing — so the rest of
 * the product (intake, payment, admin) works end-to-end and the engine can be
 * switched on later by setting two env vars.
 *
 * Endpoint contract (base = BABYBOOK_ENGINE_URL), all with header X-Internal-Key:
 *   POST /internal/orders                      → { order_slug }
 *   POST /internal/orders/{slug}/photos        → upload character photos
 *   POST /internal/orders/{slug}/generate      → start generation
 *   GET  /internal/orders/{slug}/status        → { stage, story, spreads[], proof_url }
 *   POST /internal/orders/{slug}/regenerate?spread=N
 */

export type EngineResult<T = any> =
    | { ok: true; data: T }
    | { ok: false; reason: 'engine_disabled' | 'http_error' | 'network_error'; status?: number; detail?: string };

async function engineFetch<T = any>(path: string, init?: RequestInit): Promise<EngineResult<T>> {
    const { url, key, enabled } = getEngineConfig();
    if (!enabled) return { ok: false, reason: 'engine_disabled' };

    try {
        const res = await fetch(`${url}${path}`, {
            ...init,
            headers: {
                'X-Internal-Key': key,
                ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
                ...(init?.headers || {}),
            },
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            return { ok: false, reason: 'http_error', status: res.status, detail: detail.slice(0, 500) };
        }
        const data = (await res.json().catch(() => ({}))) as T;
        return { ok: true, data };
    } catch (e: any) {
        return { ok: false, reason: 'network_error', detail: e?.message };
    }
}

export interface CreateEngineOrderInput {
    child_name: string;
    age: number | string;
    gender: string;
    theme: string;
    language: string;
    personal_details?: string[];
    additional_characters?: Array<{ name?: string; appearance?: string }>;
}

export function createEngineOrder(input: CreateEngineOrderInput) {
    return engineFetch<{ order_slug: string }>('/internal/orders', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export function uploadEnginePhotos(slug: string, form: FormData) {
    return engineFetch<{ uploaded: number }>(`/internal/orders/${encodeURIComponent(slug)}/photos`, {
        method: 'POST',
        body: form,
    });
}

export function startEngineGeneration(slug: string, mode: 'full' | 'staged' = 'full') {
    return engineFetch<{ started: boolean }>(`/internal/orders/${encodeURIComponent(slug)}/generate`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
    });
}

export interface EngineStatus {
    stage: string;
    story?: any;
    spreads?: any[];
    proof_url?: string;
}

export function getEngineStatus(slug: string) {
    return engineFetch<EngineStatus>(`/internal/orders/${encodeURIComponent(slug)}/status`, {
        method: 'GET',
    });
}

export function regenerateEngineSpread(slug: string, spread: number) {
    return engineFetch<{ queued: boolean }>(
        `/internal/orders/${encodeURIComponent(slug)}/regenerate?spread=${encodeURIComponent(String(spread))}`,
        { method: 'POST' },
    );
}
