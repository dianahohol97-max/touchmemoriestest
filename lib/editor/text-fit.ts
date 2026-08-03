'use client';

/**
 * Auto-fit for text blocks in the shared page layout.
 *
 * Why this exists — TM-001108, page 9. Four text blocks, anchored at y = 13.1,
 * 27.8, 47.1 and 78.7 % of the page. Each block is positioned absolutely with
 * `transform: translate(-50%,-50%)`, so it is CENTRED on its anchor and grows
 * both upward and downward as the text gets longer. Nothing bounds that growth
 * and no block knows its neighbours exist, so the 234- and 390-character blocks
 * simply ran over the ones above them: «Від Тата:» printed on top of the intro
 * paragraph, «Від Мами:» on top of the father's signature.
 *
 * It was NOT a print bug. The editor and the print page render text with the
 * same rules — same centre anchor, same `maxWidth: 90%`, same
 * `fontSize * (cH / 700)` scale, same padding — so the customer saw exactly what
 * she got. Moving the anchors apart (tried once) cannot help either: it changes
 * where blocks start, not how tall they are.
 *
 * The fix is to make the type smaller only when it would otherwise collide, and
 * to do it identically in both places — hence one module, imported by both.
 *
 * Measurement is done with canvas measureText rather than by measuring the DOM.
 * That is deliberate: it is a pure synchronous function, so it drops into the
 * existing render of both components with no refs, no layout effects and no
 * measure-then-re-render loop. It approximates wrapping, but it approximates it
 * the SAME way on both sides, which is the property that actually matters — the
 * editor and the print file must agree.
 */

/** Page-relative bounds a block is allowed to live inside, in % of page height. */
const PAGE_TOP_PCT = 2;
const PAGE_BOTTOM_PCT = 98;

/** Never shrink past this — below it the text stops being the customer's design. */
const MIN_SCALE = 0.55;

/**
 * Line box as a multiple of font size.
 *
 * Exported and applied as an explicit `lineHeight` by BOTH renderers, which is
 * the point: left to the browser default ('normal'), the real line box depends
 * on the font's own metrics, so the height this module computes and the height
 * the browser actually lays out would differ — and the fit would quietly
 * under-shrink, leaving exactly the overlap it was added to remove. Pinning it
 * makes the calculation and the rendering agree by construction.
 */
export const TEXT_LINE_HEIGHT = 1.25;
const LINE_HEIGHT = TEXT_LINE_HEIGHT;

/**
 * Vertical room a centre-anchored block may occupy, in % of page height.
 *
 * Blocks are centred on their anchor, so a block of height h reaches h/2 up and
 * h/2 down. Two neighbours anchored g apart therefore fit iff h1/2 + h2/2 <= g.
 * Giving every block the smaller of its two gaps satisfies that for every pair
 * at once, without any block needing to know how tall its neighbour turned out —
 * which is what keeps this a pure function of the saved layout.
 */
export function availableHeightPct(y: number, allAnchorsY: number[]): number {
  const below = allAnchorsY.filter(o => o > y).sort((a, b) => a - b)[0];
  const above = allAnchorsY.filter(o => o < y).sort((a, b) => b - a)[0];
  // How far the block may reach on each side. Against a NEIGHBOUR it gets half
  // the gap, because the neighbour is coming the other way and needs the other
  // half. Against the page EDGE it gets the whole distance — there is nothing
  // there to share with. Conflating the two was wrong in the first cut: it made
  // a heading near the top of the page shrink for no reason, even though it was
  // nowhere near colliding with anything.
  const halfUp = above === undefined ? y - PAGE_TOP_PCT : (y - above) / 2;
  const halfDown = below === undefined ? PAGE_BOTTOM_PCT - y : (below - y) / 2;
  return Math.max(4, 2 * Math.min(halfUp, halfDown));
}

let measureCtx: CanvasRenderingContext2D | null = null;
function ctx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/** Greedy wrap, matching `whiteSpace: pre-wrap` + `wordBreak: break-word`:
 *  explicit newlines are kept, and long words are allowed to overflow rather
 *  than being split (splitting would only ever make the count smaller). */
function countLines(text: string, fontPx: number, fontFamily: string, bold: boolean, italic: boolean, maxWidthPx: number): number {
  const c = ctx();
  if (!c || maxWidthPx <= 0) return Math.max(1, String(text || '').split('\n').length);
  c.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${fontPx}px ${fontFamily || 'serif'}`;
  let lines = 0;
  for (const paragraph of String(text || '').split('\n')) {
    if (!paragraph) { lines += 1; continue; }
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines += 1; continue; }
    let current = '';
    let used = 1;
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (c.measureText(candidate).width <= maxWidthPx || !current) {
        current = candidate;
      } else {
        used += 1;
        current = w;
      }
    }
    lines += used;
  }
  return Math.max(1, lines);
}

export interface FitInput {
  text: string;
  /** Font size already scaled to this page's pixels (i.e. fontSize * cH / 700). */
  fontPx: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
  /** Usable text width in px — the same 90% max-width both renderers apply. */
  maxWidthPx: number;
  /** Room this block may occupy, in px (availableHeightPct × page height). */
  availableHeightPx: number;
}

/**
 * Multiplier to apply to fontPx so the block fits its slot. Returns exactly 1
 * when it already fits, so a layout with no collisions renders byte-identically
 * to before — existing designs and already-approved books are untouched, and
 * only the ones that were overlapping change.
 */
export function fitFontScale(input: FitInput): number {
  const { text, fontPx, fontFamily, bold, italic, maxWidthPx, availableHeightPx } = input;
  if (!text || fontPx <= 0 || availableHeightPx <= 0 || maxWidthPx <= 0) return 1;

  const heightAt = (scale: number) =>
    countLines(text, fontPx * scale, fontFamily, !!bold, !!italic, maxWidthPx) * fontPx * scale * LINE_HEIGHT;

  if (heightAt(1) <= availableHeightPx) return 1;

  // Binary search the largest scale that fits. Height is monotone in scale
  // (smaller type never needs more lines), so this converges cleanly, and the
  // fixed iteration count keeps it cheap enough to run during render.
  let lo = MIN_SCALE;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (heightAt(mid) <= availableHeightPx) lo = mid; else hi = mid;
  }
  return Math.max(MIN_SCALE, Math.min(1, lo));
}
