import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  GALLERY_VARIANT_EDGES,
  allGalleryVariantPaths,
  galleryFilesToRemove,
  gallerySources,
  galleryVariantPath,
  rowNeedsVariants,
  variantEdgesFor,
  variantSize,
} from '@/lib/photographers/gallery-variant-paths';
import { galleryImgAttrs, galleryThumbUrl, gridSizes } from '@/lib/photographers/gallery-image';
import { removeFilesWith, type RemoveFilesDeps } from '@/lib/photographers/remove-files';
import { purgeGallery } from '@/lib/photographers/gallery-cleanup';
import { makeVariantsForRow, runGalleryVariants, type GalleryVariantDeps } from '@/lib/photographers/gallery-variants';
import { renderGalleryVariants } from '@/lib/photographers/gallery-variants-render';

/**
 * Екранні копії фото клієнтських галерей (гоча 19 у галереях, 2026-09-24).
 *
 * Що тут закріплено:
 *   – шляхи копій рахуються однаково для того, хто пише, читає і видаляє;
 *   – видалення фото прибирає і копії, а відсутня копія — не помилка, хоча
 *     сувора перевірка removeFiles для справжніх відмов лишається;
 *   – без копій екран показує оригінал, порожнього тайла не буває;
 *   – копії, записані для фото, яке видалили під час нарізки, не стають
 *     сиротами.
 */

type Row = Record<string, any>;

/** Мінімальний PostgREST: фільтри, порядок, ліміт, update(...).select(). */
class FakeDb {
  tables: Record<string, Row[]> = {};
  beforeUpdate?: (patch: Row) => void;
  from(table: string) {
    if (!this.tables[table]) this.tables[table] = [];
    return new FakeQuery(this, table);
  }
}

class FakeQuery {
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private mode: 'select' | 'update' | 'delete' = 'select';
  private patch: Row = {};
  private head = false;
  private returning = false;
  private rangeFrom: number | null = null;
  private rangeTo = 0;
  private limitN: number | null = null;
  constructor(private db: FakeDb, private table: string) {}
  select(_c?: string, o?: { head?: boolean }) {
    if (this.mode === 'select') this.head = !!o?.head; else this.returning = true;
    return this;
  }
  update(p: Row) { this.mode = 'update'; this.patch = p; return this; }
  delete() { this.mode = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push(r => (r[c] ?? null) === v); return this; }
  in(c: string, vs: any[]) { const s = new Set(vs); this.filters.push(r => s.has(r[c])); return this; }
  is(c: string, v: any) { this.filters.push(r => (r[c] ?? null) === v); return this; }
  lt(c: string, v: any) { this.filters.push(r => (r[c] ?? 0) < v); return this; }
  gt(c: string, v: any) { this.filters.push(r => r[c] > v); return this; }
  gte(c: string, v: any) { this.filters.push(r => r[c] >= v); return this; }
  or(expr: string) {
    // Лише форма, яку пише черга: `col.is.null,col.lt.<iso>`.
    const [a, b] = expr.split(',');
    const col = a.split('.')[0];
    const iso = b.split('.lt.')[1];
    this.filters.push(r => r[col] == null || r[col] < iso);
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) { this.orders.push({ col: c, asc: o?.ascending !== false }); return this; }
  range(f: number, t: number) { this.rangeFrom = f; this.rangeTo = t; return this; }
  limit(n: number) { this.limitN = n; return this; }
  maybeSingle() { return this.then((r: any) => ({ ...r, data: r.data?.[0] ?? null })); }
  then(res: (v: any) => any, rej?: (e: any) => any) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  private run() {
    const all = this.db.tables[this.table];
    const match = all.filter(r => this.filters.every(f => f(r)));
    if (this.mode === 'delete') {
      this.db.tables[this.table] = all.filter(r => !match.includes(r));
      return { data: null, error: null };
    }
    if (this.mode === 'update') {
      this.db.beforeUpdate?.(this.patch);
      const still = this.db.tables[this.table].filter(r => match.includes(r));
      for (const r of still) Object.assign(r, this.patch);
      return { data: this.returning ? still.map(r => ({ id: r.id })) : null, error: null };
    }
    if (this.head) return { data: null, count: match.length, error: null };
    let out = [...match].sort((x, y) => {
      for (const o of this.orders) {
        if (x[o.col] < y[o.col]) return o.asc ? -1 : 1;
        if (x[o.col] > y[o.col]) return o.asc ? 1 : -1;
      }
      return 0;
    });
    if (this.rangeFrom !== null) out = out.slice(this.rangeFrom, this.rangeTo + 1);
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    return { data: out.slice(0, 1000), error: null };
  }
}

