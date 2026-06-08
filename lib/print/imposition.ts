// Shared print-imposition constants + geometry, used by the server-side sheet
// generator (lib/print/generate-sheets.ts). Counts-per-sheet mirror the
// product кратність: 5×7.5→12, 6×9→10, 7.5×10→8, 9×9→6, 10×10→6,
// polaroid 7.6×10.1→8, mini 8.6×5.4→10.

export const DPI = 300;
export const mmToPx = (mm: number) => Math.round((mm / 25.4) * DPI);
export const pxToMm = (px: number) => (px / DPI) * 25.4;

export interface PrintSize {
  id: string;
  wMm: number;
  hMm: number;
  perSheet: number;
}

export const PRINT_SIZES: PrintSize[] = [
  { id: '5x7.5',   wMm: 50,  hMm: 75,  perSheet: 12 },
  { id: '6x9',     wMm: 60,  hMm: 90,  perSheet: 10 },
  { id: '7.5x10',  wMm: 75,  hMm: 100, perSheet: 8 },
  { id: '9x9',     wMm: 90,  hMm: 90,  perSheet: 6 },
  { id: '10x10',   wMm: 100, hMm: 100, perSheet: 6 },
  { id: 'pol',     wMm: 76,  hMm: 101, perSheet: 8 },
  { id: 'polmini', wMm: 86,  hMm: 54,  perSheet: 10 },
];

const RECT_IDS = ['5x7.5', '6x9', '7.5x10', '9x9', '10x10'];
const POLAROID_IDS = ['pol', 'polmini'];

// Candidate sizes by the order_files.file_category. Magnets ('photomagnets')
// can be any size; standard photo prints are the rectangular set; the polaroid
// product only ships the two polaroid formats.
export function candidatesForCategory(category: string): PrintSize[] {
  if (category === 'polaroid-print') return PRINT_SIZES.filter(s => POLAROID_IDS.includes(s.id));
  if (category === 'photomagnets') return PRINT_SIZES;
  return PRINT_SIZES.filter(s => RECT_IDS.includes(s.id)); // photo-print + fallback
}

// Identify a print size from a rendered file's pixel dimensions (the file was
// produced at size_cm × 300dpi). Allows orientation swap; returns null when the
// file does not match any tile size within tolerance (e.g. large/standard
// prints that are not ganged onto a sheet).
export function detectSize(wPx: number, hPx: number, category: string): PrintSize | null {
  const wMm = pxToMm(wPx), hMm = pxToMm(hPx);
  let best: PrintSize | null = null;
  let bestErr = Infinity;
  for (const s of candidatesForCategory(category)) {
    const e1 = Math.abs(wMm - s.wMm) + Math.abs(hMm - s.hMm);
    const e2 = Math.abs(wMm - s.hMm) + Math.abs(hMm - s.wMm); // rotated
    const e = Math.min(e1, e2);
    if (e < bestErr) { bestErr = e; best = s; }
  }
  return bestErr <= 6 ? best : null; // within ~6mm total (3mm/side)
}

// Choose cols×rows for a count, preferring a landscape ~3:2 block (matches the
// ~30×20 cm reference sheet).
export function bestGrid(count: number, cellWmm: number, cellHmm: number): { cols: number; rows: number } {
  let best = { cols: count, rows: 1, score: Infinity };
  for (let rows = 1; rows <= count; rows++) {
    if (count % rows !== 0) continue;
    const cols = count / rows;
    const score = Math.abs((cols * cellWmm) / (rows * cellHmm) - 1.5);
    if (score < best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}
