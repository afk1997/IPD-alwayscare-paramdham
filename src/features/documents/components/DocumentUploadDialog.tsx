'use client';
import { Button } from '@/components/ui/Button';
import { useActiveUsers } from '@/features/users/ActiveUsersContext';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DocumentRow } from '../actions';
import { DocumentUpload } from './DocumentUpload';

interface Props {
  animalId: string;
  onCreated: (doc: DocumentRow) => void;
}

export function DocumentUploadDialog({ animalId, onCreated }: Props) {
  const { currentUserRole } = useActiveUsers();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  // UI-12: Escape closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // VIEWER never sees the upload button — server-side document.create
  // would reject the write anyway, but the UI shouldn't dangle a CTA
  // that can't succeed.  Early-return AFTER all hooks so the hook count
  // stays constant across renders (Rules of Hooks).
  if (currentUserRole === 'VIEWER') return null;

  const handleSaved = (doc: DocumentRow) => {
    onCreated(doc);
    setOpen(false);
  };
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Upload document
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center md:items-center"
          aria-modal="true"
          aria-label="Upload document"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/45"
          />
          <div
            ref={dialogRef}
            className="relative z-10 w-full max-w-md rounded-t-lg bg-paper p-6 shadow-2xl md:rounded-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Upload document</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-paper-2"
              >
                <X size={16} />
              </button>
            </div>
            <DocumentUpload animalId={animalId} onDone={handleSaved} onCancel={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
