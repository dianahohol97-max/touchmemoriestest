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

  // Score each layout
  const scored = compatible.map(l => {
    let score = 0;
    const orientations = LAYOUT_ORIENTATION_SCORE[l.id];
    if (orientations?.includes(orientation)) score += 10;
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
  density: 'sparse' | 'balanced' | 'dense'; // 1-2 / 2-3 / 3-5 per page
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
  const { photos, layouts, density, variety, coverPhotoEnabled, hasKalka, hasEndpaper } = options;
  
  if (photos.length === 0) {
    return { pages: [], coverPhotoId: null, totalSpreads: 0 };
  }

  // Step 1: Classify all photos
  const classified = photos.map(classifyPhoto);

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

  // Step 3: Determine photos per page based on density
  const photosPerPage = density === 'sparse' ? [1, 2] : density === 'balanced' ? [2, 3] : [3, 4, 5];

  // Step 4: Group photos into pages
  const pageGroups: PhotoClassified[][] = [];
  let idx = 0;
  while (idx < remaining.length) {
    // Pick a target count for this page
    const left = remaining.length - idx;
    let target: number;
    if (left <= photosPerPage[0]) {
      target = left; // use what's left
    } else {
      // Pick from the range, biased toward the middle
      const midIdx = Math.floor(photosPerPage.length / 2);
      const jitter = Math.floor(Math.random() * photosPerPage.length);
      target = photosPerPage[Math.min(jitter, photosPerPage.length - 1)];
      // Don't leave orphan photos (1 photo on last page when it could join previous)
      if (left - target === 1 && target < photosPerPage[photosPerPage.length - 1]) target++;
    }
    target = Math.min(target, left);
    pageGroups.push(remaining.slice(idx, idx + target));
    idx += target;
  }

  // Step 5: Build pages with optimal layouts
  const usedLayouts: string[] = [];
  const resultPages: { layout: string; photoIds: string[] }[] = [];

  // Detect spread mode: if layouts contain sp- prefix layouts
  const isSpreadMode = layouts.some(l => l.id.startsWith('sp-'));

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
