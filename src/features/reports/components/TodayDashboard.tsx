import { getCachedTodayCounts } from '@/features/animals/queries';
import { ThemeSwitcher } from '@/features/settings/components/ThemeSwitcher';
import { getThemeFromCookie } from '@/lib/theme';
import { Activity, AlertTriangle, ArrowUpRight, Skull } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cookies } from 'next/headers';

type Tone = 'accent' | 'neutral' | 'stable' | 'critical' | 'observation';

interface Tile {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: Tone;
}

const toneClasses: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-ink',
  neutral: 'bg-surface-2 text-text',
  stable: 'bg-stable-bg text-stable',
  critical: 'bg-critical-bg text-critical',
  observation: 'bg-observation-bg text-observation',
};

export async function TodayDashboard() {
  const [theme, counts] = await Promise.all([cookies().then(getThemeFromCookie), getCachedTodayCounts()]);

  const tiles: Tile[] = [
    { label: 'Admissions today', value: counts.admissionsToday, icon: ArrowUpRight, tone: 'accent' },
    { label: 'Critical now', value: counts.critical, icon: AlertTriangle, tone: 'observation' },
    { label: 'Discharges today', value: counts.dischargesToday, icon: Activity, tone: 'stable' },
    { label: 'Deaths today', value: counts.deathsToday, icon: Skull, tone: 'critical' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-muted">Floor at a glance</p>
        </div>
        <ThemeSwitcher current={theme} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="rounded-lg border border-line bg-paper p-4">
              <div
                className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md ${toneClasses[t.tone]}`}
              >
                <Icon size={16} />
              </div>
              <div className="font-display text-2xl font-bold">{t.value}</div>
              <div className="mt-1 text-xs text-muted">{t.label}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-line bg-paper p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-observation" />
          <h2 className="font-display text-base font-bold">Needs attention</h2>
        </div>
        <p className="text-sm text-muted">No data yet — admit your first patient to see this populate.</p>
      </div>
    </div>
  );
}
