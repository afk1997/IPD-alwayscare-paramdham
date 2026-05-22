'use client';
import { useCallback, useState } from 'react';

interface UseSwipeHorizontalOptions {
  /** How far the user must drag before release fires (px). */
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Touch handlers for horizontal swipe gestures (lightbox prev/next).
 * Stays neutral on mouse / pointer events.
 */
export function useSwipeHorizontal({ threshold = 60, onSwipeLeft, onSwipeRight }: UseSwipeHorizontalOptions) {
  const [startX, setStartX] = useState<number | null>(null);
  const [startY, setStartY] = useState<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    setStartX(t.clientX);
    setStartY(t.clientY);
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startX === null || startY === null) return;
      const t = e.changedTouches[0];
      if (!t) {
        setStartX(null);
        setStartY(null);
        return;
      }
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // Only treat as horizontal swipe if X movement dominates Y.
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx < 0) onSwipeLeft?.();
        else onSwipeRight?.();
      }
      setStartX(null);
      setStartY(null);
    },
    [startX, startY, threshold, onSwipeLeft, onSwipeRight],
  );

  return { bind: { onTouchStart, onTouchEnd } };
}
