import { getCachedTodayCounts } from '@/features/animals/queries';
import { ThemeSwitcher } from '@/features/settings/components/ThemeSwitcher';
import { getThemeFromCookie } from '@/lib/theme';
import { CheckCircle2, type LucideIcon, Plus, Scissors, Skull } from 'lucide-react';
import { cookies } from 'next/headers';
import { NeedsAttention } from './NeedsAttention';

interface Tile {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  tint: string;
}

export async function TodayDashboard() {
  const [theme, counts] = await Promise.all([cookies().then(getThemeFromCookie), getCachedTodayCounts()]);

  const tiles: Tile[] = [
    { label: 'Admissions', value: counts.admissionsToday, icon: Plus, color: '#0E7C7B', tint: '#D6EEEE' },
    { label: 'Surgeries', value: 0, icon: Scissors, color: '#B5471A', tint: '#FFE4D2' },
    {
      label: 'Discharges',
      value: counts.dischargesToday,
      icon: CheckCircle2,
      color: '#15803D',
      tint: '#DCFCE7',
    },
    { label: 'Deaths', value: counts.deathsToday, icon: Skull, color: '#5B6B7A', tint: '#E2E8EE' },
  ];

  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Today</h1>
          <p className="mt-1 text-sm text-muted">{dateLabel}</p>
        </div>
        <ThemeSwitcher current={theme} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="flex items-center gap-3 rounded-lg border border-line bg-paper p-3.5"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: t.tint, color: t.color }}
              >
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="font-display text-2xl font-bold leading-none">{t.value}</div>
                <div className="mt-1 text-xs text-muted">{t.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-lg border border-line bg-paper p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-observation" />
          <h2 className="font-display text-base font-bold">Needs attention</h2>
        </div>
        <NeedsAttention />
      </section>
    </div>
  );
}
