import type { BookConfig, CoverDecoType, CoverState, SlotData, Page, LayoutType } from './types';
import {
  VELOUR_COLORS, LEATHERETTE_COLORS, FABRIC_COLORS,
  PAGE_PROPORTIONS, ACRYLIC_VARIANTS, PHOTO_INSERT_VARIANTS, METAL_VARIANTS,
} from './constants';

// ── Cover color resolution ───────────────────────────────────────────────────
// Single function to get the hex color for any cover material + color name

export function resolveCoverColor(materialType: string, colorName: string): string {
  const mat = (materialType || '').toLowerCase();

  if (mat.includes('тканин') || mat.includes('fabric')) {
    return FABRIC_COLORS[colorName] || '#C4AA88';
  }
  if (mat.includes('шкір') || mat.includes('leather')) {
    return LEATHERETTE_COLORS[colorName] || '#D9C8B0';
  }
  if (mat.includes('велюр') || mat.includes('velour')) {
    return VELOUR_COLORS[colorName] || '#D9C8B0';
  }

  return '#e8ecf4';
}

// ── Cover material type detection ────────────────────────────────────────────

export type CoverMaterialKey = 'velour' | 'leatherette' | 'fabric' | 'printed';

export function detectCoverMaterial(coverType: string): CoverMaterialKey {
  const ct = (coverType || '').toLowerCase();
  if (ct.includes('велюр') || ct.includes('velour')) return 'velour';
  if (ct.includes('шкір') || ct.includes('leather')) return 'leatherette';
  if (ct.includes('тканин') || ct.includes('fabric')) return 'fabric';
  return 'printed';
}

// ── Decoration type detection ────────────────────────────────────────────────

export function detectDecoType(decoString: string): CoverDecoType {
  const deco = (decoString || '').toLowerCase();
  if (deco.includes('акрил') || deco.includes('acrylic') || deco.includes('acryl')) return 'acryl';
  if (deco.includes('фотовставка') || deco.includes('photo_insert') || deco.includes('photo insert')) return 'photovstavka';
  if (deco.includes('флекс') || deco.includes('flex')) return 'flex';
  if (deco.includes('метал') || deco.includes('metal')) return 'metal';
  if (deco.includes('гравір') || deco.includes('гравію') || deco.includes('engraving') || deco.includes('graviruvannya')) return 'graviruvannya';
  return 'none';
}

// ── Decoration color detection ───────────────────────────────────────────────

export function detectDecoColor(colorString: string): string {
  const dc = (colorString || '').toLowerCase();
  if (dc.includes('срібн') || dc.includes('silver')) return '#C0C0C0';
  if (dc.includes('білий') || dc.includes('white')) return '#FFFFFF';
  if (dc.includes('чорн') || dc.includes('black')) return '#1A1A1A';
  return '#D4AF37'; // default gold
}

// ── Auto-select variant for size ─────────────────────────────────────────────

export function autoSelectVariant(
  decoType: CoverDecoType,
  sizeKey: string,
  decoColorStr: string,
  existingVariant: string,
): string {
  if (existingVariant) return existingVariant;
  if (decoType === 'none' || decoType === 'flex' || decoType === 'graviruvannya') return '';

  const variantMap: Record<string, Record<string, string[]>> = {
    acryl: ACRYLIC_VARIANTS,
    photovstavka: PHOTO_INSERT_VARIANTS,
    metal: METAL_VARIANTS,
  };

  const variants = variantMap[decoType]?.[sizeKey] || variantMap[decoType]?.['20x20'] || [];

  if (decoType === 'metal' && variants.length > 0) {
    const dc = (decoColorStr || '').toLowerCase();
    if (dc.includes('срібн') || dc.includes('silver')) {
      return variants.find(v => v.includes('срібний')) || variants[0];
    }
    return variants.find(v => v.includes('золотий')) || variants[0];
  }

  return variants[0] || '';
}

