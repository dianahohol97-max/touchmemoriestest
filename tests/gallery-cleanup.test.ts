import { describe, expect, it } from 'vitest';
import { cleanupExpiredGalleries, purgeGallery } from '@/lib/photographers/gallery-cleanup';
import { readAllGalleryPhotos, readGalleryPhotoRows } from '@/lib/photographers/gallery-photos';
import { removeFilesWith, type RemoveFilesDeps } from '@/lib/photographers/remove-files';

/**
 * Очищення галерей фотографів.
 *
 * Дефект, через який це зʼявилося: крон читав фото галереї одним запитом без
 * пагінації (PostgREST віддає щонайбільше тисячу рядків), стирав зі сховища
 * лише їх, а тоді видаляв з бази ВСІ рядки галереї і ставив files_purged_at.
 * У галереї на 2000 файлів друга тисяча назавжди лишалася в R2 без рядка.
 *
 * Фейковий клієнт нижче поводиться як справжній PostgREST у тому, що тут
 * важливо: відповідь без .range() обрізається до тисячі рядків мовчки, а
 * .range() віддає рівно запитаний зріз.
 */

const PGRST_MAX = 1000;

type Row = Record<string, any>;

class FakeDb {
  tables: Record<string, Row[]> = {};
  /** Called after every delete — lets a test slip a row in mid-purge. */
  onDelete?: (db: FakeDb) => void;
  deleteCalls = 0;
  unboundedReads = 0;

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
  private patch: Row = {};

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) { this.head = !!opts?.head; return this; }
  delete() { this.mode = 'delete'; return this; }
  update(patch: Row) { this.mode = 'update'; this.patch = patch; return this; }
  eq(col: string, v: any) { this.filters.push(r => r[col] === v); return this; }
  in(col: string, vs: any[]) { const s = new Set(vs); this.filters.push(r => s.has(r[col])); return this; }
  gt(col: string, v: any) { this.filters.push(r => (r[col] ?? 0) > v); return this; }
  lt(col: string, v: any) { this.filters.push(r => r[col] < v); return this; }
  is(col: string, v: any) { this.filters.push(r => (r[col] ?? null) === v); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orders.push({ col, asc: o?.ascending !== false }); return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  limit(n: number) { this.limitN = n; return this; }

  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    return Promise.resolve().then(() => this.run()).then(resolve, reject);
  }

  private run() {
    const all = this.db.tables[this.table];
    const match = all.filter(r => this.filters.every(f => f(r)));
    if (this.mode === 'delete') {
      this.db.tables[this.table] = all.filter(r => !match.includes(r));
      this.db.deleteCalls++;
      this.db.onDelete?.(this.db);
      return { data: null, error: null };
    }
    if (this.mode === 'update') {
      for (const r of match) Object.assign(r, this.patch);
      return { data: null, error: null };
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
    if (this.rangeFrom === null && this.limitN === null) this.db.unboundedReads++;
    // The PostgREST server cap: silent, no error.
    return { data: out.slice(0, PGRST_MAX), error: null };
  }
}

const GALLERY = 'g-1';
const EXPIRED = '2026-01-01T00:00:00.000Z';

function seed(photoCount: number, opts: { sameTimestamp?: boolean } = {}) {
  const db = new FakeDb();
  db.tables.photographer_galleries = [{ id: GALLERY, expires_at: EXPIRED, files_purged_at: null }];
  db.tables.photographer_gallery_photos = Array.from({ length: photoCount }, (_, i) => ({
    id: `p-${String(i).padStart(5, '0')}`,
    gallery_id: GALLERY,
    storage_path: `ph-1/${GALLERY}/${i}.jpg`,
    storage_provider: 'r2',
    // A batch upload writes many rows within one millisecond.
    created_at: opts.sameTimestamp ? '2026-01-01T00:00:00.000Z' : new Date(Date.UTC(2026, 0, 1) + i).toISOString(),
    favorite: i % 3 === 0,
  }));
  return db;
}

const gallery = (db: FakeDb) => db.tables.photographer_galleries[0];
const photoRows = (db: FakeDb) => db.tables.photographer_gallery_photos;

