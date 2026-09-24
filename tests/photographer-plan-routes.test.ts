import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Правила тарифу на рівні МАРШРУТІВ, а не лише чистих функцій: безкоштовний
 * фотограф, який оминає кабінет і шле запит напряму, отримує відмову від
 * сервера (Diana, 2026-09-24). База й сховище підмінені, тож тест бачить, чи
 * дійшов запит до запису, а не лише код відповіді.
 */

type Row = Record<string, any>;
const state = {
    photographer: null as Row | null,
    gallery: null as Row | null,
    inserts: [] as { table: string; row: Row }[],
    updates: [] as { table: string; patch: Row }[],
    removed: [] as string[],
    presigned: [] as string[],
};

function fakeAdmin() {
    return {
        from(table: string) {
            let mode: 'select' | 'insert' | 'update' = 'select';
            const q: any = {
                select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, gt: () => q, is: () => q,
                insert: (row: Row) => { mode = 'insert'; state.inserts.push({ table, row }); return q; },
                update: (patch: Row) => { mode = 'update'; state.updates.push({ table, patch }); return q; },
                maybeSingle: async () => ({ data: table === 'photographer_galleries' ? state.gallery : null, error: null }),
                single: async () => ({ data: mode === 'insert' ? { id: 'new-row', ...state.inserts.at(-1)!.row } : null, error: null }),
                then: (resolve: any) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
            };
            return q;
        },
    };
}

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => fakeAdmin() }));
vi.mock('@/lib/photographers/helpers', async importOriginal => ({
    ...(await importOriginal<any>()),
    getPhotographerByToken: async (token: string) => (token === 'tok' ? state.photographer : null),
}));
vi.mock('@/lib/photographers/storage', () => ({
    presignUpload: async (path: string) => { state.presigned.push(path); return { url: 'https://signed', provider: 'r2' }; },
    fileExists: async () => ({ ok: true, size: 10_000_000 }),
    fileUrl: (path: string) => `https://files/${path}`,
    activeProvider: () => 'r2',
    removeFiles: async (files: { path: string }[]) => { state.removed.push(...files.map(f => f.path)); return null; },
}));
vi.mock('@/lib/photographers/usage', () => ({ checkQuota: async () => null }));
vi.mock('@/lib/photographers/storage-notice', () => ({ notifyStorageAfterUpload: async () => {} }));

const { POST: createGallery } = await import('@/app/api/photographers/galleries/route');
const { PATCH: patchGallery } = await import('@/app/api/photographers/galleries/[id]/route');
const { POST: videos } = await import('@/app/api/photographers/galleries/[id]/videos/route');