const ORIGINAL = 'ph-1/g-1/1727000000000_IMG_0001.JPG';

describe('шляхи копій', () => {
  it('лежать в окремій теці поруч з оригіналом і завжди закінчуються на .jpg', () => {
    expect(galleryVariantPath(ORIGINAL, 640)).toBe('ph-1/g-1/_v640/1727000000000_IMG_0001.JPG.jpg');
    expect(galleryVariantPath(ORIGINAL, 2048)).toBe('ph-1/g-1/_v2048/1727000000000_IMG_0001.JPG.jpg');
    expect(galleryVariantPath('noslash.png', 1280)).toBe('_v1280/noslash.png.jpg');
  });

  it('два оригінали з різними розширеннями не зливаються в одну копію', () => {
    expect(galleryVariantPath('a/b/1_x.png', 640)).not.toBe(galleryVariantPath('a/b/1_x.jpg', 640));
  });

  it('копія ніколи не збігається з жодним оригіналом тієї ж галереї', () => {
    // Оригінали лежать просто в теці галереї, копії — у підтеках _vNNN.
    for (const p of allGalleryVariantPaths(ORIGINAL)) expect(p.startsWith('ph-1/g-1/_v')).toBe(true);
  });

  it('копія робиться лише там, де оригінал більший за її межу', () => {
    expect(variantEdgesFor(6000, 4000)).toEqual([640, 1280, 2048]);
    expect(variantEdgesFor(1800, 1200)).toEqual([640, 1280]);
    expect(variantEdgesFor(640, 480)).toEqual([]);
    expect(variantEdgesFor(null, null)).toEqual([]);
    expect(variantSize(6000, 4000, 640)).toEqual({ width: 640, height: 427 });
    expect(variantSize(4000, 6000, 2048)).toEqual({ width: 1365, height: 2048 });
  });
});

