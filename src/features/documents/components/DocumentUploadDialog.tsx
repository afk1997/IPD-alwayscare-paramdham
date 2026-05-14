'use client';
import { Button } from '@/components/ui/Button';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { DocumentUpload } from './DocumentUpload';

interface Props {
  animalId: string;
}

export function DocumentUploadDialog({ animalId }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Upload document
      </Button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 md:items-center">
          <div className="w-full max-w-md rounded-t-lg bg-paper p-6 shadow-2xl md:rounded-lg">
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
            <DocumentUpload animalId={animalId} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
