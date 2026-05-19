import { getCachedTodayCounts } from '@/features/animals/queries';
import { ArrowRight, type LucideIcon, Plus, Scissors, Skull } from 'lucide-react';
import { QuickActions } from './QuickActions';
import { TodayTimeline } from './TodayTimeline';

interface Tile {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  tint: string;
}

export async function TodayDashboard() {
  const counts = await getCachedTodayCounts();

  const tiles: Tile[] = [
    { label: 'Admissions', value: counts.admissionsToday, icon: Plus, color: '#0E7C7B', tint: '#D6EEEE' },
    { label: 'Surgeries', value: counts.surgeriesToday, icon: Scissors, color: '#B5471A', tint: '#F6E2D2' },
    {
      label: 'Discharges',
      value: counts.dischargesToday,
      icon: ArrowRight,
      color: '#15803D',
      tint: '#DCFAE6',
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
      <div>
        <h1 className="font-display text-[28px] font-extrabold tracking-tight md:text-[32px]">Today</h1>
        <p className="mt-1 text-sm text-muted">{dateLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="flex items-center gap-3.5 rounded-2xl border border-line bg-paper px-4 py-3.5"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: t.tint, color: t.color }}
              >
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="font-display text-[26px] font-bold leading-none">{t.value}</div>
                <div className="mt-1 text-[12.5px] text-muted">{t.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="font-bold text-[10.5px] text-muted uppercase tracking-[0.07em]">Quick actions</h2>
        </div>
        <QuickActions />
      </section>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="font-bold text-[10.5px] text-muted uppercase tracking-[0.07em]">
            Today's activities
          </h2>
        </div>
        <TodayTimeline />
      </section>
    </div>
  );
}