describe('видалення фото разом із копіями', () => {
  it('старе фото без копій — видаляється тільки оригінал, сховище про копії не питають', () => {
    expect(galleryFilesToRemove({ storage_path: ORIGINAL, storage_provider: 'r2' }))
      .toEqual([{ path: ORIGINAL, provider: 'r2' }]);
  });

  it('фото з копіями — оригінал і всі три шляхи копій, у того ж провайдера', () => {
    const files = galleryFilesToRemove({ storage_path: ORIGINAL, storage_provider: 'supabase', variants_at: '2026-09-24T00:00:00Z' });
    expect(files).toHaveLength(1 + GALLERY_VARIANT_EDGES.length);
    expect(files.every(f => f.provider === 'supabase')).toBe(true);
    expect(files.map(f => f.path)).toEqual([ORIGINAL, ...allGalleryVariantPaths(ORIGINAL)]);
  });

  it('обірвана спроба (є variant_tries, немає variants_at) теж прибирає шляхи копій', () => {
    expect(galleryFilesToRemove({ storage_path: ORIGINAL, variant_tries: 1 })).toHaveLength(4);
  });

  const r2Deps = (existing: Set<string>, fail?: string): RemoveFilesDeps => ({
    r2Enabled: true,
    // Як справжній S3/R2: ключ, якого немає, звітується як видалений.
    r2DeleteBatch: async keys => {
      for (const k of keys) existing.delete(k);
      return fail ? { Errors: [{ Key: fail, Code: 'AccessDenied' }] } : { Errors: [] };
    },
    supabaseRemove: async () => ({ data: [], error: null }),
    supabaseExists: async () => false,
  });

  it('R2: копії, яких немає (маленький оригінал), — не помилка', async () => {
    const existing = new Set([ORIGINAL, galleryVariantPath(ORIGINAL, 640)]);
    const files = galleryFilesToRemove({ storage_path: ORIGINAL, storage_provider: 'r2', variants_at: 'x' });
    expect(await removeFilesWith(r2Deps(existing), files)).toBeNull();
    expect(existing.size).toBe(0);
  });

  it('R2: сувора перевірка лишається — відмова по копії це помилка', async () => {
    const files = galleryFilesToRemove({ storage_path: ORIGINAL, storage_provider: 'r2', variants_at: 'x' });
    const err = await removeFilesWith(r2Deps(new Set(), galleryVariantPath(ORIGINAL, 1280)), files);
    expect(err).toContain('R2 не видалив');
  });

  const sbDeps = (existing: Set<string>, stuck?: string): RemoveFilesDeps => ({
    r2Enabled: false,
    r2DeleteBatch: async () => ({ Errors: [] }),
    // Як справжній Supabase: у data лише ті, що справді були і зникли.
    supabaseRemove: async paths => {
      const removed = paths.filter(p => existing.has(p) && p !== stuck);
      for (const p of removed) existing.delete(p);
      return { data: removed.map(name => ({ name })), error: null };
    },
    supabaseExists: async p => existing.has(p),
  });

  it('Supabase: копії, яких немає, — не помилка', async () => {
    const existing = new Set([ORIGINAL]);
    const files = galleryFilesToRemove({ storage_path: ORIGINAL, storage_provider: 'supabase', variant_tries: 3 });
    expect(await removeFilesWith(sbDeps(existing), files)).toBeNull();
  });

  it('Supabase: копія, яка лишилася в сховищі, — помилка, і рядок має жити', async () => {
    const stuck = galleryVariantPath(ORIGINAL, 2048);
    const existing = new Set([ORIGINAL, stuck]);
    const files = galleryFilesToRemove({ storage_path: ORIGINAL, storage_provider: 'supabase', variants_at: 'x' });
    expect(await removeFilesWith(sbDeps(existing, stuck), files)).toContain('не видалив');
  });

  it('крон очищення віддає в removeFiles копії тільки тих фото, у яких вони могли бути', async () => {
    const db = new FakeDb();
    db.tables.photographer_galleries = [{ id: 'g-1', files_purged_at: null }];
    db.tables.photographer_gallery_photos = [
      { id: 'a', gallery_id: 'g-1', storage_path: 'ph-1/g-1/a.jpg', storage_provider: 'r2', created_at: '1', variants_at: 'x' },
      { id: 'b', gallery_id: 'g-1', storage_path: 'ph-1/g-1/b.jpg', storage_provider: 'r2', created_at: '2' },
    ];
    let asked: string[] = [];
    const res = await purgeGallery({ db, removeFiles: async f => { asked = f.map(x => x.path); return null; } }, 'g-1');
    expect(res).toEqual({ ok: true, files: 2 });
    expect(asked).toEqual(['ph-1/g-1/a.jpg', ...allGalleryVariantPaths('ph-1/g-1/a.jpg'), 'ph-1/g-1/b.jpg']);
    expect(db.tables.photographer_gallery_photos).toHaveLength(0);
  });

  it('крон очищення: відмова сховища по копії лишає рядки на місці', async () => {
    const db = new FakeDb();
    db.tables.photographer_galleries = [{ id: 'g-1', files_purged_at: null }];
    db.tables.photographer_gallery_photos = [
      { id: 'a', gallery_id: 'g-1', storage_path: 'ph-1/g-1/a.jpg', storage_provider: 'r2', created_at: '1', variants_at: 'x' },
    ];
    const res = await purgeGallery({ db, removeFiles: async () => 'R2 не видалив 1 з 4 файлів' }, 'g-1');
    expect(res.ok).toBe(false);
    expect(db.tables.photographer_gallery_photos).toHaveLength(1);
    expect(db.tables.photographer_galleries[0].files_purged_at).toBeNull();
  });
});

