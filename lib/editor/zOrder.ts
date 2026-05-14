// z-order helpers for editor overlays (text, shapes, stickers, QR).
//
// All overlay types on a single page share one zIndex namespace via the
// optional `zOrder` field. Render layer is:
//
//   style.zIndex = Z_OVERLAY_BASE + (overlay.zOrder ?? 0)
//
// Where Z_OVERLAY_BASE sits above photo slots (zIndex 2) and below editor
// chrome like floating toolbars (zIndex 50+).
//
// `zOrder` is optional so saved projects from before this feature continue
// to render — undefined treated as 0, and creation order falls through to
// React key order.

export const Z_OVERLAY_BASE = 100;

interface Orderable {
    id: string;
    zOrder?: number;
}

// Returns a new array with the named item bumped one slot toward the viewer.
// If it's already on top, returns the array unchanged.
export function bringForward<T extends Orderable>(items: T[], id: string): T[] {
    const sorted = sortByZOrder(items);
    const idx = sorted.findIndex(i => i.id === id);
    if (idx === -1 || idx === sorted.length - 1) return items;
    // Swap zOrder with the next item up.
    const a = sorted[idx];
    const b = sorted[idx + 1];
    const aZ = a.zOrder ?? idx;
    const bZ = b.zOrder ?? idx + 1;
    return items.map(it => {
        if (it.id === a.id) return { ...it, zOrder: bZ };
        if (it.id === b.id) return { ...it, zOrder: aZ };
        return it;
    });
}

// Returns a new array with the named item bumped one slot away from the viewer.
export function sendBackward<T extends Orderable>(items: T[], id: string): T[] {
    const sorted = sortByZOrder(items);
    const idx = sorted.findIndex(i => i.id === id);
    if (idx <= 0) return items;
    const a = sorted[idx];
    const b = sorted[idx - 1];
    const aZ = a.zOrder ?? idx;
    const bZ = b.zOrder ?? idx - 1;
    return items.map(it => {
        if (it.id === a.id) return { ...it, zOrder: bZ };
        if (it.id === b.id) return { ...it, zOrder: aZ };
        return it;
    });
}

// Move the named item to the very top of its layer.
export function bringToFront<T extends Orderable>(items: T[], id: string): T[] {
    const max = items.reduce((m, it) => Math.max(m, it.zOrder ?? 0), 0);
    return items.map(it => it.id === id ? { ...it, zOrder: max + 1 } : it);
}

// Move the named item to the very bottom of its layer.
export function sendToBack<T extends Orderable>(items: T[], id: string): T[] {
    const min = items.reduce((m, it) => Math.min(m, it.zOrder ?? 0), 0);
    return items.map(it => it.id === id ? { ...it, zOrder: min - 1 } : it);
}

// Stable sort that treats missing zOrder as 0. Used both when rendering
// (so children appear in the right paint order) and when picking the
// neighbour to swap with in bringForward/sendBackward.
export function sortByZOrder<T extends Orderable>(items: T[]): T[] {
    return [...items].sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0));
}

// Assign a new zOrder for a newly created object so it sits on top of
// everything currently on the page. Pass the existing items array; returns
// max(zOrder) + 1.
export function nextZOrder<T extends Orderable>(items: T[]): number {
    if (!items.length) return 1;
    return items.reduce((m, it) => Math.max(m, it.zOrder ?? 0), 0) + 1;
}

// Compute zIndex for a rendered overlay element. Falls back to 0 when
// zOrder is missing on older saves.
export function zIndexFor(zOrder: number | undefined): number {
    return Z_OVERLAY_BASE + (zOrder ?? 0);
}
