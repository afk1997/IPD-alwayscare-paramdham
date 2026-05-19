'use client';
import type { ActivityType } from '@/features/activities/schema';
import { type QuickAddPrefill, useQuickAdd } from '@/features/quick-add/QuickAddProvider';
import { type LucideIcon, Pill, Plus, Salad, Stethoscope } from 'lucide-react';

interface ActionTile {
  label: string;
  icon: LucideIcon;
  prefill: QuickAddPrefill;
  color: string;
  tint: string;
}

const TILES: ActionTile[] = [
  {
    label: 'New admission',
    icon: Plus,
    prefill: { action: 'admission' },
    color: '#0E7C7B',
    tint: '#D6EEEE',
  },
  {
    label: 'Log treatment',
    icon: Pill,
    prefill: { action: 'activity', activityType: 'TREATMENT' as ActivityType },
    color: '#2563EB',
    tint: '#DBE7FF',
  },
  {
    label: 'Doctor round',
    icon: Stethoscope,
    prefill: { action: 'activity', activityType: 'ROUND' as ActivityType },
    color: '#7C3AED',
    tint: '#EADDFF',
  },
  {
    label: 'Food & water',
    icon: Salad,
    prefill: { action: 'activity', activityType: 'FOOD' as ActivityType },
    color: '#15803D',
    tint: '#DCFAE6',
  },
];

export function QuickActions() {
  const { open } = useQuickAdd();
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {TILES.map((t) => {
        const Icon = t.icon;
        return (
          <button
            type="button"
            key={t.label}
            onClick={() => open(t.prefill)}
            className="flex items-center gap-2.5 rounded-2xl border border-line bg-paper px-3.5 py-3 text-left transition hover:border-accent hover:bg-paper-2"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: t.tint, color: t.color }}
            >
              <Icon size={17} strokeWidth={2.2} />
            </span>
            <span className="font-display font-semibold text-[13.5px] leading-tight">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
