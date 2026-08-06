/**
 * Every conversion from a SAVED design size to on-screen or print pixels.
 *
 * ─── Why this file exists ────────────────────────────────────────────────────
 *
 * A design stores plain numbers: «напис 45», «текстовий блок 28». A number is
 * meaningless on its own — it only says anything next to the canvas it was
 * authored against. The editor and the print renderer are two different
 * canvases (a 460 px preview and a 300-DPI sheet thousands of px wide), so each
 * one has to convert. Every time that conversion lived at the call site, the
 * two drifted apart, and the customer got a book that did not match what they
 * arranged:
 *
 *   • the cover inscription was drawn raw in the editor and via a `/700` factor
 *     in print — two different sizes, neither matching the other, and the
 *     editor's one changed with the zoom level;
 *   • the cover template blocks («HAPPY BIRTHDAY», TM-001140) were drawn raw in
 *     BOTH — microscopic on the print sheet, zoom-dependent in the editor;
 *   • kalka text used `pageW / 400` in the editor and a flat `× 0.85` in print;
 *   • the wishbook server render invented its own `/700` against the cover
 *     SHEET while the editor measured the PAGE.
 *
 * Each was found and fixed separately, weeks apart, by a customer noticing a
 * wrong book. They are one bug.
 *
 * ─── The rule ────────────────────────────────────────────────────────────────
 *
 * A stored size is px on a REFERENCE canvas. To draw it anywhere, scale by
 * (this canvas ÷ the reference canvas) in the SAME dimension. Nothing may
 * convert by any other route, and no renderer may invent a factor of its own.
 *
 * The reference bases below are historical: they are whatever the values in the
 * database were authored against. They are deliberately NOT unified into one
 * number, because changing a base silently resizes every design already saved
 * in a cart or an order. Unify the derivation, not the constant.
 *
 * ─── Adding a new kind of element ────────────────────────────────────────────
 *
 * Add its base here, export a scale helper next to the others, and call that
 * helper from BOTH the editor component and BookPreviewModal. If you find
 * yourself writing a division by a literal inside a component, that is this bug
 * coming back.
 */

/**
 * The cover canvas in CoverEditor at 100 % zoom (`baseH` in
 * getCanvasDimensions). It stands for the PAGE height — the same reference the
 * decoration plate is measured against. Used by the cover inscription, the
 * printed-cover template blocks and the extra inscriptions.
 */
export const EDITOR_BASE_CANVAS_H = 460;

/** Page text blocks are authored against a 700 px-tall page. */
export const PAGE_TEXT_BASE_H = 700;

/** Kalka text is authored against a 400 px-wide page — width, not height. */
export const KALKA_TEXT_BASE_W = 400;

/**
 * Scale for anything stored on the COVER canvas.
 *
 * `canvasPxPerMm` is the drawing surface's own resolution. It cannot be derived
 * from pixels alone: in print the cover canvas spans the full sheet — page plus
 * fold-in, e.g. 238 mm against a 200 mm page on a 30×20 — so a bare pixel ratio
 * silently compares two different physical areas. That mistake alone printed
 * every velour inscription about a quarter too small.
 */
export function coverTextScale(canvasPxPerMm: number, pageHeightMm: number): number {
  if (!(canvasPxPerMm > 0) || !(pageHeightMm > 0)) return 1;
  return canvasPxPerMm / (EDITOR_BASE_CANVAS_H / pageHeightMm);
}

/** Scale for page text blocks, from the canvas height in px. */
export function pageTextScale(canvasHeightPx: number): number {
  if (!(canvasHeightPx > 0)) return 1;
  return canvasHeightPx / PAGE_TEXT_BASE_H;
}

/** Scale for kalka text, from the page WIDTH in px. */
export function kalkaTextScale(pageWidthPx: number): number {
  if (!(pageWidthPx > 0)) return 1;
  return pageWidthPx / KALKA_TEXT_BASE_W;
}