// ── Size key resolution ──────────────────────────────────────────────────────

export function normalizeSizeKey(size: string): string {
  return (size || '20x20').replace(/[×х]/g, 'x').replace(/\s*см/g, '').trim();
}

export function getSizeKeyForProduct(config: BookConfig | null): string {
  if (!config) return 'A4';
  const slug = (config.productSlug || '').toLowerCase();

  if (slug.includes('travel')) return '20x30';
  if (slug.includes('wish') || slug.includes('guest') || slug.includes('pobazhan')) {
    return normalizeSizeKey(config.selectedSize || '20x30');
  }
  if (slug.includes('magazine') || slug.includes('journal') || slug.includes('zhurnal') || slug.includes('fotozhurnal')) {
    return 'A4';
  }
  return normalizeSizeKey(config.selectedSize || '20x20');
}

// ── Product slug helpers ─────────────────────────────────────────────────────

export function getProductFlags(config: BookConfig | null) {
  const slug = (config?.productSlug || '').toLowerCase();
  const name = (config?.productName || '').toLowerCase();
  const coverType = (config?.selectedCoverType || '').toLowerCase();

  const isHardCoverJournal = slug.includes('tverd') || slug.includes('hard-cover') || name.includes('твердою');

  const isPrinted =
    coverType.includes('друков') || coverType.includes('print') ||
    coverType.includes("м'яка") || coverType.includes('soft') ||
    slug.includes('magazine') || slug.includes('journal') ||
    slug.includes('zhurnal') || slug.includes('fotozhurnal') ||
    slug.includes('travel') ||
    slug.includes('wish') || slug.includes('guest') || slug.includes('pobazhan') ||
    name.includes('журнал') || name.includes('тревел') || name.includes('побажань');

  const hasKalka = !!(config?.enableKalka) && slug.includes('photobook');

  const hasEndpaper = !!(config?.enableEndpaper) && (
    slug.includes('travelbook') || slug.includes('magazine') || slug.includes('journal')
  );

  return { isHardCoverJournal, isPrinted, hasKalka, hasEndpaper };
}

// ── Canvas dimensions ────────────────────────────────────────────────────────

export function getCanvasDimensions(sizeKey: string, zoom: number) {
  const prop = PAGE_PROPORTIONS[sizeKey] ?? PAGE_PROPORTIONS['A4'];
  const baseH = 460;
  const baseW = baseH * (2 * prop.w) / prop.h;
  const cW = baseW * zoom / 100;
  const cH = baseH * zoom / 100;
  const pageW = cW / 2;
  return { cW, cH, pageW, baseW, baseH };
}

// ── Spread / page index helpers ──────────────────────────────────────────────

export function getActivePageIdx(currentIdx: number, activeSide: 0 | 1): number {
  return currentIdx === 0 ? 0 : (currentIdx - 1) * 2 + 1 + activeSide;
}

export function getKalkaIndices(hasKalka: boolean, totalPages: number) {
  const kalkaPageIdx = hasKalka ? 1 : -1;
  const kalkaEndPageIdxStart = hasKalka ? totalPages - 2 : -1;
  return { kalkaPageIdx, kalkaEndPageIdxStart };
}

export function getEndpaperIndices(hasEndpaper: boolean, totalPages: number) {
  const endpaperFirstIdx = hasEndpaper ? 1 : -1;
  const endpaperLastIdx = hasEndpaper ? totalPages - 1 : -1;
  return { endpaperFirstIdx, endpaperLastIdx };
}

// ── Slot helpers ─────────────────────────────────────────────────────────────

export function makeSlots(n: number): SlotData[] {
  return Array.from({ length: n }, () => ({ photoId: null, cropX: 50, cropY: 50, zoom: 1 }));
}

// ── Initialize cover state from config ───────────────────────────────────────

