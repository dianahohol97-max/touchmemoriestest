import { describe, expect, it } from 'vitest';
import {
    shouldSendExpiryNotice, storageNoticeAction, shouldSendPurgeNotice,
    canEmailPhotographer, kyivDateParts, DEMO_PHOTOGRAPHER_EMAIL,
} from '@/lib/photographers/notice-rules';
import { sendExpiryNotices, sendPurgeNotices, handleStorageNotice, type SendFn } from '@/lib/photographers/notices';
import { expiryNoticeEmail, storageNoticeEmail, purgeNoticeEmail } from '@/lib/photographers/notice-emails';
import { cleanupExpiredGalleries } from '@/lib/photographers/gallery-cleanup';

/**
 * Листи фотографу про галереї: коли слати і що кожен лист іде рівно один
 * раз на подію (гоча 15).
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-10-03T03:30:00.000Z');
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe('shouldSendExpiryNotice', () => {
    const g = (left: number, extra: Partial<{ files_purged_at: string | null; expiry_notice_for: string | null }> = {}) => ({
        expires_at: at(left), files_purged_at: null, expiry_notice_for: null, ...extra,
    });

    it('за 4 дні до терміну — не слати', () => {
        expect(shouldSendExpiryNotice(g(4 * DAY), NOW)).toBe(false);
        expect(shouldSendExpiryNotice(g(5 * DAY), NOW)).toBe(false);
    });

    it('за 3 дні — слати', () => {
        expect(shouldSendExpiryNotice(g(3 * DAY), NOW)).toBe(true);
        expect(shouldSendExpiryNotice(g(2 * DAY), NOW)).toBe(true);
    });

    it('останній нічний прогін перед трьома добами шле лист, щоб фотограф мав щонайменше три доби', () => {
        // Галерея Ірини Владової: 06.10 15:31 UTC, прогін 03.10 03:30 UTC.
        const irina = { expires_at: '2026-10-06T15:31:31.312Z', files_purged_at: null, expiry_notice_for: null };
        expect(shouldSendExpiryNotice(irina, new Date('2026-10-02T03:30:00Z'))).toBe(false);
        expect(shouldSendExpiryNotice(irina, new Date('2026-10-03T03:30:00Z'))).toBe(true);
    });

    it('вже відправлено про цей термін — не слати', () => {
        const expires = at(2 * DAY);
        expect(shouldSendExpiryNotice({ expires_at: expires, files_purged_at: null, expiry_notice_for: expires }, NOW)).toBe(false);
    });

    it('продовжили після листа — знову можна, коли новий термін наблизиться', () => {
        const oldExpiry = at(2 * DAY);
        const extended = { expires_at: at(32 * DAY), files_purged_at: null, expiry_notice_for: oldExpiry };
        expect(shouldSendExpiryNotice(extended, NOW)).toBe(false);
        expect(shouldSendExpiryNotice(extended, new Date(NOW.getTime() + 29 * DAY + HOUR))).toBe(true);
    });

    it('галерея вже очищена або термін минув — не слати', () => {
        expect(shouldSendExpiryNotice(g(2 * DAY, { files_purged_at: at(-DAY) }), NOW)).toBe(false);
        expect(shouldSendExpiryNotice(g(-HOUR), NOW)).toBe(false);
    });
});

describe('storageNoticeAction', () => {
    const act = (before: number, after: number, sentAt: string | null) =>
        storageNoticeAction({ ratioBefore: before, ratioAfter: after, sentAt });
    const SENT = '2026-10-01T10:00:00Z';

    it('89% — ні', () => expect(act(0.88, 0.89, null)).toBe('none'));
    it('90% — так', () => expect(act(0.89, 0.9, null)).toBe('send'));
    it('повторно на 95% після листа — ні', () => expect(act(0.93, 0.95, SENT)).toBe('none'));
    it('звільнили кілька файлів і дозавантажили (не нижче 80%) — ні', () => {
        expect(act(0.85, 0.91, SENT)).toBe('none');
    });
    it('впало нижче 80% — позначка скидається', () => expect(act(0.5, 0.52, SENT)).toBe('rearm'));
    it('після скидання знову 90% — так', () => expect(act(0.89, 0.9, null)).toBe('send'));
    it('звільнили місце і один великий файл одразу підняв вище 90% — так', () => {
        expect(act(0.6, 0.93, SENT)).toBe('send');
    });
});

describe('shouldSendPurgeNotice', () => {
    it('очищення не вдалося (files_purged_at порожнє) — не слати', () => {
        expect(shouldSendPurgeNotice({ files_purged_at: null, purge_notice_sent_at: null }, NOW)).toBe(false);
    });
    it('очищено щойно — слати; вже надіслано — ні', () => {
        expect(shouldSendPurgeNotice({ files_purged_at: at(-HOUR), purge_notice_sent_at: null }, NOW)).toBe(true);
        expect(shouldSendPurgeNotice({ files_purged_at: at(-HOUR), purge_notice_sent_at: at(-HOUR / 2) }, NOW)).toBe(false);
    });
    it('давно очищені галереї ретроактивно листа не отримують', () => {
        expect(shouldSendPurgeNotice({ files_purged_at: '2026-09-04T03:30:36Z', purge_notice_sent_at: null }, NOW)).toBe(false);
    });
});

describe('canEmailPhotographer', () => {
    it('демо-кабінет, вимкнений кабінет і порожня пошта — ні', () => {
        expect(canEmailPhotographer({ email: DEMO_PHOTOGRAPHER_EMAIL, is_active: true })).toBe(false);
        expect(canEmailPhotographer({ email: 'a@b.com', is_active: false })).toBe(false);
        expect(canEmailPhotographer({ email: '', is_active: true })).toBe(false);
        expect(canEmailPhotographer({ email: 'a@b.com', is_active: true })).toBe(true);
    });
});

describe('тексти листів', () => {
    it('дата й час за Києвом', () => {
        expect(kyivDateParts('2026-10-06T15:31:31.312Z')).toEqual({ date: '6 жовтня 2026', time: '18:31' });
    });

    const IRINA_BYTES = 3_655_431_429;
    const FREE_QUOTA = 4 * 1024 ** 3;
    const mails = () => [
        expiryNoticeEmail({ galleryTitle: '<b>X</b>', expiresAt: '2026-10-06T15:31:31Z', cabinetToken: 't', variant: 'extend' }),
        storageNoticeEmail({ usedBytes: IRINA_BYTES, limitBytes: FREE_QUOTA, planName: 'Безкоштовно' }),
        purgeNoticeEmail({ galleryTitle: '<b>X</b>', purgedAt: '2026-10-07T03:30:00Z', cabinetToken: 't' }),
        expiryNoticeEmail({ galleryTitle: '<b>X</b>', expiresAt: '2026-10-06T15:31:31Z', cabinetToken: 't', variant: 'upgrade' }),
    ];
    const text = (html: string) => html.replace(/<[^>]+>/g, ' ');

    it('назва галереї екранується, а тексти не містять «успішно»', () => {
        for (const m of mails()) {
            expect(m.html).not.toContain('<b>X</b>');
            expect(m.html.toLowerCase()).not.toContain('успішно');
        }
        expect(mails()[0].html).toContain('/uk/photographer/cabinet/t');
        expect(mails()[2].html).toContain('/uk/photographer/cabinet/t');
        expect(mails()[1].html).toContain('/uk/photographers#tarify');
    });

    it('жодної незамінної заглушки у фігурних дужках — ні в темі, ні в тексті', () => {
        for (const m of mails()) {
            for (const part of [m.subject, text(m.html)]) {
                expect(part).not.toMatch(/[{}]/);
                expect(part).not.toMatch(/undefined|null|NaN|\$\{/);
            }
        }
    });

    it('звертання без імені в усіх листах', () => {
        for (const m of mails()) {
            expect(text(m.html)).toContain('Доброго дня!');
            expect(m.html).not.toMatch(/Доброго дня,/);
        }
    });

    it('зайняте і квота в одних одиницях: Ірина на 85% бачить 3,4 ГБ із 4 ГБ, а не 3,6', () => {
        expect(text(mails()[1].html)).toContain('3,4 ГБ із 4 ГБ');
        // Рівно 90% квоти в ГіБ — 3,6 ГБ із 4 ГБ.
        const at90 = storageNoticeEmail({ usedBytes: 0.9 * FREE_QUOTA, limitBytes: FREE_QUOTA, planName: 'Безкоштовно' });
        expect(text(at90.html)).toContain('3,6 ГБ із 4 ГБ');
    });

    it('лист «скоро згасне» обіцяє продовження лише у варіанті extend', () => {
        const [extend, , , upgrade] = mails();
        expect(text(extend.html)).toContain('термін зберігання можна продовжити в кабінеті');
        expect(extend.html).toContain('Відкрити кабінет');
        expect(text(upgrade.html)).not.toContain('можна продовжити в кабінеті');
        expect(text(upgrade.html)).toContain('Щоб зберігати галерею довше, оберіть платний тариф');
        // Тарифи в кабінеті, де їх оплачують, а не публічна сторінка з кнопкою на заявку.
        expect(upgrade.html).toContain('/uk/photographer/cabinet/t?plans=1#plans');
        expect(upgrade.html).toContain('Обрати тариф');
        expect(upgrade.subject).toBe(extend.subject);
    });

    it('у листі про місце немає рядка з посиланням на кабінет', () => {
        expect(mails()[1].html).not.toContain('/uk/photographer/cabinet/');
        expect(mails()[1].html).not.toContain('Змінити тариф можна в кабінеті');
    });
});

// ─── Фейковий PostgREST ──────────────────────────────────────────────────

type Row = Record<string, any>;

class FakeDb {
    tables: Record<string, Row[]> = {};
    from(table: string) {
        if (!this.tables[table]) this.tables[table] = [];
        return new FakeQuery(this, table);
    }
}

class FakeQuery {
    private filters: ((r: Row) => boolean)[] = [];
    private orders: { col: string; asc: boolean }[] = [];
    private rangeFrom: number | null = null;
    private rangeTo = 0;
    private limitN: number | null = null;
    private mode: 'select' | 'delete' | 'update' = 'select';
    private head = false;
    private single = false;
    private returning = false;
    private patch: Row = {};

    constructor(private db: FakeDb, private table: string) {}

    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (this.mode !== 'select') this.returning = true;
        this.head = !!opts?.head;
        return this;
    }
    delete() { this.mode = 'delete'; return this; }
    update(patch: Row) { this.mode = 'update'; this.patch = patch; return this; }
    eq(col: string, v: any) { this.filters.push(r => r[col] === v); return this; }
    in(col: string, vs: any[]) { const s = new Set(vs); this.filters.push(r => s.has(r[col])); return this; }
    gt(col: string, v: any) { this.filters.push(r => r[col] != null && r[col] > v); return this; }
    gte(col: string, v: any) { this.filters.push(r => r[col] != null && r[col] >= v); return this; }
    lt(col: string, v: any) { this.filters.push(r => r[col] != null && r[col] < v); return this; }
    is(col: string, v: any) { this.filters.push(r => (r[col] ?? null) === v); return this; }
    not(col: string, op: string, v: any) {
        if (op !== 'is') throw new Error('fake: only not.is');
        this.filters.push(r => (r[col] ?? null) !== v);
        return this;
    }
    or(expr: string) {
        const parts = expr.split(',').map(p => {
            const [col, op, ...rest] = p.split('.');
            const v = rest.join('.');
            if (op === 'is' && v === 'null') return (r: Row) => (r[col] ?? null) === null;
            if (op === 'lt') return (r: Row) => r[col] != null && r[col] < v;
            throw new Error(`fake: or ${p}`);
        });
        this.filters.push(r => parts.some(f => f(r)));
        return this;
    }
    order(col: string, o?: { ascending?: boolean }) { this.orders.push({ col, asc: o?.ascending !== false }); return this; }
    range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
    limit(n: number) { this.limitN = n; return this; }
    maybeSingle() { this.single = true; return this; }

    then(resolve: (v: any) => any, reject?: (e: any) => any) {
        return Promise.resolve().then(() => this.run()).then(resolve, reject);
    }

    private run() {
        const all = this.db.tables[this.table];
        const match = all.filter(r => this.filters.every(f => f(r)));
        if (this.mode === 'delete') {
            this.db.tables[this.table] = all.filter(r => !match.includes(r));
            return { data: null, error: null };
        }
        if (this.mode === 'update') {
            for (const r of match) Object.assign(r, this.patch);
            return { data: this.returning ? match.map(r => ({ ...r })) : null, error: null };
        }
        if (this.head) return { data: null, count: match.length, error: null };
        const sorted = [...match].sort((a, b) => {
            for (const o of this.orders) {
                if (a[o.col] < b[o.col]) return o.asc ? -1 : 1;
                if (a[o.col] > b[o.col]) return o.asc ? 1 : -1;
            }
            return 0;
        });
        let out = sorted;
        if (this.rangeFrom !== null) out = out.slice(this.rangeFrom, this.rangeTo + 1);
        if (this.limitN !== null) out = out.slice(0, this.limitN);
        out = out.slice(0, 1000);
        if (this.single) return { data: out[0] ?? null, error: null };
        return { data: out, error: null };
    }
}

function recorder(result: 'ok' | 'fail' | 'throw' = 'ok') {
    const calls: { to: string; subject: string; template: string; html: string }[] = [];
    const send: SendFn = async (params, meta) => {
        calls.push({ to: params.to, subject: params.subject, template: meta.template, html: params.html });
        if (result === 'throw') throw new Error('Brevo впав');
        return result === 'ok'
            ? { sent: true, providerMessageId: 'm-1', error: null, failureKind: null }
            : { sent: false, providerMessageId: null, error: 'відмова', failureKind: 'provider' };
    };
    return { calls, send };
}

const PH = { id: 'ph-1', name: 'Ірина Владова', email: 'irina@example.com', is_active: true, cabinet_token: 'tok-1' };

function seed(galleries: Row[], photographer: Row = PH) {
    const db = new FakeDb();
    db.tables.photographers = [{ storage_notice_sent_at: null, storage_notice_pending_at: null, ...photographer }];
    db.tables.photographer_galleries = galleries.map(g => ({
        photographer_id: photographer.id, title: 'Вінчання', files_purged_at: null,
        expiry_notice_for: null, expiry_notice_sent_at: null, purge_notice_sent_at: null, ...g,
    }));
    db.tables.photographer_gallery_photos = [];
    return db;
}

describe('sendExpiryNotices', () => {
    it('шле один раз на термін і після продовження шле знову', async () => {
        const db = seed([{ id: 'g-1', expires_at: at(3 * DAY) }]);
        const r = recorder();
        const first = await sendExpiryNotices({ db, send: r.send, now: () => NOW });
        expect(first).toMatchObject({ candidates: 1, sent: 1 });
        expect(r.calls[0]).toMatchObject({ to: 'irina@example.com', template: 'photographer_gallery_expiring' });

        const again = await sendExpiryNotices({ db, send: r.send, now: () => new Date(NOW.getTime() + DAY) });
        expect(again.sent).toBe(0);
        expect(r.calls).toHaveLength(1);

        // Продовжили на 30 днів — наступний лист лише перед новим терміном.
        db.tables.photographer_galleries[0].expires_at = at(33 * DAY);
        expect((await sendExpiryNotices({ db, send: r.send, now: () => new Date(NOW.getTime() + 2 * DAY) })).sent).toBe(0);
        expect((await sendExpiryNotices({ db, send: r.send, now: () => new Date(NOW.getTime() + 30 * DAY) })).sent).toBe(1);
        expect(r.calls).toHaveLength(2);
    });

    it('відмова Brevo не ставить позначку, лист піде наступної ночі', async () => {
        const db = seed([{ id: 'g-1', expires_at: at(3 * DAY) }]);
        const fail = recorder('fail');
        expect(await sendExpiryNotices({ db, send: fail.send, now: () => NOW })).toMatchObject({ sent: 0, failed: 1 });
        expect(db.tables.photographer_galleries[0].expiry_notice_for).toBeNull();

        const boom = recorder('throw');
        expect(await sendExpiryNotices({ db, send: boom.send, now: () => NOW })).toMatchObject({ failed: 1 });

        const ok = recorder();
        expect((await sendExpiryNotices({ db, send: ok.send, now: () => new Date(NOW.getTime() + DAY) })).sent).toBe(1);
    });

    it('варіант листа — за тарифом і датою створення галереї, як і сам PATCH', async () => {
        const OLD = '2026-09-06T15:31:31.312Z';   // галерея Ірини: старі правила
        const NEW = '2026-10-01T10:00:00.000Z';   // після межі нових правил
        const cases: { created: string; photographer: Row; variant: 'extend' | 'upgrade' }[] = [
            { created: OLD, photographer: PH, variant: 'extend' },
            { created: NEW, photographer: PH, variant: 'upgrade' },
            // Оплачений тариф, який уже скінчився, — це безкоштовний. Дата в
            // минулому відносно справжнього годинника: effectivePlanId, як і
            // маршрути, дивиться на Date.now(), а не на годинник крону.
            { created: NEW, photographer: { ...PH, plan: 'studio', plan_expires_at: '2026-09-01T00:00:00.000Z' }, variant: 'upgrade' },
            { created: NEW, photographer: { ...PH, plan: 'start', plan_expires_at: '2099-01-01T00:00:00.000Z' }, variant: 'extend' },
        ];
        for (const c of cases) {
            const db = seed([{ id: 'g-1', created_at: c.created, expires_at: at(3 * DAY) }], c.photographer);
            const r = recorder();
            expect((await sendExpiryNotices({ db, send: r.send, now: () => NOW })).sent).toBe(1);
            const extendText = r.calls[0].html.includes('можна продовжити в кабінеті');
            expect(extendText, `${c.created} ${c.photographer.plan ?? 'free'}`).toBe(c.variant === 'extend');
        }
    });

    it('демо-кабінет листа не отримує', async () => {
        const db = seed([{ id: 'g-1', expires_at: at(DAY) }], { ...PH, email: DEMO_PHOTOGRAPHER_EMAIL });
        const r = recorder();
        expect(await sendExpiryNotices({ db, send: r.send, now: () => NOW })).toMatchObject({ skipped: 1, sent: 0 });
        expect(r.calls).toHaveLength(0);
    });
});

describe('sendPurgeNotices після очищення', () => {
    const expired = at(-HOUR);

    it('очищення не вдалося — лист (в) не йде', async () => {
        const db = seed([{ id: 'g-1', expires_at: expired }]);
        db.tables.photographer_gallery_photos = [{ id: 'p-1', gallery_id: 'g-1', storage_path: 'ph-1/g-1/a.jpg', storage_provider: 'r2', created_at: expired }];
        await cleanupExpiredGalleries({ db, removeFiles: async () => 'R2 не налаштовано', now: () => NOW });
        const r = recorder();
        const report = await sendPurgeNotices({ db, send: r.send, now: () => NOW });
        expect(db.tables.photographer_galleries[0].files_purged_at).toBeNull();
        expect(report.candidates).toBe(0);
        expect(r.calls).toHaveLength(0);
    });

    it('очищення вдалося — лист іде один раз', async () => {
        const db = seed([{ id: 'g-1', expires_at: expired }]);
        db.tables.photographer_gallery_photos = [{ id: 'p-1', gallery_id: 'g-1', storage_path: 'ph-1/g-1/a.jpg', storage_provider: 'r2', created_at: expired }];
        await cleanupExpiredGalleries({ db, removeFiles: async () => null, now: () => NOW });
        const r = recorder();
        expect((await sendPurgeNotices({ db, send: r.send, now: () => NOW })).sent).toBe(1);
        expect(r.calls[0].template).toBe('photographer_gallery_purged');
        expect((await sendPurgeNotices({ db, send: r.send, now: () => new Date(NOW.getTime() + DAY) })).sent).toBe(0);
        expect(r.calls).toHaveLength(1);
    });
});

describe('handleStorageNotice', () => {
    const GB = 1024 ** 3;
    const usage = (usedGb: number) => ({ usedBytes: usedGb * GB, limitBytes: 10 * GB, planName: 'Безкоштовно' });
    const run = (db: FakeDb, send: SendFn, usedGb: number, uploadedGb: number) =>
        handleStorageNotice({ db, send, now: () => NOW, photographerId: 'ph-1', usage: usage(usedGb), uploadedBytes: uploadedGb * GB });

    it('89% → ні; 90% → так; 95% → ні; нижче 80% і знову 90% → так', async () => {
        const db = seed([]);
        const r = recorder();
        expect(await run(db, r.send, 8.9, 0.1)).toBe('none');
        expect(await run(db, r.send, 9.0, 0.1)).toBe('sent');
        expect(await run(db, r.send, 9.5, 0.5)).toBe('none');
        expect(await run(db, r.send, 7.5, 0.1)).toBe('rearmed');
        expect(await run(db, r.send, 9.0, 1.5)).toBe('sent');
        expect(r.calls).toHaveLength(2);
    });

    it('відмова пошти лишає лист можливим і знімає бронь', async () => {
        const db = seed([]);
        expect(await run(db, recorder('fail').send, 9.2, 0.1)).toBe('failed');
        expect(db.tables.photographers[0]).toMatchObject({ storage_notice_sent_at: null, storage_notice_pending_at: null });
        expect(await run(db, recorder().send, 9.3, 0.1)).toBe('sent');
    });

    it('два паралельні аплоади шлють один лист', async () => {
        const db = seed([]);
        const r = recorder();
        const results = await Promise.all([run(db, r.send, 9.1, 0.1), run(db, r.send, 9.2, 0.1)]);
        expect(results.filter(x => x === 'sent')).toHaveLength(1);
        expect(r.calls).toHaveLength(1);
    });
});
