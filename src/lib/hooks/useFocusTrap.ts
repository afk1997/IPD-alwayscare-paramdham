'use client';
import { type RefObject, useEffect } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function listFocusables(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
}

function nextFocusTarget(node: HTMLElement, shiftKey: boolean): HTMLElement | null {
  const items = listFocusables(node);
  if (items.length === 0) return null;
  const firstEl = items[0] ?? null;
  const lastEl = items[items.length - 1] ?? null;
  const current = document.activeElement as HTMLElement | null;
  const outOfTrap = !current || !node.contains(current);
  if (shiftKey) {
    return outOfTrap || current === firstEl ? lastEl : null;
  }
  return outOfTrap || current === lastEl ? firstEl : null;
}

// Focus management for dialogs / sheets.  Stores the previously-focused
// element on mount, focuses the first focusable child, traps Tab cycling
// inside `ref`, and restores focus to the trigger on unmount.
//
// Pass `active=false` when the dialog is closed — without it the trap
// captures Tab on the rest of the app.
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;

    const first = listFocusables(node)[0];
    if (first) first.focus();
    else if (node.tabIndex >= 0) node.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !node) return;
      const target = nextFocusTarget(node, e.shiftKey);
      if (target === null) return;
      e.preventDefault();
      target.focus();
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus to the element that opened the dialog so keyboard
      // users don't get dumped at the top of the page.
      if (previous && document.body.contains(previous)) previous.focus();
    };
  }, [ref, active]);
}