describe('readAllGalleryPhotos', () => {
  it('читає всі 2000 рядків попри мовчазну межу в тисячу', async () => {
    const db = seed(2000);
    const { rows, error } = await readAllGalleryPhotos(db, GALLERY, 'id');
    expect(error).toBeNull();
    expect(rows).toHaveLength(2000);
    expect(new Set(rows.map((r: any) => r.id)).size).toBe(2000);
  });

  it('однаковий created_at не губить і не дублює рядки на стику сторінок', async () => {
    const db = seed(1500, { sameTimestamp: true });
    const { rows } = await readAllGalleryPhotos(db, GALLERY, 'id');
    expect(new Set(rows.map((r: any) => r.id)).size).toBe(1500);
  });

  it('клієнт, що ігнорує .range(), дає помилку, а не нескінченний цикл', async () => {
    let calls = 0;
    const endless = {
      from: () => {
        const q: any = {
          select: () => q, eq: () => q, order: () => q, range: () => q,
          then: (res: any) => { calls++; return Promise.resolve({ data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null }).then(res); },
        };
        return q;
      },
    };
    const { rows, error } = await readAllGalleryPhotos(endless, GALLERY, 'id');
    expect(error).toMatch(/перевищило 10 сторінок/);
    expect(rows).toEqual([]);
    expect(calls).toBe(10);
  });

  it('2000 фото вкладаються в ліміт; тісніший ліміт спрацьовує як помилка', async () => {
    const db = seed(2000);
    const { error } = await readAllGalleryPhotos(db, GALLERY, 'id');
    expect(error).toBeNull();
    // 2 full pages + 1 empty confirmation page = 3, far under the fuse.
    const { error: tight } = await readGalleryPhotoRows(db, 'id', q => q.eq('gallery_id', GALLERY), 2);
    expect(tight).toMatch(/перевищило 2 сторінок/);
  });

  it('фільтр по кількох галереях теж іде сторінками', async () => {
    const db = seed(1500);
    const { rows } = await readGalleryPhotoRows(db, 'id', q => q.in('gallery_id', [GALLERY]).eq('favorite', true));
    expect(rows).toHaveLength(500);
  });
});

describe('purgeGallery', () => {
  it('галерея з 1500 фото: removeFiles отримує всі 1500 ключів, рядків 0, позначка стоїть', async () => {
    const db = seed(1500);
    const seen: string[] = [];
    const report = await cleanupExpiredGalleries({
      db,
      removeFiles: async files => { seen.push(...files.map(f => f.path)); return null; },
    });
    expect(new Set(seen).size).toBe(1500);
    expect(photoRows(db)).toHaveLength(0);
    expect(gallery(db).files_purged_at).not.toBeNull();
    expect(report).toMatchObject({ purgedGalleries: 1, purgedFiles: 1500, skipped: [] });
    expect(db.unboundedReads).toBe(0);
  });

  it('помилка removeFiles: жоден рядок не видалено, позначки немає, прогін іде далі', async () => {
    const db = seed(1500);
    db.tables.photographer_galleries.push({ id: 'g-2', expires_at: EXPIRED, files_purged_at: null });
    db.tables.photographer_gallery_photos.push({
      id: 'q-1', gallery_id: 'g-2', storage_path: 'ph-1/g-2/a.jpg', storage_provider: 'r2', created_at: EXPIRED,
    });

    const report = await cleanupExpiredGalleries({
      db,
      removeFiles: async files => (files.some(f => f.path.includes(GALLERY)) ? 'R2 не видалив 3 з 1000 файлів' : null),
    });

    expect(db.tables.photographer_gallery_photos.filter(r => r.gallery_id === GALLERY)).toHaveLength(1500);
    expect(gallery(db).files_purged_at).toBeNull();
    expect(db.deleteCalls).toBe(1); // only g-2's rows
    expect(report.purgedGalleries).toBe(1);
    expect(report.skipped).toEqual([{ gallery_id: GALLERY, stage: 'files', reason: 'R2 не видалив 3 з 1000 файлів' }]);
    expect(db.tables.photographer_galleries[1].files_purged_at).not.toBeNull();
  });

  it('новий рядок під час очищення: його не стерто, позначки немає', async () => {
    const db = seed(1500);
    let injected = false;
    db.onDelete = d => {
      if (injected) return;
      injected = true;
      d.tables.photographer_gallery_photos.push({
        id: 'late', gallery_id: GALLERY, storage_path: `ph-1/${GALLERY}/late.jpg`,
        storage_provider: 'r2', created_at: '2026-02-01T00:00:00.000Z',
      });
    };

    const res = await purgeGallery({ db, removeFiles: async () => null }, GALLERY);

    expect(res).toMatchObject({ ok: false, stage: 'rows_remain' });
    expect(photoRows(db).map(r => r.id)).toEqual(['late']);
    expect(gallery(db).files_purged_at).toBeNull();
  });

  it('наступний прогін дочищає пізній рядок і ставить позначку', async () => {
    const db = seed(0);
    db.tables.photographer_gallery_photos.push({
      id: 'late', gallery_id: GALLERY, storage_path: `ph-1/${GALLERY}/late.jpg`, storage_provider: 'r2', created_at: EXPIRED,
    });
    const seen: string[] = [];
    const res = await purgeGallery({ db, removeFiles: async f => { seen.push(...f.map(x => x.path)); return null; } }, GALLERY);
    expect(res).toEqual({ ok: true, files: 1 });
    expect(seen).toEqual([`ph-1/${GALLERY}/late.jpg`]);
    expect(gallery(db).files_purged_at).not.toBeNull();
  });

  it('галереї, що падають, не блокують решту черги', async () => {
    const db = seed(0);
    db.tables.photographer_galleries = Array.from({ length: 30 }, (_, i) => ({
      id: `bad-${String(i).padStart(2, '0')}`, expires_at: '2025-01-01T00:00:00.000Z', files_purged_at: null,
    }));
    db.tables.photographer_gallery_photos = db.tables.photographer_galleries.map(g => ({
      id: `f-${g.id}`, gallery_id: g.id, storage_path: `x/${g.id}/1.jpg`, storage_provider: 'r2', created_at: EXPIRED,
    }));
    db.tables.photographer_galleries.push({ id: 'good', expires_at: EXPIRED, files_purged_at: null });
    const report = await cleanupExpiredGalleries({
      db,
      removeFiles: async () => 'R2 не налаштовано',
    }, { batch: 25 });
    // All 30 bad ones are skipped, and the good (empty) one still gets marked.
    expect(report.skipped).toHaveLength(30);
    expect(report.purgedGalleries).toBe(1);
    expect(db.tables.photographer_galleries.find(g => g.id === 'good')!.files_purged_at).not.toBeNull();
  });
});

