// Auto Build algorithm for TouchMemories photobook editor
// Inspired by SmartAlbums (Pixellu) — classifies photos, groups into spreads, picks optimal layouts

type Orientation = 'landscape' | 'portrait' | 'square';

interface PhotoClassified {
  id: string;
  width: number;
  height: number;
  orientation: Orientation;
  megapixels: number;
}

interface SpreadGroup {
  leftPhotos: PhotoClassified[];
  rightPhotos: PhotoClassified[];
}

// Layout scoring: which layouts work best for which photo orientations
const LAYOUT_ORIENTATION_SCORE: Record<string, Orientation[]> = {
  // 1 photo
  'p-full':        ['landscape', 'square'],
  'p-center':      ['portrait', 'square'],
  'p-top':         ['landscape'],
  'p-bottom':      ['landscape'],
  'p-left':        ['portrait'],
  'p-right':       ['portrait'],
  // 2 photos
  'p-2-v':         ['portrait'],
  'p-2-h':         ['landscape'],
  'p-2-big-top':   ['landscape', 'square'],
  'p-2-big-bottom':['landscape', 'square'],
  'p-2-big-left':  ['portrait', 'square'],
  'p-2-big-right': ['portrait', 'square'],
  'p-2-diag':      ['square'],
  // 3 photos
  'p-3-row':       ['portrait'],
  'p-3-col':       ['landscape'],
  'p-3-hero-top':  ['landscape', 'square'],
  'p-3-hero-left': ['portrait', 'square'],
  'p-3-top2':      ['landscape'],
  'p-3-bot2':      ['landscape'],
  'p-3-left2':     ['portrait'],
  'p-3-right2':    ['portrait'],
  // 4 photos
  'p-4-grid':      ['square'],
  'p-4-hero-top':  ['landscape', 'square'],
  'p-4-hero-left': ['portrait', 'square'],
  'p-4-strip-h':   ['landscape'],
  'p-4-strip-v':   ['portrait'],
  'p-4-l-shape':   ['square'],
  // Spread layouts (photobooks)
  'sp-full':        ['landscape', 'square'],
  'sp-1-left':      ['portrait'],
  'sp-1-right':     ['portrait'],
  'sp-1-center':    ['portrait', 'square'],
  'sp-2-v':         ['portrait'],
  'sp-2-h':         ['landscape'],
  'sp-2-big-left':  ['landscape', 'square'],
  'sp-2-big-right': ['landscape', 'square'],
  'sp-2-big-top':   ['landscape'],
  'sp-2-big-bottom':['landscape'],
  'sp-3-row':       ['portrait'],
  'sp-3-hero-left': ['landscape', 'square'],
  'sp-3-hero-right':['landscape', 'square'],
  'sp-3-col':       ['landscape'],
  'sp-3-hero-top':  ['landscape', 'square'],
  'sp-3-hero-bottom':['landscape', 'square'],
  'sp-4-grid':      ['square'],
  'sp-4-hero':      ['landscape', 'square'],
  'sp-4-hero-right':['landscape', 'square'],
  'sp-4-top-bottom':['square'],
  'sp-4-strip-h':   ['landscape'],
  'sp-5-grid':      ['square'],
  'sp-5-hero':      ['landscape', 'square'],
  'sp-6-grid':      ['square'],
};

function classifyPhoto(photo: { id: string; width: number; height: number }): PhotoClassified {
  const ratio = photo.width / photo.height;
  const orientation: Orientation = ratio > 1.2 ? 'landscape' : ratio < 0.83 ? 'portrait' : 'square';
  return { ...photo, orientation, megapixels: (photo.width * photo.height) / 1e6 };
}

function dominantOrientation(photos: PhotoClassified[]): Orientation {
  const counts = { landscape: 0, portrait: 0, square: 0 };
  for (const p of photos) counts[p.orientation]++;
  if (counts.landscape >= counts.portrait && counts.landscape >= counts.square) return 'landscape';
  if (counts.portrait >= counts.landscape && counts.portrait >= counts.square) return 'portrait';
  return 'square';
}

