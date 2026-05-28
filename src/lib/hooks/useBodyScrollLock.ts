import { useEffect } from 'react';

/**
 * Locks <body> scroll while `locked` is true, restoring the previous value on
 * unlock/unmount. Hand-rolled overlays (modals, sheets, lightbox) otherwise let
 * the page behind the backdrop scroll — jarring on touch. Native
 * `<dialog>.showModal()` gets this for free; these don't. Must be called
 * unconditionally (place it above any early `return null`).
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