describe('removeFilesWith', () => {
  function deps(over: Partial<RemoveFilesDeps> = {}): RemoveFilesDeps & { r2Calls: string[][] } {
    const r2Calls: string[][] = [];
    return {
      r2Enabled: true,
      r2DeleteBatch: async keys => { r2Calls.push(keys); return { Deleted: keys.map(Key => ({ Key })) } as any; },
      supabaseRemove: async paths => ({ data: paths.map(name => ({ name })), error: null }),
      supabaseExists: async () => false,
      r2Calls,
      ...over,
    };
  }

  it('R2-ключі при вимкненому R2 — помилка, і нічого не видаляється', async () => {
    let sbCalled = false;
    const d = deps({ r2Enabled: false, r2Problem: 'R2_BUCKET не задано', supabaseRemove: async p => { sbCalled = true; return { data: p.map(name => ({ name })), error: null }; } });
    const err = await removeFilesWith(d, [{ path: 'a/b/1.jpg', provider: 'r2' }, { path: 'a/b/2.jpg', provider: 'supabase' }]);
    expect(err).toMatch(/R2 не налаштовано/);
    expect(err).toMatch(/R2_BUCKET/);
    expect(d.r2Calls).toHaveLength(0);
    expect(sbCalled).toBe(false);
  });

  it('вимкнений R2 не заважає, коли R2-файлів немає', async () => {
    expect(await removeFilesWith(deps({ r2Enabled: false }), [{ path: 'a/b/1.jpg', provider: 'supabase' }])).toBeNull();
  });

  it('непорожнє Errors у відповіді DeleteObjects — помилка, хоч HTTP і 200', async () => {
    const d = deps({
      r2DeleteBatch: async keys => ({
        Deleted: keys.slice(1).map(Key => ({ Key })),
        Errors: [{ Key: keys[0], Code: 'InternalError', Message: 'try again' }],
      } as any),
    });
    const err = await removeFilesWith(d, [{ path: 'k1', provider: 'r2' }, { path: 'k2', provider: 'r2' }]);
    expect(err).toMatch(/R2 не видалив 1 з 2/);
    expect(err).toMatch(/k1/);
  });

  it('1500 R2-ключів ідуть двома запитами по ≤1000', async () => {
    const d = deps();
    const files = Array.from({ length: 1500 }, (_, i) => ({ path: `k${i}`, provider: 'r2' }));
    expect(await removeFilesWith(d, files)).toBeNull();
    expect(d.r2Calls.map(c => c.length)).toEqual([1000, 500]);
  });

  it('Supabase: файл, який remove() не повернув і який досі лежить, — помилка', async () => {
    const d = deps({
      supabaseRemove: async paths => ({ data: paths.slice(1).map(name => ({ name })), error: null }),
      supabaseExists: async () => true,
    });
    expect(await removeFilesWith(d, [{ path: 'a/1.jpg' }, { path: 'a/2.jpg' }])).toMatch(/Supabase не видалив a\/1\.jpg/);
  });

  it('Supabase: файл, якого вже не було (повторний прогін), — не помилка', async () => {
    const d = deps({
      supabaseRemove: async () => ({ data: [], error: null }),
      supabaseExists: async () => false,
    });
    expect(await removeFilesWith(d, [{ path: 'a/1.jpg' }])).toBeNull();
  });

  it('Supabase: неможливо перевірити — теж помилка', async () => {
    const d = deps({
      supabaseRemove: async () => ({ data: [], error: null }),
      supabaseExists: async () => null,
    });
    expect(await removeFilesWith(d, [{ path: 'a/1.jpg' }])).toMatch(/не вдалося перевірити/);
  });
});
