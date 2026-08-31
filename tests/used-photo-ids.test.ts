import { describe, expect, it } from 'vitest';
import { collectUsedPhotoIds } from '@/lib/editor/utils';

/**
 * Which photos count as "placed".
 *
 * The editor answered this two different ways: a memo that looked only at
 * pages/slots (desktop photo tray) and an inline expression that also looked
 * at free slots (mobile photo tray). A photo dropped into a free slot was
 * therefore "used" on mobile and "unused" on desktop — no green placed-badge,
 * and the «unused photos» counter beside the layout recommendations claimed it
 * still needed a home.
 *
 * The free-slot case below is the one that was broken. If it ever fails, the
 * two trays have gone out of step again.
 */

const page = (...photoIds: Array<string | null>) => ({
    slots: photoIds.map(photoId => ({ photoId })),
});

describe('collectUsedPhotoIds', () => {
    it('collects ids from template slots', () => {
        const ids = collectUsedPhotoIds([page('a', 'b'), page('c')], {});
        expect([...ids].sort()).toEqual(['a', 'b', 'c']);
    });

    it('counts a photo placed ONLY in a free slot', () => {
        // The regression: this used to come back empty on desktop.
        const ids = collectUsedPhotoIds([page(null)], { 0: [{ photoId: 'free-1' }] });
        expect(ids.has('free-1')).toBe(true);
    });

    it('merges both sources without double counting', () => {
        const ids = collectUsedPhotoIds(
            [page('a', null), page('b')],
            { 0: [{ photoId: 'a' }, { photoId: 'c' }], 1: [{ photoId: 'd' }] },
        );
        expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd']);
        expect(ids.size).toBe(4);
    });

    it('ignores empty slots', () => {
        const ids = collectUsedPhotoIds([page(null, null)], { 0: [{ photoId: null }] });
        expect(ids.size).toBe(0);
    });

    it('tolerates pages with no free slots at all', () => {
        expect(collectUsedPhotoIds([page('a')]).has('a')).toBe(true);
        expect(collectUsedPhotoIds([page('a')], {}).has('a')).toBe(true);
    });

    it('tolerates a missing or null entry for a page', () => {
        // freeSlots is keyed by page index and pages without any are absent.
        const ids = collectUsedPhotoIds([page('a')], { 0: undefined, 3: null, 5: [{ photoId: 'z' }] } as any);
        expect([...ids].sort()).toEqual(['a', 'z']);
    });

    it('returns an empty set for an empty book', () => {
        expect(collectUsedPhotoIds([], {}).size).toBe(0);
    });
});
