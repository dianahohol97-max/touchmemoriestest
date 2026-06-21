'use client';

import { useEffect, useState } from 'react';

export interface B2bMe {
    isB2b: boolean;
    role: string | null;
    status: string | null;
    discountPercent: number;
    categorySlugs: string[];
    label: string | null;
}

const EMPTY: B2bMe = { isB2b: false, role: null, status: null, discountPercent: 0, categorySlugs: [], label: null };

// Module-level cache so we only hit /api/b2b/me once per page session.
let cache: B2bMe | null = null;
let inflight: Promise<B2bMe> | null = null;

async function fetchMe(): Promise<B2bMe> {
    if (cache) return cache;
    if (inflight) return inflight;
    inflight = fetch('/api/b2b/me', { credentials: 'include' })
        .then(r => r.ok ? r.json() : EMPTY)
        .then((d: B2bMe) => { cache = d; inflight = null; return d; })
        .catch(() => { inflight = null; return EMPTY; });
    return inflight;
}

export function useB2b() {
    const [me, setMe] = useState<B2bMe>(cache ?? EMPTY);

    useEffect(() => {
        let alive = true;
        fetchMe().then(d => { if (alive) setMe(d); });
        return () => { alive = false; };
    }, []);

    /** Discount % for a given category slug (0 if none / not B2B). */
    const discountFor = (categorySlug?: string | null): number => {
        if (!me.isB2b || !categorySlug) return 0;
        return me.categorySlugs.includes(categorySlug) ? me.discountPercent : 0;
    };

    /** Apply discount to a price, rounded to whole UAH. */
    const priceFor = (basePrice: number, categorySlug?: string | null): number => {
        const pct = discountFor(categorySlug);
        if (!pct) return basePrice;
        return Math.round(basePrice * (1 - pct / 100));
    };

    return { ...me, discountFor, priceFor };
}
