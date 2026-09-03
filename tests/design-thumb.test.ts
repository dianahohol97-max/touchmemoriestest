import { describe, expect, it } from 'vitest';
import { designThumbPath } from '@/lib/editor/design-thumb';

/**
 * Мініатюра макета в кабінеті.
 *
 * Ціна помилки невелика, але вона є: неправильно обраний шлях означає картку з
 * чужим кадром, а це гірше за градієнт — дизайнер відкриє не ту чернетку саме
 * тому, що повірив картинці.
 */
const photos = [
    { id: 'p1', name: 'first.jpg', path: 'drafts/u/d/p1.jpg' },
    { id: 'p2', name: 'cover.jpg', path: 'drafts/u/d/p2.jpg' },
];

describe('designThumbPath', () => {
    it('prefers the photo that sits on the cover', () => {
        expect(designThumbPath({ photoId: 'p2' }, photos)).toBe('drafts/u/d/p2.jpg');
    });

    it('reads the cover photo out of a printed cover slot', () => {
        expect(designThumbPath({ printedPhotoSlots: [{ photoId: 'p2' }] }, photos)).toBe('drafts/u/d/p2.jpg');
    });

    it('falls back to the first uploaded photo when the cover has none', () => {
        expect(designThumbPath({}, photos)).toBe('drafts/u/d/p1.jpg');
        expect(designThumbPath(null, photos)).toBe('drafts/u/d/p1.jpg');
    });

    /** Кадр без шляху підписати нічим, тож він не годиться навіть як запасний. */
    it('skips photos with no storage path', () => {
        expect(designThumbPath({}, [{ id: 'p0', name: 'x.jpg' }, ...photos])).toBe('drafts/u/d/p1.jpg');
    });

    it('falls back again when the cover points at a photo that is gone', () => {
        expect(designThumbPath({ photoId: 'missing' }, photos)).toBe('drafts/u/d/p1.jpg');
    });

    it('returns null when there is nothing to show', () => {
        expect(designThumbPath({}, [])).toBeNull();
        expect(designThumbPath(null, null)).toBeNull();
        expect(designThumbPath({ photoId: 'p1' }, [{ id: 'p1', path: '' }])).toBeNull();
    });
});
