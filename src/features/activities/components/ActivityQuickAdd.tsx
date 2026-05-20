'use client';
import { Button } from '@/components/ui/Button';
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
import { useState } from 'react';
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
  const [selected, setSelected] = useState<ActivityType | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 md:items-center">
      {/* Cap the dialog at 92vh and let the body scroll.  Without this the
          Surgery form (10+ fields + uploader) overflows the viewport and
          the title / save button get clipped on small laptops. */}
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-lg bg-paper shadow-2xl md:rounded-lg">
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
            <ActivityForm
              animalId={animalId}
              type={selected}
              onDone={() => {
                setSelected(null);
                onClose();
              }}
            />
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