describe('src і srcset на екрані', () => {
  const url = 'https://cdn/ph-1/g-1/big.jpg';
  const urlFor = (p: string) => `https://cdn/${p}`;
  const big = { storage_path: 'ph-1/g-1/big.jpg', width: 6000, height: 4000, variants_at: 'x' };

  it('без копій — оригінал, без srcset, і жодного порожнього src', () => {
    expect(gallerySources({ ...big, variants_at: null }, urlFor, url)).toEqual([]);
    expect(galleryImgAttrs({ url, sources: [] }, 'thumb', '100vw')).toEqual({ src: url });
    expect(galleryImgAttrs({ url, w: 6000, h: 4000 }, 'full')).toEqual({ src: url, width: 6000, height: 4000 });
    expect(galleryThumbUrl({ url })).toBe(url);
  });

  it('копії є, а розмірів немає (зіпсований рядок) — теж оригінал', () => {
    expect(gallerySources({ ...big, width: null }, urlFor, url)).toEqual([]);
  });

  it('великий оригінал у srcset не йде, мініатюра — найменша копія, лайтбокс — найбільша', () => {
    const sources = gallerySources(big, urlFor, url);
    expect(sources).toEqual([
      { w: 640, url: 'https://cdn/ph-1/g-1/_v640/big.jpg.jpg' },
      { w: 1280, url: 'https://cdn/ph-1/g-1/_v1280/big.jpg.jpg' },
      { w: 2048, url: 'https://cdn/ph-1/g-1/_v2048/big.jpg.jpg' },
    ]);
    const thumb = galleryImgAttrs({ url, w: 6000, h: 4000, sources }, 'thumb', '33vw');
    expect(thumb.src).toBe(sources[0].url);
    expect(thumb.srcSet).toBe(sources.map(s => `${s.url} ${s.w}w`).join(', '));
    expect(thumb).toMatchObject({ sizes: '33vw', width: 6000, height: 4000 });
    expect(thumb.srcSet).not.toContain(url + ' ');
    expect(galleryImgAttrs({ url, sources }, 'full').src).toBe(sources[2].url);
    expect(galleryThumbUrl({ url, sources })).toBe(sources[0].url);
  });

  it('оригінал менший за 2048 сам стає найбільшим джерелом', () => {
    const sources = gallerySources({ ...big, width: 1200, height: 1800 }, urlFor, url);
    expect(sources.map(s => s.w)).toEqual([427, 853, 1200]);
    expect(sources[2].url).toBe(url);
  });

  it('вертикальне фото: ширини в srcset — це ширини, а не довгі сторони', () => {
    const sources = gallerySources({ ...big, width: 4000, height: 6000 }, urlFor, url);
    expect(sources.map(s => s.w)).toEqual([427, 853, 1365]);
  });

  it('кожен запис sizes — валідна довжина, а не голий вираз', () => {
    // `100vw - 40px` без calc() браузер мовчки пропускає, і телефон брав
    // копію 640 замість 1280 (спіймано заміром у Playwright).
    for (const layout of ['masonry', 'grid', 'large', 'mixed']) {
      for (const [aspect, big] of [[1.5, false], [0.66, false], [1, true]] as const) {
        for (const entry of gridSizes(layout, aspect, big).split(/,\s*(?![^()]*\))/)) {
          const length = entry.replace(/^\([^)]*\)\s*/, '');
          expect(length).toMatch(/^(calc|min|max)\(/);
        }
      }
    }
  });

  it('sizes для розкладок із кадруванням враховує горизонтальні фото', () => {
    expect(gridSizes('masonry', 1.5)).not.toContain('calc((');
    expect(gridSizes('masonry', 1)).toBe('(max-width: 520px) calc(100vw - 40px), (max-width: 900px) calc(50vw - 27px), calc(min(33.3vw - 22px, 457px))');
    expect(gridSizes('grid', 1.5)).toContain('* 1.5');
    expect(gridSizes('mixed', 1, true)).toContain('* 2');
  });
});