const FREE = { id: 'ph-1', plan: 'free', plan_expires_at: null };
const START = { id: 'ph-1', plan: 'start', plan_expires_at: '2099-01-01T00:00:00Z' };
const json = (url: string, body: Row, method = 'POST') =>
    new NextRequest(`http://localhost${url}`, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const params = { params: Promise.resolve({ id: 'g-1' }) };

beforeEach(() => {
    state.photographer = FREE;
    state.gallery = { id: 'g-1', photographer_id: 'ph-1', design: null, files_purged_at: null, expires_at: '2026-12-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z' };
    state.inserts = []; state.updates = []; state.removed = []; state.presigned = [];
});

describe('створення галереї', () => {
    it('безкоштовний тариф, 60 днів → 403 з поясненням, і нічого не записано', async () => {
        const res = await createGallery(json('/api/photographers/galleries', { token: 'tok', title: 'Весілля', term_days: 60 }));
        expect(res.status).toBe(403);
        expect((await res.json()).error).toContain('На безкоштовному тарифі галерея зберігається 30 днів');
        expect(state.inserts).toHaveLength(0);
    });

    it('безкоштовний тариф, 30 днів → створено', async () => {
        const res = await createGallery(json('/api/photographers/galleries', { token: 'tok', title: 'Весілля', term_days: 30 }));
        expect(res.status).toBe(200);
        expect(state.inserts).toHaveLength(1);
    });

    it('«Старт», 90 днів → створено', async () => {
        state.photographer = START;
        const res = await createGallery(json('/api/photographers/galleries', { token: 'tok', title: 'Весілля', term_days: 90 }));
        expect(res.status).toBe(200);
    });
});

describe('продовження', () => {
    it('нова галерея на безкоштовному тарифі → 403, термін не змінено', async () => {
        const res = await patchGallery(json('/api/photographers/galleries/g-1', { token: 'tok', extend_days: 30 }, 'PATCH'), params);
        expect(res.status).toBe(403);
        expect((await res.json()).error).toContain('без продовження');
        expect(state.updates).toHaveLength(0);
    });

    it('стара галерея на безкоштовному тарифі → продовжено, як і раніше', async () => {
        state.gallery!.created_at = '2026-09-06T15:31:31Z';
        state.gallery!.expires_at = new Date(Date.now() + 3 * 86_400_000).toISOString();
        const res = await patchGallery(json('/api/photographers/galleries/g-1', { token: 'tok', extend_days: 30 }, 'PATCH'), params);
        expect(res.status).toBe(200);
        expect(state.updates[0].patch.expires_at).toBeTruthy();
    });

    it('нова галерея на «Старті» → продовжено', async () => {
        state.photographer = START;
        state.gallery!.expires_at = new Date(Date.now() + 3 * 86_400_000).toISOString();
        const res = await patchGallery(json('/api/photographers/galleries/g-1', { token: 'tok', extend_days: 30 }, 'PATCH'), params);
        expect(res.status).toBe(200);
    });
});

describe('відео через sign/confirm', () => {
    const sign = (body: Row) => videos(json('/api/photographers/galleries/g-1/videos', { token: 'tok', stage: 'sign', size: 50_000_000, ...body }), params);

    it('безкоштовний тариф, video/mp4 → 403 до підписаного посилання', async () => {
        const res = await sign({ file_name: 'clip.mp4', content_type: 'video/mp4' });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.video_not_allowed).toBe(true);
        expect(body.error).toContain('від тарифу «Старт»');
        expect(state.presigned).toHaveLength(0);
    });

    it('безкоштовний тариф, відео під типом image/jpeg → теж 403 (за розширенням)', async () => {
        const res = await sign({ file_name: 'clip.MOV', content_type: 'image/jpeg' });
        expect(res.status).toBe(403);
        expect(state.presigned).toHaveLength(0);
    });

    it('безкоштовний тариф, фото → посилання видано, як і раніше', async () => {
        const res = await sign({ file_name: 'IMG_0001.jpg', content_type: 'image/jpeg' });
        expect(res.status).toBe(200);
        expect(state.presigned).toHaveLength(1);
    });

    it('«Старт», відео → посилання видано', async () => {
        state.photographer = START;
        const res = await sign({ file_name: 'clip.mp4', content_type: 'video/mp4' });
        expect(res.status).toBe(200);
    });

    it('confirm відео на безкоштовному тарифі → 403, файл стерто, рядка немає', async () => {
        const res = await videos(json('/api/photographers/galleries/g-1/videos', {
            token: 'tok', stage: 'confirm', path: 'ph-1/g-1/123_clip.mp4', file_name: 'clip.mp4', media_type: 'photo',
        }), params);
        expect(res.status).toBe(403);
        expect(state.removed).toEqual(['ph-1/g-1/123_clip.mp4']);
        expect(state.inserts).toHaveLength(0);
    });

    it('confirm фото на безкоштовному тарифі → рядок записано як photo', async () => {
        const res = await videos(json('/api/photographers/galleries/g-1/videos', {
            token: 'tok', stage: 'confirm', path: 'ph-1/g-1/123_a.jpg', file_name: 'a.jpg', media_type: 'photo',
        }), params);
        expect(res.status).toBe(200);
        expect(state.inserts[0].row.media_type).toBe('photo');
    });
});