function pickBestLayout(
  slotCount: number,
  orientation: Orientation,
  allLayouts: { id: string; slots: number }[],
  usedRecently: string[],
  variety: 'min' | 'medium' | 'max'
): string {
  const compatible = allLayouts.filter(l => l.slots === slotCount);
  if (compatible.length === 0) return allLayouts[0]?.id || 'p-full';

  // Orientation fit is a HARD preference, not just a bonus. If any compatible
  // layout matches the group's orientation, we only ever choose among those.
  // This stops a run of portrait photos from spilling onto a landscape-only
  // layout (e.g. sp-full) just because the portrait-friendly layouts picked up
  // variety penalties for repeating. Landscape photos go to spread/wide layouts,
  // portrait photos stay on portrait layouts. Variety only breaks ties WITHIN
  // the orientation-matched pool.
  const orientationFit = compatible.filter(l => LAYOUT_ORIENTATION_SCORE[l.id]?.includes(orientation));
  const pool = orientationFit.length > 0 ? orientationFit : compatible;

  // Score each layout in the pool (variety penalty + small jitter)
  const scored = pool.map(l => {
    let score = 0;
    // Variety penalty
    const recentIdx = usedRecently.lastIndexOf(l.id);
    if (recentIdx >= 0) {
      const distance = usedRecently.length - recentIdx;
      if (variety === 'min' && distance < 4) score -= 20;
      if (variety === 'medium' && distance < 2) score -= 15;
      // 'max' — no penalty for repeats
    }
    // Small random factor for variety
    score += Math.random() * 3;
    return { id: l.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].id;
}

export interface AutoBuildOptions {
  photos: { id: string; width: number; height: number; name: string }[];
  layouts: { id: string; slots: number }[];
  currentPageCount: number;
  minPages: number;
  maxPages?: number;  // hard cap — never exceed ordered page count
  density: 'sparse' | 'balanced' | 'dense';
  variety: 'min' | 'medium' | 'max';
  coverPhotoEnabled: boolean;
  hasKalka: boolean;
  hasEndpaper: boolean;
}

export interface AutoBuildResult {
  pages: { layout: string; photoIds: string[] }[];
  coverPhotoId: string | null;
  totalSpreads: number;
}

export function autoBuild(options: AutoBuildOptions): AutoBuildResult {
  const { photos, layouts, density, variety, coverPhotoEnabled, hasKalka, hasEndpaper, maxPages } = options;
  
  if (photos.length === 0) {
    return { pages: [], coverPhotoId: null, totalSpreads: 0 };
  }

  // Step 1: Classify all photos — sorted by filename (preserves date/sequence order from camera)
  const classified = [...photos]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    .map(classifyPhoto);

  // Step 2: Pick cover photo (highest megapixels, prefer landscape/square)
  let coverPhotoId: string | null = null;
  let remaining = [...classified];
  if (coverPhotoEnabled && remaining.length > 0) {
    const sorted = [...remaining].sort((a, b) => {
      const aBonus = a.orientation === 'landscape' || a.orientation === 'square' ? 1 : 0;
      const bBonus = b.orientation === 'landscape' || b.orientation === 'square' ? 1 : 0;
      return (b.megapixels + bBonus * 2) - (a.megapixels + aBonus * 2);
    });
    coverPhotoId = sorted[0].id;
    remaining = remaining.filter(p => p.id !== coverPhotoId);
  }

  // Spread mode (photobooks) packs ONE group per spread = 2 content pages,
  // so the number of groups we can keep is half the ordered content pages.
  // Detecting it here (before grouping) lets us size the groups so every
  // uploaded photo is placed instead of being dropped when the page budget
  // runs out.
  const isSpreadMode = layouts.some(l => l.id.startsWith('sp-'));

  // Step 3: Determine photos per page based on density
  const photosPerPage = density === 'sparse' ? [1, 2] : density === 'balanced' ? [2, 3] : [3, 4, 5];
  const densityMin = photosPerPage[0];
  const densityMax = photosPerPage[photosPerPage.length - 1];

  // How many groups (single pages, or spreads) the ordered size allows.
  const groupBudget = maxPages
    ? Math.max(1, isSpreadMode ? Math.floor(maxPages / 2) : maxPages)
    : Infinity;
  // Upper bound of photos per group we'll allow when packing denser to fit
  // everything. Spread layouts exist up to 6 slots; single pages up to 4.
  const hardMax = isSpreadMode ? 6 : 4;
  // Minimum photos per group needed so ALL photos land inside the budget. If
  // this is higher than the chosen density, we pack a little denser rather
  // than dropping the customer's photos.
  const needPerGroup = Number.isFinite(groupBudget)
    ? Math.ceil(remaining.length / (groupBudget as number))
    : densityMax;
  const lo = Math.min(hardMax, Math.max(densityMin, needPerGroup));
  const hi = Math.min(hardMax, Math.max(densityMax, needPerGroup));

  // Step 4: Group photos into pages
  const pageGroups: PhotoClassified[][] = [];
  let idx = 0;
  while (idx < remaining.length) {
    const left = remaining.length - idx;
    let target: number;
    if (left <= lo) {
      target = left;
    } else {
      target = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (left - target === 1 && target < hi) target++;
    }
    target = Math.min(target, left);
    pageGroups.push(remaining.slice(idx, idx + target));
    idx += target;

    // Out of group budget but photos remain — distribute the leftovers across
    // the groups we already have (round-robin) so nothing is dropped.
    if (Number.isFinite(groupBudget) && pageGroups.length >= (groupBudget as number)) {
      let gi = 0;
      while (idx < remaining.length) {
        pageGroups[gi % pageGroups.length].push(remaining[idx]);
        idx++; gi++;
      }
      break;
    }
  }

  // Step 5: Build pages with optimal layouts
  const usedLayouts: string[] = [];
  const resultPages: { layout: string; photoIds: string[] }[] = [];

  if (isSpreadMode) {
    // SPREAD MODE: each pageGroup = 1 spread page with spread layout
    for (const group of pageGroups) {
      if (group.length > 0) {
        const orient = dominantOrientation(group);
        const layoutId = pickBestLayout(group.length, orient, layouts, usedLayouts, variety);
        usedLayouts.push(layoutId);
        resultPages.push({ layout: layoutId, photoIds: group.map(p => p.id) });
        // Add empty right page (spread pair requirement)
        resultPages.push({ layout: layoutId, photoIds: [] });
      }
    }
  } else {
    // PAGE MODE: split into spread pairs (left + right pages)
    const spreadPairs: [PhotoClassified[], PhotoClassified[]][] = [];
    for (let i = 0; i < pageGroups.length; i += 2) {
      const left = pageGroups[i] || [];
      const right = pageGroups[i + 1] || [];
      spreadPairs.push([left, right]);
    }

    for (const [leftPhotos, rightPhotos] of spreadPairs) {
      if (leftPhotos.length > 0) {
        const orient = dominantOrientation(leftPhotos);
        const layoutId = pickBestLayout(leftPhotos.length, orient, layouts, usedLayouts, variety);
        usedLayouts.push(layoutId);
        resultPages.push({ layout: layoutId, photoIds: leftPhotos.map(p => p.id) });
      } else {
        resultPages.push({ layout: layouts[0]?.id || 'p-full', photoIds: [] });
      }

      if (rightPhotos.length > 0) {
        const orient = dominantOrientation(rightPhotos);
        const layoutId = pickBestLayout(rightPhotos.length, orient, layouts, usedLayouts, variety);
        usedLayouts.push(layoutId);
        resultPages.push({ layout: layoutId, photoIds: rightPhotos.map(p => p.id) });
      } else {
        resultPages.push({ layout: layouts[0]?.id || 'p-full', photoIds: [] });
      }
    }
  }

  return {
    pages: resultPages,
    coverPhotoId,
    totalSpreads: isSpreadMode ? pageGroups.length : Math.ceil(resultPages.length / 2),
  };
}
