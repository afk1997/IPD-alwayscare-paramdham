'use client';
import { Button } from '@/components/ui/Button';
import { ActivityQuickAdd } from '@/features/activities/components/ActivityQuickAdd';
import { LogOut, MoreHorizontal, Pencil, Plus, Skull } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PatientShareButton } from './PatientShareButton';

interface Props {
  animalId: string;
}

export function AnimalDetailActions({ animalId }: Props) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      <Button size="sm" onClick={() => setQuickOpen(true)}>
        <Plus size={14} />
        Log activity
      </Button>
      <PatientShareButton animalId={animalId} />
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="More actions"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-paper text-muted hover:bg-paper-2"
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-11 z-30 flex w-48 flex-col rounded-lg border border-line bg-paper p-1 shadow-xl">
          <Link
            href={`/patients/${animalId}/edit`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-paper-2"
          >
            <Pencil size={14} />
            Edit details
          </Link>
          <Link
            href={`/patients/${animalId}/discharge`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-paper-2"
          >
            <LogOut size={14} />
            Discharge
          </Link>
          <Link
            href={`/patients/${animalId}/death`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded px-2.5 py-2 text-sm text-critical hover:bg-paper-2"
          >
            <Skull size={14} />
            Record death
          </Link>
        </div>
      )}
      <ActivityQuickAdd animalId={animalId} open={quickOpen} onClose={() => setQuickOpen(false)} />
    </div>
  );
}
