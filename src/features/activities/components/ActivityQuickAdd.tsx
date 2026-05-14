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
      <div className="w-full max-w-lg rounded-t-lg bg-paper p-6 shadow-2xl md:rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
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
                  className="flex flex-col items-center gap-2 rounded-lg border border-line bg-paper p-4 text-sm font-medium hover:border-accent hover:bg-accent-soft"
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
  );
}
