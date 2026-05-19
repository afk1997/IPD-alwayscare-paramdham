'use client';
import { useCallback, useState } from 'react';

interface UseSwipeDownOptions {
  /** How far the user must drag down before release-triggered close (px). */
  threshold?: number;
  /** Called when the swipe-down crosses the threshold and ends. */
  onClose: () => void;
}

/**
 * Touch handler set for "drag a bottom sheet down to dismiss".  Pass the
 * returned `bind` props onto the sheet root and apply `style` (transform)
 * so the sheet follows the finger.
 *
 * Desktop / mouse users get no behavior change — only touch events are
 * wired up.
 */
export function useSwipeDown({ threshold = 80, onClose }: UseSwipeDownOptions) {
  const [startY, setStartY] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    setStartY(t.clientY);
    setDragY(0);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY === null) return;
      const t = e.touches[0];
      if (!t) return;
      // Only allow downward motion; upward stays at 0.
      const delta = Math.max(0, t.clientY - startY);
      setDragY(delta);
    },
    [startY],
  );

  const onTouchEnd = useCallback(() => {
    if (dragY > threshold) onClose();
    setStartY(null);
    setDragY(0);
  }, [dragY, threshold, onClose]);

  const style: React.CSSProperties =
    dragY > 0
      ? { transform: `translateY(${dragY}px)`, transition: 'none' }
      : { transition: 'transform 0.18s ease-out' };

  return {
    bind: { onTouchStart, onTouchMove, onTouchEnd },
    style,
    /** Useful for fading the backdrop as you drag. */
    progress: Math.min(1, dragY / threshold),
  };
}
