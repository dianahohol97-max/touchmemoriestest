'use client';

import type { CSSProperties } from 'react';
import { Crop, RotateCcw, Trash2 } from 'lucide-react';
import type { SlotData } from '@/lib/editor/types';

/**
 * The floating toolbar над вибраним слотом з фото: масштаб, поворот,
 * скидання, видалення, перехід у режим редагування слота і перемикач
 * «без обрізки».
 *
 * Why this file exists
 * ────────────────────
 * This markup lived TWICE inside BookLayoutEditor.tsx — once for spread
 * layouts (~line 8481) and once for page layouts (~line 9279) — and
 * CLAUDE.md carried a standing instruction to remember to change both
 * whenever one was touched. That instruction was the bug report: by the time
 * they were merged the two copies had already drifted apart in four ways.
 *
 *   · the page copy clamped the bar horizontally (`shiftX`) so it stays on
 *     screen next to a slot near the page edge; the spread copy did not, so
 *     there the bar could hang off the canvas;
 *   · the page copy had a divider before «Слот» and a bolder degree label;
 *   · the spread copy still carried the comment explaining the rotation
 *     auto-zoom (commit 5f8fb96) — the page copy had the code but had lost
 *     the explanation;
 *   · the two «Слот» tooltips said different things.
 *
 * The merged markup follows the page copy — the extra divider and the bolder
 * degree label were improvements the spread copy simply never received, and
 * they are cosmetic, so adopting them everywhere is safe.
 *
 * `shiftX` is the exception: it is caller-supplied and the spread call site
 * does not compute one, so the spread bar is positioned exactly as it is
 * today. Giving it the same edge-clamping is now a small follow-up (the
 * spread scope has the slot box and canvas width it would need) rather than
 * something silently folded into a de-duplication.
 *
 * Deliberately NOT changed here: rotation does not push an undo entry, while
 * zoom, reset and the fit toggle do. That asymmetry exists in both copies
 * today. It looks like an oversight, but making rotation undoable is a
 * behaviour change and this commit is a de-duplication — mixing the two would
 * make the refactor impossible to review. Hence the `history` option below.
 */

/**
 * Only the fields this toolbar reads. Derived from the canonical SlotData so
 * it cannot drift from it, but kept narrow so a leaf component does not
 * depend on slot geometry it never touches.
 *
 * (This started life as a hand-written structural type, because when the
 * toolbar was extracted the shared SlotData in lib/editor/types.ts was a
 * stale 5-field version that did not describe the real slot.)
 */
export type ToolbarSlot = Partial<Pick<SlotData, 'zoom' | 'cropX' | 'cropY' | 'rotation' | 'fit'>>;

export interface SlotPhotoToolbarProps<S extends ToolbarSlot> {
    slot: S;
    /**
     * The slot's rendered box in px. Only the ratio is used: after a 90°/270°
     * turn the photo has to be re-zoomed to keep covering the slot, otherwise a
     * 4:3 photo leaves bars and appears to fly out of its frame.
     */
    slotBox: { width: number; height: number };
    /** Vertical placement, already resolved by the caller (above / below slot). */
    posStyle: CSSProperties;
    /** Horizontal nudge that keeps the bar inside the page near an edge. */
    shiftX?: number;
    isMobile: boolean;
    /**
     * Apply a change to this one slot. The caller owns the page/slot indexing
     * and the history push, so this component never touches editor state shape.
     * `history: false` for mutations that have never been undoable.
     */
    updateSlot: (fn: (sl: S) => S, opts?: { history?: boolean }) => void;
    onDelete: () => void;
    onOpenSlotEdit: () => void;
    /**
     * Tooltip for the «Слот» button. A prop rather than a constant because the
     * two original copies disagreed — spread said «Змінити форму або розмір
     * слота», page said «Змінити розмір слота — тягни кути» — and picking one
     * blindly would state something untrue in the other mode. Worth settling
     * once someone confirms whether shape editing is offered in both.
     */
    slotEditTitle: string;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/**
 * Re-zoom so a quarter-turned photo still covers the slot.
 *
 * Exported for tests: this is the only real arithmetic in the toolbar, and it
 * is the piece that regressed once before (commit 5f8fb96) — a 4:3 photo
 * rotated 90° left vertical bars and looked like it had flown out of frame.
 */
export function zoomAfterRotate(rotation: number, box: { width: number; height: number }): number {
    const isQuarter = rotation === 90 || rotation === 270;
    if (!isQuarter) return 1;
    const w = Number(box.width) || 100;
    const h = Number(box.height) || 100;
    return Math.max(w / h, h / w);
}

export function SlotPhotoToolbar<S extends ToolbarSlot>({
    slot,
    slotBox,
    posStyle,
    shiftX = 0,
    isMobile,
    updateSlot,
    onDelete,
    onOpenSlotEdit,
    slotEditTitle,
}: SlotPhotoToolbarProps<S>) {
    const zoomPct = Math.round((slot.zoom || 1) * 100);

    const rotateBy = (delta: 90 | -90) =>
        updateSlot(sl => {
            const rotation = (((sl.rotation || 0) + delta) % 360 + 360) % 360;
            return { ...sl, rotation, zoom: zoomAfterRotate(rotation, slotBox) };
        }, { history: false });

    const iconBtn: CSSProperties = {
        background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
        fontSize: 13, fontWeight: 700, padding: '2px 3px', touchAction: 'manipulation',
    };
    const pillBtn: CSSProperties = {
        border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 8px',
        borderRadius: 8, touchAction: 'manipulation', display: 'flex',
        alignItems: 'center', gap: 3,
    };
    const divider = <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.25)', margin: '0 3px' }} />;

