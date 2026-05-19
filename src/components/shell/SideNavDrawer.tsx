'use client';
import { useEffect, useRef } from 'react';
import { SideNav } from './SideNav';

interface Props {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  user: { name: string; role: string };
}

export function SideNavDrawer({ open, onClose, isAdmin, user }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    node.addEventListener('cancel', onCancel);
    return () => node.removeEventListener('cancel', onCancel);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> handles Escape via its 'cancel' event, already wired above
    <dialog
      ref={dialogRef}
      aria-label="Navigation"
      className="m-0 h-full max-h-none w-[260px] max-w-[85vw] bg-transparent p-0 shadow-xl backdrop:bg-black/45"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div
        style={{ animation: 'slideInLeft 0.22s ease-out' }}
        className="h-full w-full"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <SideNav isAdmin={isAdmin} user={user} forceVisible />
      </div>
    </dialog>
  );
}
