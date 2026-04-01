'use client';

import { useRef, useCallback } from 'react';

// ── Haptic Feedback ──────────────────────────────────────────────────────────
export const haptic = {
  light:   () => { try { if ('vibrate' in navigator) navigator.vibrate(8);  } catch {} },
  medium:  () => { try { if ('vibrate' in navigator) navigator.vibrate(18); } catch {} },
  success: () => { try { if ('vibrate' in navigator) navigator.vibrate([10, 30, 10]); } catch {} },
  error:   () => { try { if ('vibrate' in navigator) navigator.vibrate([30, 20, 30]); } catch {} },
};

// ── Unified pointer drag (mouse + touch + stylus) ────────────────────────────
export function startPointerDrag(
  e: React.PointerEvent,
  onMove: (dx: number, dy: number) => void,
  onEnd?: () => void,
) {
  const startX = e.clientX;
  const startY = e.clientY;
  // Capture pointer so drag continues even if finger leaves element
  try { (e.target as Element).setPointerCapture(e.pointerId); } catch {}
  const move = (pe: PointerEvent) => {
    pe.preventDefault(); // prevent iOS scroll during drag
    onMove(pe.clientX - startX, pe.clientY - startY);
  };
  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    onEnd?.();
  };
  // passive:false required so preventDefault() works on iOS Safari
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

// ── Long Press hook ──────────────────────────────────────────────────────────
export function useLongPress(
  onLongPress: (e: React.PointerEvent) => void,
  onPress?: (e: React.PointerEvent) => void,
  delay = 500,
) {
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef  = useRef(false);
  const startPos  = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    movedRef.current  = false;
    startPos.current  = { x: e.clientX, y: e.clientY };
    timerRef.current  = setTimeout(() => {
      if (!movedRef.current) { haptic.medium(); onLongPress(e); }
    }, delay);
  }, [onLongPress, delay]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPos.current) return;
    if (Math.abs(e.clientX - startPos.current.x) > 8 ||
        Math.abs(e.clientY - startPos.current.y) > 8) {
      movedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!movedRef.current) onPress?.(e);
    startPos.current = null;
  }, [onPress]);

  const onPointerCancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startPos.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