export function initCoverStateFromConfig(config: BookConfig): Partial<CoverState> {
  const decoStr = config.selectedDecorationType || config.selectedDecoration || '';
  const decoType = detectDecoType(decoStr);
  const decoColor = detectDecoColor(config.selectedDecorationColor || '');
  const sizeKey = normalizeSizeKey(config.selectedSize || '20x20');
  const variant = autoSelectVariant(
    decoType, sizeKey, config.selectedDecorationColor || '', config.selectedDecorationVariant || ''
  );

  return { decoType, decoVariant: variant, decoColor };
}

// ── Build CoverEditor props (single source of truth) ─────────────────────────
// This eliminates the bug where two CoverEditor instances get different props.

export function buildCoverEditorProps(
  config: BookConfig,
  coverState: CoverState,
  effectiveCoverColor: string,
) {
  return {
    coverMaterial: detectCoverMaterial(config.selectedCoverType || ''),
    coverColorName: effectiveCoverColor,
    decoType: coverState.decoType,
    decoVariant: coverState.decoVariant,
    decoColor: coverState.decoColor,
    photoId: coverState.photoId,
    decoText: coverState.decoText,
    textX: coverState.textX,
    textY: coverState.textY,
    textFontFamily: coverState.textFontFamily,
    textFontSize: coverState.textFontSize,
    extraTexts: coverState.extraTexts || [],
    printedPhotoSlot: coverState.printedPhotoSlot,
    printedTextBlocks: coverState.printedTextBlocks,
    printedOverlay: coverState.printedOverlay,
    printedBgColor: coverState.printedBgColor,
  };
}

// ── CoverEditor onChange handler (single source of truth) ────────────────────

export function handleCoverChange(
  cfg: Partial<CoverState>,
  prev: CoverState,
): CoverState {
  return {
    ...prev,
    ...(cfg.photoId !== undefined && { photoId: cfg.photoId ?? null }),
    ...(cfg.decoText !== undefined && { decoText: cfg.decoText }),
    ...(cfg.decoColor !== undefined && { decoColor: cfg.decoColor }),
    ...(cfg.textX !== undefined && { textX: cfg.textX }),
    ...(cfg.textY !== undefined && { textY: cfg.textY }),
    ...(cfg.textFontFamily !== undefined && { textFontFamily: cfg.textFontFamily }),
    ...(cfg.textFontSize !== undefined && { textFontSize: cfg.textFontSize }),
    ...(cfg.extraTexts !== undefined && { extraTexts: cfg.extraTexts }),
    ...(cfg.printedPhotoSlot !== undefined && { printedPhotoSlot: cfg.printedPhotoSlot }),
    ...(cfg.printedTextBlocks !== undefined && { printedTextBlocks: cfg.printedTextBlocks }),
    ...(cfg.printedOverlay !== undefined && { printedOverlay: cfg.printedOverlay }),
    ...(cfg.printedBgColor !== undefined && { printedBgColor: cfg.printedBgColor }),
  };
}

// ── Initialize pages from config ─────────────────────────────────────────────

export function initPages(config: BookConfig): Page[] {
  const m = config.selectedPageCount.match(/(\d+)/);
  const total = m ? parseInt(m[0]) : 20;
  const slug = (config.productSlug || '').toLowerCase();
  const hasKalka = !!(config.enableKalka) && slug.includes('photobook');

  const ps: Page[] = [];
  ps.push({ id: 0, label: 'Обкладинка', layout: 'p-full', slots: makeSlots(1), textBlocks: [] });

  for (let i = 1; i <= total; i++) {
    ps.push({ id: i, label: `${i}`, layout: 'p-full', slots: makeSlots(1), textBlocks: [] });
  }

  if (hasKalka) {
    const n = ps.length;
    ps.push({ id: n, label: `${n}`, layout: 'p-full', slots: makeSlots(1), textBlocks: [] });
    ps.push({ id: n + 1, label: `${n + 1}`, layout: 'p-full', slots: makeSlots(1), textBlocks: [] });
  }

  return ps;
}
