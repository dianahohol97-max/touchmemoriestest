// ── Photobook Pricing ────────────────────────────────────────────────────────
// TODO: Move to Supabase table for dynamic pricing without deploys

import { normalizeSizeKey } from './utils';

const PHOTOBOOK_PRICES: Record<string, number> = {
  // Велюр / Тканина / Шкірзамінник (same prices) — 20×20
  velour_20x20_6:1050, velour_20x20_8:1100, velour_20x20_10:1150, velour_20x20_12:1200,
  velour_20x20_14:1250, velour_20x20_16:1300, velour_20x20_18:1350, velour_20x20_20:1400,
  velour_20x20_22:1450, velour_20x20_24:1500, velour_20x20_26:1550, velour_20x20_28:1600,
  velour_20x20_30:1650, velour_20x20_32:1700, velour_20x20_34:1750, velour_20x20_36:1800,
  velour_20x20_38:1850, velour_20x20_40:1900, velour_20x20_42:1950, velour_20x20_44:2000,
  velour_20x20_46:2050, velour_20x20_48:2100, velour_20x20_50:2150,
  // Велюр — 25×25
  velour_25x25_8:1290, velour_25x25_10:1365, velour_25x25_12:1445, velour_25x25_14:1525,
  velour_25x25_16:1605, velour_25x25_18:1685, velour_25x25_20:1765, velour_25x25_22:1840,
  velour_25x25_24:1925, velour_25x25_26:2010, velour_25x25_28:2095, velour_25x25_30:2175,
  velour_25x25_32:2255, velour_25x25_34:2335, velour_25x25_36:2415, velour_25x25_38:2495,
  velour_25x25_40:2575, velour_25x25_42:2655, velour_25x25_44:2735, velour_25x25_46:2820,
  velour_25x25_48:2905, velour_25x25_50:2990,
  // Велюр — 30×30
  velour_30x30_16:1700, velour_30x30_18:1790, velour_30x30_20:1880, velour_30x30_22:1970,
  velour_30x30_24:2060, velour_30x30_26:2150, velour_30x30_28:2240, velour_30x30_30:2330,
  velour_30x30_32:2420, velour_30x30_34:2510, velour_30x30_36:2600, velour_30x30_38:2690,
  velour_30x30_40:2780, velour_30x30_42:2875, velour_30x30_44:2970, velour_30x30_46:3065,
  velour_30x30_48:3160, velour_30x30_50:3255,
  // Друкована — 20×20
  printed_20x20_6:450, printed_20x20_8:500, printed_20x20_10:550, printed_20x20_12:600,
  printed_20x20_14:650, printed_20x20_16:700, printed_20x20_18:750, printed_20x20_20:800,
  printed_20x20_22:850, printed_20x20_24:900, printed_20x20_26:950, printed_20x20_28:1000,
  printed_20x20_30:1050, printed_20x20_32:1110, printed_20x20_34:1170, printed_20x20_36:1230,
  printed_20x20_38:1290, printed_20x20_40:1350, printed_20x20_42:1410, printed_20x20_44:1470,
  printed_20x20_46:1530, printed_20x20_48:1590, printed_20x20_50:1650,
  // Друкована — 20×30
  printed_20x30_10:740, printed_20x30_12:815, printed_20x30_14:890, printed_20x30_16:965,
  printed_20x30_18:1040, printed_20x30_20:1115, printed_20x30_22:1190, printed_20x30_24:1265,
  printed_20x30_26:1340, printed_20x30_28:1415, printed_20x30_30:1490, printed_20x30_32:1565,
  printed_20x30_34:1640, printed_20x30_36:1715, printed_20x30_38:1790, printed_20x30_40:1865,
  printed_20x30_42:1940, printed_20x30_44:2015, printed_20x30_46:2090, printed_20x30_48:2165,
  printed_20x30_50:2240,
  // Друкована — 30×20
  printed_30x20_10:740, printed_30x20_12:815, printed_30x20_14:890, printed_30x20_16:965,
  printed_30x20_18:1040, printed_30x20_20:1115, printed_30x20_22:1190, printed_30x20_24:1265,
  printed_30x20_26:1340, printed_30x20_28:1415, printed_30x20_30:1490, printed_30x20_32:1565,
  printed_30x20_34:1640, printed_30x20_36:1715, printed_30x20_38:1790, printed_30x20_40:1865,
  printed_30x20_42:1940, printed_30x20_44:2015, printed_30x20_46:2090, printed_30x20_48:2165,
  printed_30x20_50:2240,
  // Друкована — 25×25
  printed_25x25_8:700, printed_25x25_10:770, printed_25x25_12:845, printed_25x25_14:995,
  printed_25x25_16:1070, printed_25x25_18:1145, printed_25x25_20:1220, printed_25x25_22:1295,
  printed_25x25_24:1370, printed_25x25_26:1445, printed_25x25_28:1520, printed_25x25_30:1595,
  printed_25x25_32:1670, printed_25x25_34:1745, printed_25x25_36:1820, printed_25x25_38:1895,
  printed_25x25_40:1970, printed_25x25_42:2045, printed_25x25_44:2120, printed_25x25_46:2195,
  printed_25x25_48:2270, printed_25x25_50:2345,
  // Друкована — 30×30
  printed_30x30_16:1105, printed_30x30_18:1190, printed_30x30_20:1275, printed_30x30_22:1360,
  printed_30x30_24:1445, printed_30x30_26:1530, printed_30x30_28:1615, printed_30x30_30:1700,
  printed_30x30_32:1785, printed_30x30_34:1840, printed_30x30_36:1960, printed_30x30_38:2050,
  printed_30x30_40:2140, printed_30x30_42:2230, printed_30x30_44:2320, printed_30x30_46:2410,
  printed_30x30_48:2500, printed_30x30_50:2590,
};

