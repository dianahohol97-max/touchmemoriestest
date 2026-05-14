import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react';

interface ZOrderToolbarProps {
    onBringForward: () => void;
    onSendBackward: () => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
    // Optional positioning offset relative to the selected overlay.
    // Default: floats above the overlay (top: -36).
    style?: React.CSSProperties;
}

// Floating mini-toolbar with 4 z-order buttons. Rendered as a sibling of
// the selected overlay's wrapper div. The wrapper is absolutely positioned
// already; this toolbar uses its own absolute positioning relative to that
// parent so it sticks to the top of the selected element.
//
// Buttons (left → right):
//   ⤓⤓ to back        (lowest zOrder on this page)
//   ↓  send backward  (swap with the overlay just behind)
//   ↑  bring forward  (swap with the overlay just in front)
//   ⤒⤒ to front       (highest zOrder on this page)
//
// Click handlers stopPropagation so the action doesn't bubble up to the
// canvas (which would deselect the overlay before we get to operate on it).
export function ZOrderToolbar({
    onBringForward, onSendBackward, onBringToFront, onSendToBack, style,
}: ZOrderToolbarProps) {
    const btnStyle: React.CSSProperties = {
        width: 26, height: 26, borderRadius: 4, border: 'none', background: 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
    };
    const stop = (e: React.MouseEvent | React.PointerEvent) => { e.stopPropagation(); e.preventDefault(); };
    return (
        <div
            onPointerDown={stop}
            onMouseDown={stop}
            onClick={stop}
            style={{
                position: 'absolute',
                top: -36,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 1,
                background: 'rgba(30, 45, 125, 0.92)',
                borderRadius: 6,
                padding: '2px 3px',
                zIndex: 9999,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                whiteSpace: 'nowrap',
                ...style,
            }}>
            <button title="На задній план" style={btnStyle}
                onClick={e => { stop(e); onSendToBack(); }}>
                <ChevronsDown size={16} />
            </button>
            <button title="Нижче" style={btnStyle}
                onClick={e => { stop(e); onSendBackward(); }}>
                <ChevronDown size={16} />
            </button>
            <button title="Вище" style={btnStyle}
                onClick={e => { stop(e); onBringForward(); }}>
                <ChevronUp size={16} />
            </button>
            <button title="На передній план" style={btnStyle}
                onClick={e => { stop(e); onBringToFront(); }}>
                <ChevronsUp size={16} />
            </button>
        </div>
    );
}
