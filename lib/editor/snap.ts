/**
 * Canva-style snap-to-align helper for the slot editor.
 *
 * During a slot move/resize, the user expects the edges that are CHANGING to
 * snap onto:
 *   - other slot edges (left/right/centerX, top/bottom/centerY)
 *   - canvas edges + canvas centerlines
 *
 * Returns the snapped rect plus a list of guide lines to draw at the snap
 * points so the user gets visual feedback ("you're now aligned to the
 * neighbour's left edge").
 *
 * Threshold is 6px in canvas-space — small enough to avoid accidental
 * snapping but large enough to feel sticky during a normal drag.
 */

export interface SnapTarget {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SnapResult {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Vertical guide lines to render (x position in canvas-space). */
  guidesV: number[];
  /** Horizontal guide lines to render (y position in canvas-space). */
  guidesH: number[];
}

const THRESHOLD = 6;

/**
 * Compute the candidate snap positions on each axis. We snap anywhere two
 * rectangles share an X (or Y) coordinate — same left, same right, or matching
 * center.
 */
function buildAxisTargets(
  others: SnapTarget[],
  canvasSize: number,
): number[] {
  const out: number[] = [0, canvasSize / 2, canvasSize];
  for (const o of others) {
    out.push(o.left);
    out.push(o.left + o.width);
    out.push(o.left + o.width / 2);
  }
  return out;
}

function buildAxisTargetsY(
  others: SnapTarget[],
  canvasSize: number,
): number[] {
  const out: number[] = [0, canvasSize / 2, canvasSize];
  for (const o of others) {
    out.push(o.top);
    out.push(o.top + o.height);
    out.push(o.top + o.height / 2);
  }
  return out;
}

/**
 * Snap the closest target within THRESHOLD. Returns the snapped value and
 * the target if a snap happened, otherwise the original value and null.
 */
function snapAxis(value: number, targets: number[]): { snapped: number; target: number | null } {
  let best: number | null = null;
  let bestDist = THRESHOLD;
  for (const t of targets) {
    const d = Math.abs(value - t);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best === null ? { snapped: value, target: null } : { snapped: best, target: best };
}

/**
 * Apply snapping to a rect being moved or resized.
 *
 * `mode` tells us which corners/sides are moving so we only snap edges the
 * user is actually dragging:
 *   - 'move' — left, right, top, bottom, centerX, centerY all snap
 *   - 'se'   — right + bottom + centerX/Y once they shift
 *   - 'sw'   — left + bottom
 *   - 'ne'   — right + top
 *   - 'nw'   — left + top
 *
 * The implementation picks the dominant snap on each axis (left or right,
 * not both) since snapping both would over-constrain the rect.
 */
export function applySnap(
  rect: { x: number; y: number; w: number; h: number },
  others: SnapTarget[],
  canvasW: number,
  canvasH: number,
  mode: 'move' | 'se' | 'sw' | 'ne' | 'nw',
): SnapResult {
  const xTargets = buildAxisTargets(others, canvasW);
  const yTargets = buildAxisTargetsY(others, canvasH);

  let { x, y, w, h } = rect;
  const guidesV: number[] = [];
  const guidesH: number[] = [];

  // X axis ─────────────────────────────────────────
  // For 'move' we snap left, right, OR center, choosing the closest.
  // For corner resize, only the moving edge is eligible.
  if (mode === 'move') {
    const left = snapAxis(x, xTargets);
    const right = snapAxis(x + w, xTargets);
    const center = snapAxis(x + w / 2, xTargets);
    // Pick the candidate with the smallest residual.
    const cand = [
      { delta: left.target !== null ? left.snapped - x : Infinity, line: left.target },
      { delta: right.target !== null ? right.snapped - (x + w) : Infinity, line: right.target },
      { delta: center.target !== null ? center.snapped - (x + w / 2) : Infinity, line: center.target },
    ].sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
    if (cand.line !== null && Math.abs(cand.delta) < THRESHOLD) {
      x += cand.delta;
      guidesV.push(cand.line);
    }
  } else if (mode === 'sw' || mode === 'nw') {
    // Left edge is moving.
    const left = snapAxis(x, xTargets);
    if (left.target !== null) {
      const newW = w + (x - left.snapped);
      if (newW >= 40) { w = newW; x = left.snapped; guidesV.push(left.target); }
    }
  } else if (mode === 'se' || mode === 'ne') {
    // Right edge is moving.
    const right = snapAxis(x + w, xTargets);
    if (right.target !== null) {
      const newW = right.snapped - x;
      if (newW >= 40) { w = newW; guidesV.push(right.target); }
    }
  }

  // Y axis ─────────────────────────────────────────
  if (mode === 'move') {
    const top = snapAxis(y, yTargets);
    const bottom = snapAxis(y + h, yTargets);
    const center = snapAxis(y + h / 2, yTargets);
    const cand = [
      { delta: top.target !== null ? top.snapped - y : Infinity, line: top.target },
      { delta: bottom.target !== null ? bottom.snapped - (y + h) : Infinity, line: bottom.target },
      { delta: center.target !== null ? center.snapped - (y + h / 2) : Infinity, line: center.target },
    ].sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
    if (cand.line !== null && Math.abs(cand.delta) < THRESHOLD) {
      y += cand.delta;
      guidesH.push(cand.line);
    }
  } else if (mode === 'ne' || mode === 'nw') {
    // Top edge is moving.
    const top = snapAxis(y, yTargets);
    if (top.target !== null) {
      const newH = h + (y - top.snapped);
      if (newH >= 40) { h = newH; y = top.snapped; guidesH.push(top.target); }
    }
  } else if (mode === 'se' || mode === 'sw') {
    // Bottom edge is moving.
    const bottom = snapAxis(y + h, yTargets);
    if (bottom.target !== null) {
      const newH = bottom.snapped - y;
      if (newH >= 40) { h = newH; guidesH.push(bottom.target); }
    }
  }

  return { x, y, w, h, guidesV, guidesH };
}