    return (
        <div
            data-export-ignore="true"
            onMouseDown={stop}
            onClick={stop}
            style={{
                position: 'absolute', ...posStyle, left: '50%',
                transform: `translateX(calc(-50% + ${shiftX}px))`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: 'rgba(0,0,0,0.82)', borderRadius: 12, padding: '4px 6px', zIndex: 60,
                whiteSpace: isMobile ? 'normal' : 'nowrap',
                maxWidth: isMobile ? 'calc(100vw - 16px)' : undefined,
            }}
        >
            {/* Row 1: zoom + rotate + delete */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: isMobile ? 'wrap' : 'nowrap', justifyContent: 'center' }}>
                <button
                    onClick={stop}
                    onPointerDown={e => { stop(e); updateSlot(sl => ({ ...sl, zoom: Math.max(0.1, (sl.zoom || 1) - 0.1) })); }}
                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: '2px 7px', borderRadius: 6, touchAction: 'manipulation', fontWeight: 700, minWidth: 28, textAlign: 'center' }}
                >−</button>
                <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{zoomPct}%</span>
                <button
                    onClick={stop}
                    onPointerDown={e => { stop(e); updateSlot(sl => ({ ...sl, zoom: Math.min(4, (sl.zoom || 1) + 0.1) })); }}
                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: '2px 7px', borderRadius: 6, touchAction: 'manipulation', fontWeight: 700, minWidth: 28, textAlign: 'center' }}
                >+</button>

                {divider}

                <button
                    title="Скинути все: масштаб, кадр, поворот"
                    onClick={stop}
                    onPointerDown={e => { stop(e); updateSlot(sl => ({ ...sl, zoom: 1, cropX: 50, cropY: 50, rotation: 0 })); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: '2px 6px', touchAction: 'manipulation', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                    <RotateCcw size={11} />
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Скинути</span>
                </button>

                {divider}

                <button onClick={stop} onPointerDown={e => { stop(e); rotateBy(-90); }} style={iconBtn} title="Повернути -90°">↶</button>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{slot.rotation || 0}°</span>
                <button onClick={stop} onPointerDown={e => { stop(e); rotateBy(90); }} style={iconBtn} title="Повернути +90°">↷</button>

                {divider}

                <button
                    onClick={stop}
                    onPointerDown={e => { stop(e); onDelete(); }}
                    title="Видалити фото зі слота"
                    style={{ ...pillBtn, background: 'rgba(239,68,68,0.85)' }}
                >
                    <Trash2 size={11} />
                    <span style={{ fontSize: 9, fontWeight: 700 }}>Видалити</span>
                </button>

                {divider}

                <button
                    onClick={stop}
                    onPointerDown={e => { stop(e); onOpenSlotEdit(); }}
                    title={slotEditTitle}
                    style={{ ...pillBtn, background: 'rgba(59,130,246,0.85)' }}
                >
                    <Crop size={11} />
                    <span style={{ fontSize: 9, fontWeight: 700 }}>Слот</span>
                </button>

                <button
                    onClick={stop}
                    onPointerDown={e => {
                        stop(e);
                        updateSlot(sl => (sl.fit === 'contain'
                            ? { ...sl, fit: 'cover' as const }
                            : { ...sl, fit: 'contain' as const, zoom: 1, cropX: 50, cropY: 50 }));
                    }}
                    title="Показати фото повністю, без обрізки під форму слота"
                    style={{ ...pillBtn, background: slot.fit === 'contain' ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.15)' }}
                >
                    <span style={{ fontSize: 9, fontWeight: 700 }}>{slot.fit === 'contain' ? 'Повністю' : 'Без обрізки'}</span>
                </button>
            </div>
        </div>
    );
}

export default SlotPhotoToolbar;
