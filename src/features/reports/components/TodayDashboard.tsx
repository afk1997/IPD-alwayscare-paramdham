import { getCachedTodayCounts } from '@/features/animals/queries';
import { getCurrentUser } from '@/lib/auth';
import { ArrowRight, type LucideIcon, Plus, Scissors, Skull } from 'lucide-react';
import Link from 'next/link';
import { QuickActions } from './QuickActions';
import { TodayLifecyclePanel } from './TodayLifecyclePanel';
import { TodayTimeline } from './TodayTimeline';

type ShowKey = 'admissions' | 'surgeries' | 'discharges' | 'deaths';
const SHOW_KEYS: ShowKey[] = ['admissions', 'surgeries', 'discharges', 'deaths'];
const OUTCOME_KEYS = new Set<ShowKey>(['deaths', 'discharges']);

interface Tile {
  key: ShowKey;
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  tint: string;
}

export async function TodayDashboard({ show }: { show?: string | undefined } = {}) {
  const [counts, user] = await Promise.all([getCachedTodayCounts(), getCurrentUser()]);
  const canSeeOutcomes = !!user && user.role !== 'STAFF';

  const active: ShowKey | null = SHOW_KEYS.includes(show as ShowKey) ? (show as ShowKey) : null;
  const effectiveActive = active && OUTCOME_KEYS.has(active) && !canSeeOutcomes ? null : active;

  const tiles: Tile[] = [
    {
      key: 'admissions',
      label: 'Admissions',
      value: counts.admissionsToday,
      icon: Plus,
      color: '#0E7C7B',
      tint: '#D6EEEE',
    },
    {
      key: 'surgeries',
      label: 'Surgeries',
      value: counts.surgeriesToday,
      icon: Scissors,
      color: '#B5471A',
      tint: '#F6E2D2',
    },
    {
      key: 'discharges',
      label: 'Discharges',
      value: counts.dischargesToday,
      icon: ArrowRight,
      color: '#15803D',
      tint: '#DCFAE6',
    },
    {
      key: 'deaths',
      label: 'Deaths',
      value: counts.deathsToday,
      icon: Skull,
      color: '#5B6B7A',
      tint: '#E2E8EE',
    },
  ];

  const dateLabel = new Date().toLocaleDateString(undefined, {
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
          const clickable = !OUTCOME_KEYS.has(t.key) || canSeeOutcomes;
          const isActive = effectiveActive === t.key;
          const inner = (
            <div
              className={`flex items-center gap-3.5 rounded-2xl border bg-paper px-4 py-3.5 ${
                isActive ? 'border-accent ring-1 ring-accent' : 'border-line'
              } ${clickable ? 'transition hover:border-accent/50' : ''}`}
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
          if (!clickable) return <div key={t.key}>{inner}</div>;
          return (
            <Link key={t.key} href={isActive ? '/' : `/?show=${t.key}`} aria-pressed={isActive}>
              {inner}
            </Link>
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
            {effectiveActive ? `Today's ${effectiveActive}` : "Today's activities"}
          </h2>
        </div>
        {effectiveActive === 'surgeries' ? (
          <TodayTimeline type="SURGERY" />
        ) : effectiveActive === 'admissions' ||
          effectiveActive === 'deaths' ||
          effectiveActive === 'discharges' ? (
          <TodayLifecyclePanel kind={effectiveActive} />
        ) : (
          <TodayTimeline />
        )}
      </section>
    </div>
  );
}
