import { ACTIVITY_LABELS, type ActivityType } from './schema';
import { activityDetailLines, summarizeActivity } from './summary';

// Single source of truth for species → emoji.  Kept in sync with the
// daily-report copy in src/features/reports/dailyReportText.ts.
const SPECIES_EMOJI: Record<string, string> = {
  Dog: '🐶',
  Cat: '🐱',
  Cow: '🐄',
  Bird: '🐦',
  Goat: '🐐',
  Rabbit: '🐰',
};
const DEFAULT_EMOJI = '🐾';

const REPORT_TZ = 'Asia/Kolkata';

function clockHHMM(d: Date): string {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: REPORT_TZ,
  });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: REPORT_TZ,
  });
}

export interface ShareTextInput {
  animalName: string;
  animalSpecies: string;
  type: ActivityType;
  occurredAt: Date;
  // biome-ignore lint/suspicious/noExplicitAny: per-type discriminated shape
  data: any;
  remarks: string | null;
  byName: string;
  mediaCount: number;
}

export function formatActivityShareText(a: ShareTextInput): string {
  const lines: string[] = [];

  const emoji = SPECIES_EMOJI[a.animalSpecies] ?? DEFAULT_EMOJI;
  lines.push(`${emoji} *${a.animalName}* (${a.animalSpecies}) · ${shortDate(a.occurredAt)}`);

  const time = clockHHMM(a.occurredAt);
  const label = ACTIVITY_LABELS[a.type];
  const clip = a.mediaCount > 0 ? '  📎' : '';
  lines.push(`*${time}  ${label}*${clip}`);

  const summary = summarizeActivity({ type: a.type, data: a.data, remarks: a.remarks });
  if (summary && summary !== '—') lines.push(summary);

  for (const detail of activityDetailLines({ type: a.type, data: a.data, remarks: a.remarks })) {
    lines.push(detail);
  }

  if (a.byName.trim().length > 0) lines.push(`— ${a.byName}`);

  return lines.join('\n');
}
