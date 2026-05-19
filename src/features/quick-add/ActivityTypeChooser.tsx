'use client';
import { ACTIVITY_LABELS, type ActivityType } from '@/features/activities/schema';
import {
  Bath,
  Footprints,
  type LucideIcon,
  Microscope,
  Pill,
  Salad,
  Scissors,
  Stethoscope,
} from 'lucide-react';

type SelectableType = Exclude<ActivityType, 'ADMISSION'>;

const SELECTABLE: SelectableType[] = ['TREATMENT', 'ROUND', 'DIAGNOSTIC', 'SURGERY', 'FOOD', 'BATH', 'WALK'];

const ICONS: Record<SelectableType, LucideIcon> = {
  TREATMENT: Pill,
  ROUND: Stethoscope,
  DIAGNOSTIC: Microscope,
  SURGERY: Scissors,
  FOOD: Salad,
  BATH: Bath,
  WALK: Footprints,
};

interface Props {
  onPick: (type: ActivityType) => void;
}

export function ActivityTypeChooser({ onPick }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {SELECTABLE.map((t) => {
        const Icon = ICONS[t];
        return (
          <button
            type="button"
            key={t}
            onClick={() => onPick(t)}
            className="flex flex-col items-center gap-2 rounded-xl border border-line bg-paper p-4 font-medium text-sm transition hover:border-accent hover:bg-accent-soft"
          >
            <Icon size={20} className="text-accent" />
            {ACTIVITY_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}