const NEAREST_PAGES = [6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50];

function getCoverTypeKey(coverType: string): string {
  const ct = (coverType || '').toLowerCase();
  if (ct.includes('велюр') || ct.includes('velour')) return 'velour';
  if (ct.includes('тканин') || ct.includes('fabric')) return 'velour';
  if (ct.includes('шкір') || ct.includes('leather')) return 'velour';
  if (ct.includes('друков') || ct.includes('print')) return 'printed';
  return 'velour';
}

export function lookupPrice(
  coverType: string,
  sizeValue: string,
  pageCount: number,
  fallbackPrice = 0,
): number {
  const ctKey = getCoverTypeKey(coverType);
  const sizeKey = normalizeSizeKey(sizeValue);

  // Exact match
  const key = `${ctKey}_${sizeKey}_${pageCount}`;
  if (PHOTOBOOK_PRICES[key] !== undefined) return PHOTOBOOK_PRICES[key];

  // Nearest page count
  const closest = NEAREST_PAGES.reduce((prev, curr) =>
    Math.abs(curr - pageCount) < Math.abs(prev - pageCount) ? curr : prev
  );
  const fallbackKey = `${ctKey}_${sizeKey}_${closest}`;
  return PHOTOBOOK_PRICES[fallbackKey] ?? fallbackPrice;
}

export function calculateDynamicPrice(
  coverType: string,
  sizeValue: string,
  currentPageCount: number,
  basePageCountStr: string,
  fallbackPrice: number,
) {
  const sizeVal = normalizeSizeKey(sizeValue);
  const dynamicPrice = lookupPrice(coverType, sizeVal, currentPageCount, fallbackPrice);
  const basePageCount = parseInt(basePageCountStr.match(/\d+/)?.[0] || '20');
  const basePrice = lookupPrice(coverType, sizeVal, basePageCount, fallbackPrice);
  const priceDiff = dynamicPrice - basePrice;

  return { dynamicPrice, basePrice, priceDiff };
}
