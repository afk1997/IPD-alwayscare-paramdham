'use client';
import { Button } from '@/components/ui/Button';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import {
  Bath,
  Footprints,
  type LucideIcon,
  Microscope,
  Pill,
  Salad,
  Scissors,
  Stethoscope,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ACTIVITY_LABELS, type ActivityType } from '../schema';
import { ActivityForm } from './ActivityForm';

const ICONS: Partial<Record<ActivityType, LucideIcon>> = {
  TREATMENT: Pill,
  ROUND: Stethoscope,
  DIAGNOSTIC: Microscope,
  SURGERY: Scissors,
  FOOD: Salad,
  BATH: Bath,
  WALK: Footprints,
};

const SELECTABLE: ActivityType[] = ['TREATMENT', 'ROUND', 'DIAGNOSTIC', 'SURGERY', 'FOOD', 'BATH', 'WALK'];

interface Props {
  animalId: string;
  open: boolean;
  onClose: () => void;
}

export function ActivityQuickAdd({ animalId, open, onClose }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ActivityType | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  // UI-11: Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // After a successful save: close the modal, reset the type, AND
  // router.refresh() so the patient page's ActivityTimeline picks up
  // the new row immediately.  Without the refresh the user has to
  // navigate away and back to see what they just logged.
  const handleSaved = () => {
    setSelected(null);
    onClose();
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center md:items-center"
      aria-modal="true"
      aria-label={selected ? ACTIVITY_LABELS[selected] : 'Log activity'}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => {
          setSelected(null);
          onClose();
        }}
        className="absolute inset-0 cursor-default bg-black/45"
      />
      {/* Cap the dialog at 92vh and let the body scroll.  Without this the
          Surgery form (10+ fields + uploader) overflows the viewport and
          the title / save button get clipped on small laptops. */}
      <div
        ref={dialogRef}
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-lg bg-paper shadow-2xl md:rounded-lg"
      >
        {/* Sticky header — title + close stay pinned while the form scrolls. */}
        <div className="flex shrink-0 items-center justify-between border-line border-b px-6 py-4">
          <h2 className="font-display font-bold text-lg">
            {selected ? ACTIVITY_LABELS[selected] : 'Log activity'}
          </h2>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              onClose();
            }}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-paper-2"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {selected ? (
            <ActivityForm animalId={animalId} type={selected} onDone={handleSaved} />
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {SELECTABLE.map((t) => {
                const Icon = ICONS[t];
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setSelected(t)}
                    className="flex flex-col items-center gap-2 rounded-lg border border-line bg-paper p-4 font-medium text-sm hover:border-accent hover:bg-accent-soft"
                  >
                    {Icon && <Icon size={20} className="text-accent" />}
                    {ACTIVITY_LABELS[t]}
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <div className="mt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
                ← Pick a different type
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
