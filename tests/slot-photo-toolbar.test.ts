import { describe, expect, it } from 'vitest';
import { zoomAfterRotate } from '@/components/editor/SlotPhotoToolbar';

/**
 * Rotation auto-zoom, pinned.
 *
 * When a slot's photo is turned 90° or 270° the image's aspect ratio is now
 * across the slot's other axis, so at zoom 1 it no longer covers the slot —
 * a 4:3 photo in a 4:3 slot leaves bars and reads as the photo "flying out"
 * of its frame. Commit 5f8fb96 fixed that by re-zooming to the larger of the
 * two axis ratios. This test exists because the toolbar was duplicated when
 * that fix landed, and the copy that received it kept the code while losing
 * the comment explaining it — precisely the shape of thing that gets
 * "simplified" away later.
 *
 * 0° and 180° keep the photo on its original axes, so they reset to 1.
 */
describe('zoomAfterRotate', () => {
    it('does not zoom for upright or upside-down photos', () => {
        expect(zoomAfterRotate(0, { width: 400, height: 300 })).toBe(1);
        expect(zoomAfterRotate(180, { width: 400, height: 300 })).toBe(1);
    });

    it('zooms a quarter turn by the slot aspect ratio', () => {
        // 4:3 slot → a quarter turn needs 4/3 to keep covering.
        expect(zoomAfterRotate(90, { width: 400, height: 300 })).toBeCloseTo(4 / 3, 10);
        expect(zoomAfterRotate(270, { width: 400, height: 300 })).toBeCloseTo(4 / 3, 10);
    });

    it('uses the larger ratio regardless of slot orientation', () => {
        // Portrait slot must give the same factor as its landscape mirror.
        expect(zoomAfterRotate(90, { width: 300, height: 400 })).toBeCloseTo(4 / 3, 10);
    });

    it('is a no-op factor for a square slot', () => {
        expect(zoomAfterRotate(90, { width: 350, height: 350 })).toBe(1);
    });

    it('falls back to 100px when a dimension is missing or unmeasured', () => {
        // slotStyle values can be undefined before layout settles; the original
        // code used `Number(...) || 100` and this keeps that behaviour.
        expect(zoomAfterRotate(90, { width: 0, height: 0 })).toBe(1);
        expect(zoomAfterRotate(90, { width: NaN, height: 200 })).toBe(2);
    });
});
