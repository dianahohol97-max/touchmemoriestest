'use client';

import { useRef, useCallback } from 'react';

//  Haptic Feedback 
export const haptic = {
  light:   () => { try { if ('vibrate' in navigator) navigator.vibrate(8);  } catch {} },
  medium:  () => { try { if ('vibrate' in navigator) navigator.vibrate(18); } catch {} },
  success: () => { try { if ('vibrate' in navigator) navigator.vibrate([10, 30, 10]); } catch {} },
  error:   () => { try { if ('vibrate' in navigator) navigator.vibrate([30, 20, 30]); } catch {} },
};

export interface PointerDragOptions {
  /**
   * МЕРТВА ЗОНА В ПІКСЕЛЯХ.
   *
   * Без неї перетягування починається з першого ж пікселя руху, тобто звичайний
   * клік мишею, під час якого рука сіпнулась, уже зсуває об'єкт. У конструкторі
   * це виглядало так, ніби клік по тексту «витягує» блок невідомо куди: людина
   * хотіла виділити підпис, а він від'їжджав, та ще й прилипав до найближчої
   * напрямної. Поки вказівник не відійшов далі за цю межу, нічого не рухається і
   * подія не гаситься, тож клік доходить до обробника як звичайний клік.
   *
   * Нуль або нічого означає старий режим без мертвої зони, і він лишається
   * усюди, де перетягування починається з ручки: за ручку хапають навмисно, і
   * там затримка на кілька пікселів лише заважає.
   */
  threshold?: number;
  /** Викликається один раз, коли перетягування справді почалося. */
  onDragStart?: () => void;
}

//  Unified pointer drag (mouse + touch + stylus)
export function startPointerDrag(
  e: React.PointerEvent,
  onMove: (dx: number, dy: number) => void,
  onEnd?: () => void,
  options?: PointerDragOptions,
) {
  const startX = e.clientX;
  const startY = e.clientY;
  const threshold = options?.threshold ?? 0;
  let started = threshold <= 0;
  // Capture pointer so drag continues even if finger leaves element
  try { (e.target as Element).setPointerCapture(e.pointerId); } catch {}
  // Block native touch scrolling for the duration of the drag so the page
  // doesn't pan under the finger while moving/resizing an object. This is the
  // reliable cross-browser guard (touch-action on the handle alone is flaky on iOS).
  const blockTouch = (te: TouchEvent) => { try { te.preventDefault(); } catch {} };
  const begin = () => {
    started = true;
    // Flag the drag globally so the editor canvas doesn't also swipe/scroll the
    // spread while an object (text, slot, handle) is being dragged on touch.
    try { (window as any).__tmObjectDragging = true; } catch {}
    window.addEventListener('touchmove', blockTouch, { passive: false });
    options?.onDragStart?.();
  };
  // Без мертвої зони все лишається як було: прапорець і блокування дотику
  // ставляться одразу на pointerdown.
  if (started) begin();
  const move = (pe: PointerEvent) => {
    const dx = pe.clientX - startX;
    const dy = pe.clientY - startY;
    if (!started) {
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      begin();
    }
    pe.preventDefault(); // prevent iOS scroll during drag
    onMove(dx, dy);
  };
  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    window.removeEventListener('touchmove', blockTouch);
    // Keep the dragging flag set through the synthetic click that fires right
    // after pointerup, so a control sitting under the release point (e.g. the
    // cover photo's × delete button) can ignore that click. Without this delay
    // the flag is already false by the time the click handler runs, and
    // releasing a slot-move over the delete button wiped the photo.
    //
    // Якщо перетягування так і не почалося (рух не вийшов за мертву зону), це
    // був звичайний клік, і позначати його як перетягування не можна — інакше
    // контроль під курсором проігнорує саме той клік, якого від нього чекали.
    if (started) {
      try { (window as any).__tmJustDragged = true; } catch {}
      setTimeout(() => { try { (window as any).__tmObjectDragging = false; (window as any).__tmJustDragged = false; } catch {} }, 50);
    }
    onEnd?.();
  };
  // passive:false required so preventDefault() works on iOS Safari
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

//  Long Press hook 
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
