import type { ActivityType } from './schema';

// biome-ignore lint/suspicious/noExplicitAny: activity data shape varies per type
type ActivityDataLike = any;

interface ActivityShape {
  type: ActivityType;
  data: ActivityDataLike;
  remarks?: string | null;
}

export function summarizeActivity(a: ActivityShape): string {
  const d = a.data ?? {};
  switch (a.type) {
    case 'TREATMENT': {
      const meds = (d.meds ?? []) as Array<{ name: string; dose: string; route: string }>;
      return meds.length
        ? meds.map((m) => `${m.name} ${m.dose} ${m.route}`).join(', ')
        : (a.remarks ?? 'Treatment given');
    }
    case 'ADMISSION':
      return String(d.summary ?? 'Admitted');
    case 'ROUND': {
      const bits: string[] = [];
      if (d.temp) bits.push(`Temp ${d.temp}°`);
      if (d.pain) bits.push(`Pain ${d.pain}`);
      if (d.progress) bits.push(String(d.progress));
      return bits.join(' · ') || String(d.notes ?? '—');
    }
    case 'SURGERY':
      return `${String(d.surgeryName ?? '')} (${String(d.duration ?? '')}) — ${String(d.surgeon ?? '')}`;
    case 'FOOD':
      return [d.foodType, d.qty, d.intake, d.vomiting ? 'vomited' : null].filter(Boolean).join(' · ');
    case 'BATH':
      return String(d.bathType ?? '—');
    case 'WALK':
      return [d.duration, d.mobility, d.assisted ? 'assisted' : 'independent'].filter(Boolean).join(' · ');
    case 'DIAGNOSTIC':
      return `${((d.tests ?? []) as string[]).join(', ')}${d.findings ? ` — ${d.findings}` : ''}`;
    default:
      return a.remarks ?? '—';
  }
}
