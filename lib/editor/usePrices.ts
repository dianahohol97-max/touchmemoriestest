'use client';

import { useEffect, useState } from 'react';
import type { PriceTable } from './pricing';

// Client-side cache for the photobook price matrix.
//
// Why this exists: the editor is a client component (force-dynamic + ssr:false
// at the route level), so it cannot receive prices from a Server Component.
// To avoid a "Завантаження..." flicker on the price label while the API
// responds, we cache the last-known table in localStorage and seed state
// with it on mount. We then revalidate from /api/pricing/photobook in the
// background; if anything changed, React re-renders with the fresh data.
//
// The server endpoint already has its own 60s revalidation, so this gives us
// two layers: ~zero perceived latency for repeat visitors, fresh data within
// 60s of any admin migration.

const STORAGE_KEY = 'tm.pricing.photobook.v1';
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — bound staleness for the very first paint

interface CachedTable {
    table: PriceTable;
    cached_at: number; // Date.now()
}

function readCache(): PriceTable | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedTable;
        if (!parsed || !parsed.table || !parsed.table.rows) return null;
        if (Date.now() - parsed.cached_at > STORAGE_TTL_MS) return null;
        return parsed.table;
    } catch {
        return null;
    }
}

function writeCache(table: PriceTable) {
    if (typeof window === 'undefined') return;
    try {
        const payload: CachedTable = { table, cached_at: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Quota exceeded or storage disabled — ignore. The hook still works,
        // just without the cache.
    }
}

export interface UsePhotobookPricesResult {
    table: PriceTable | null;
    loading: boolean;
    error: string | null;
}

export function usePhotobookPrices(): UsePhotobookPricesResult {
    const [table, setTable] = useState<PriceTable | null>(() => readCache());
    const [loading, setLoading] = useState<boolean>(() => readCache() === null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const res = await fetch('/api/pricing/photobook', {
                    // Allow the browser to serve from its own cache when it's fresh,
                    // but always re-check with the server. The server endpoint is
                    // already cached for 60s on Vercel's edge.
                    cache: 'default',
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data = (await res.json()) as PriceTable;
                if (cancelled) return;
                setTable(data);
                writeCache(data);
                setError(null);
            } catch (e: any) {
                if (cancelled) return;
                // Don't clobber an existing cached table on a network blip —
                // stale prices are better than no prices.
                setError(e?.message || 'failed to load prices');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    return { table, loading, error };
}
