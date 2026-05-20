import { ACTIVITY_LABELS } from '@/features/activities/schema';
import type { ActivityType } from '@prisma/client';
import type { ActivityRow } from './queries';

// The clinic is in India; pin all formatting to Asia/Kolkata so the
// copy reads the same whether the server is running locally (IST), on
// Vercel (UTC), or in CI (UTC).  Without this, `toLocale*` uses the
// runtime's local TZ — tests passed on a dev Mac and failed in CI.
const REPORT_TZ = 'Asia/Kolkata';

const SPECIES_EMOJI: Record<string, string> = {
  Dog: '🐶',
  Cat: '🐱',
  Cow: '🐄',
  Bird: '🐦',
  Goat: '🐐',
  Rabbit: '🐰',
};
const DEFAULT_EMOJI = '🐾';

function speciesEmoji(species: string): string {
  return SPECIES_EMOJI[species] ?? DEFAULT_EMOJI;
}

function headerDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD.  Anchor it at noon Asia/Kolkata so the
  // calendar date doesn't drift across midnight under DST or
  // non-IST runtime locales (CI runs UTC).
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: REPORT_TZ,
  });
}

function clockHHMM(d: Date): string {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: REPORT_TZ,
  });
}

export function formatDailyReportText(date: string, rows: ActivityRow[]): string {
  const lines: string[] = [];
  lines.push(`🏥 Arham Always Care — ${headerDate(date)}`);
  lines.push(`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`);

  if (rows.length === 0) return lines.join('\n');

  // Group by animalId; preserve first-seen order then sort groups by name.
  const groups = new Map<
    string,
    { name: string; species: string; ward: string | null; rows: ActivityRow[] }
  >();
  for (const r of rows) {
    const g = groups.get(r.animalId) ?? {
      name: r.animalName,
      species: r.animalSpecies,
      ward: r.animalWard,
      rows: [],
    };
    g.rows.push(r);
    groups.set(r.animalId, g);
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  );

  for (const g of sortedGroups) {
    lines.push(''); // blank line before each animal block
    const wardPart = g.ward ? ` · ${g.ward}` : '';
    lines.push(`${speciesEmoji(g.species)} ${g.name} (${g.species}${wardPart})`);
    const sortedRows = g.rows.slice().sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    for (const r of sortedRows) {
      const time = clockHHMM(r.occurredAt);
      const label = ACTIVITY_LABELS[r.type as ActivityType];
      const tag = r.mediaCount > 0 ? '  📎' : '';
      lines.push(`• ${time}  ${label} — ${r.summary}  (${r.byName})${tag}`);
      // Each populated field becomes an indented sub-bullet — "no field
      // dropped" per spec.  Blank string fields are already filtered
      // out upstream in `activityDetailLines`.
      for (const detail of r.detailLines) lines.push(`   ↳ ${detail}`);
    }
  }

  return lines.join('\n');
}