describe('черга копій', () => {
  const NOW = new Date('2026-09-24T12:00:00Z');
  const seed = () => {
    const db = new FakeDb();
    db.tables.photographer_gallery_photos = [
      { id: 'p1', gallery_id: 'g-1', storage_path: 'ph/g-1/1.jpg', storage_provider: 'r2', media_type: 'photo', created_at: '1', variants_at: null, variant_tries: 0, variant_tried_at: null },
      { id: 'v1', gallery_id: 'g-1', storage_path: 'ph/g-1/v.mp4', storage_provider: 'r2', media_type: 'video', created_at: '2', variants_at: null, variant_tries: 0, variant_tried_at: null },
      { id: 'p2', gallery_id: 'g-1', storage_path: 'ph/g-1/2.jpg', storage_provider: 'r2', media_type: 'photo', created_at: '3', variants_at: 'done', variant_tries: 1, variant_tried_at: null },
      { id: 'p3', gallery_id: 'g-1', storage_path: 'ph/g-1/3.heic', storage_provider: 'r2', media_type: 'photo', created_at: '4', variants_at: null, variant_tries: 3, variant_tried_at: null },
    ];
    return db;
  };
  const deps = (db: FakeDb, over: Partial<GalleryVariantDeps> = {}) => {
    const stored = new Map<string, Buffer>();
    const removed: string[] = [];
    const d: GalleryVariantDeps = {
      db,
      now: () => NOW,
      readOriginal: async () => Buffer.from('original'),
      render: async () => ({ width: 6000, height: 4000, variants: GALLERY_VARIANT_EDGES.map(edge => ({ edge, body: Buffer.alloc(edge) })) }),
      put: async (path, body) => { stored.set(path, body); return null; },
      removeFiles: async files => { for (const f of files) { removed.push(f.path); stored.delete(f.path); } return null; },
      ...over,
    };
    return { d, stored, removed };
  };

  it('бере тільки фото без копій, не відео, і не ті, де спроби вичерпано', async () => {
    const db = seed();
    const { d, stored } = deps(db);
    const report = await runGalleryVariants(d, { scope: q => q.eq('gallery_id', 'g-1') });
    expect(report).toMatchObject({ made: 1, failed: 0, remaining: 0 });
    expect([...stored.keys()]).toEqual(allGalleryVariantPaths('ph/g-1/1.jpg'));
    const p1 = db.tables.photographer_gallery_photos[0];
    expect(p1).toMatchObject({ width: 6000, height: 4000, variant_tries: 1, variant_bytes: 640 + 1280 + 2048 });
    expect(p1.variants_at).toBeTruthy();
    // Відео і HEIC з вичерпаними спробами не чіпалися.
    expect(db.tables.photographer_gallery_photos[1].variant_tries).toBe(0);
    expect(db.tables.photographer_gallery_photos[3].variant_tries).toBe(3);
  });

  it('перезапуск нічого не дублює: готові фото в чергу більше не потрапляють', async () => {
    const db = seed();
    const { d, stored } = deps(db);
    await runGalleryVariants(d, { scope: q => q.eq('gallery_id', 'g-1') });
    const again = await runGalleryVariants(d, { scope: q => q.eq('gallery_id', 'g-1') });
    expect(again.made).toBe(0);
    expect(stored.size).toBe(3);
  });

  it('спроба позначається ДО запису копій — видалення посередині знайде їх', async () => {
    const db = seed();
    let flaggedBeforePut = false;
    const { d } = deps(db, {
      put: async () => {
        flaggedBeforePut = galleryFilesToRemove(db.tables.photographer_gallery_photos[0] as any).length === 4;
        return null;
      },
    });
    await makeVariantsForRow(d, db.tables.photographer_gallery_photos[0] as any);
    expect(flaggedBeforePut).toBe(true);
  });

  it('фото видалили, поки різали, — щойно записані копії стираються', async () => {
    const db = seed();
    const { d, stored, removed } = deps(db);
    // Видалення стається між записом копій і позначкою готовності.
    db.beforeUpdate = patch => {
      if (patch.variants_at) db.tables.photographer_gallery_photos = db.tables.photographer_gallery_photos.filter(r => r.id !== 'p1');
    };
    const res = await makeVariantsForRow(d, { ...db.tables.photographer_gallery_photos[0] } as any);
    expect(res.outcome).toBe('gone');
    expect(removed).toEqual(allGalleryVariantPaths('ph/g-1/1.jpg'));
    expect(stored.size).toBe(0);
  });

  it('два обробники на одне фото: працює тільки перший', async () => {
    const db = seed();
    const { d } = deps(db);
    const row = { ...db.tables.photographer_gallery_photos[0] } as any;
    const [a, b] = await Promise.all([makeVariantsForRow(d, row), makeVariantsForRow(d, row)]);
    expect([a.outcome, b.outcome].sort()).toEqual(['busy', 'made']);
  });

  it('нарізка не вдалася — причина в рядку, фото чекає наступної спроби, а не зникає з екрана', async () => {
    const db = seed();
    const { d } = deps(db, { render: async () => { throw new Error('unsupported image format'); } });
    const report = await runGalleryVariants(d, { scope: q => q.eq('gallery_id', 'g-1') });
    expect(report.failed).toBe(1);
    const p1 = db.tables.photographer_gallery_photos[0];
    expect(p1.variants_at).toBeNull();
    expect(p1.variant_error).toContain('unsupported');
    // У тому ж проході повтору немає: спершу пауза.
    expect(rowNeedsVariants(p1 as any, NOW.getTime())).toBe(false);
    expect(rowNeedsVariants(p1 as any, NOW.getTime() + 11 * 60 * 1000)).toBe(true);
  });
});

describe('нарізка через sharp', () => {
  it('вертикальний знімок з EXIF-поворотом: розміри після повороту, три копії JPEG', async () => {
    // Кадр 3000×2000, записаний «боком» з орієнтацією 6 (як на телефоні).
    const original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#88aacc' } })
      .jpeg({ quality: 90 })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await renderGalleryVariants(original);
    expect(out).toMatchObject({ width: 2000, height: 3000 });
    expect(out.variants.map(v => v.edge)).toEqual([640, 1280, 2048]);
    for (const v of out.variants) {
      const m = await sharp(v.body).metadata();
      expect(m.format).toBe('jpeg');
      expect(Math.max(m.width!, m.height!)).toBe(v.edge);
      expect(m.height! > m.width!).toBe(true);
      expect(m.orientation ?? 1).toBe(1);
    }
  });

  it('маленький оригінал — копій немає, лише розміри', async () => {
    const original = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#fff' } }).png().toBuffer();
    expect(await renderGalleryVariants(original)).toEqual({ width: 600, height: 400, variants: [] });
  });
});
