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

// Per-type expanded detail for the daily-report Share / Copy output.
// Returns one string per populated field that ISN'T already represented
// in the row's headline summary, so the WhatsApp paste reads cleanly
// (no duplicates like "Temp 38.5°C" in the headline AND "Temp: 38.5°C"
// in the sub-bullets).
//
// String fields left blank are skipped.  Boolean fields render as
// `yes`/`no` only when the value isn't already implied by the headline
// (e.g. summary already says "vomited" when vomiting=true; we emit
// "Vomiting: no" only when false, since "no" isn't in summary).
//
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: flat switch over 8 activity types, each branch is independent
export function activityDetailLines(a: ActivityShape): string[] {
  const d = a.data ?? {};
  const out: string[] = [];
  const pushIf = (label: string, v: unknown) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (s.length === 0) return;
    out.push(`${label}: ${s}`);
  };

  switch (a.type) {
    case 'TREATMENT':
      // Summary already lists every med (name dose route, …).
      // Only activity-level remarks remain.
      break;
    case 'ROUND': {
      // Summary uses temp / pain / progress; falls back to notes only
      // when ALL three are empty.  Detail emits the other fields, plus
      // notes when it isn't already serving as the summary fallback.
      pushIf('Appetite', d.appetite);
      pushIf('Hydration', d.hydration);
      pushIf('Wound', d.wound);
      pushIf('Stool', d.stool);
      const summaryUsedNotesFallback = !d.temp && !d.pain && !d.progress;
      if (!summaryUsedNotesFallback) pushIf('Notes', d.notes);
      break;
    }
    case 'DIAGNOSTIC':
      // Summary covers tests + findings.  Only interpretation is new.
      pushIf('Interpretation', d.interpretation);
      break;
    case 'SURGERY':
      // Summary covers surgery name, duration, surgeon.
      pushIf('Anesthesia', d.anesthesia);
      pushIf('Findings', d.findings);
      pushIf('Complications', d.complications);
      pushIf('Post-op', d.postOp);
      break;
    case 'FOOD':
      // Summary already has foodType, qty, intake, and "vomited" if
      // true.  Water is never in summary — emit when present.
      pushIf('Water', d.water);
      // When vomiting is false the summary doesn't mention it; emit the
      // explicit "no" so the reader sees the negative.
      if (!d.vomiting) out.push('Vomiting: no');
      break;
    case 'BATH':
      // Summary is just bathType.  groomingBy and bath-internal remarks
      // are new.
      pushIf('Grooming by', d.groomingBy);
      pushIf('Bath notes', d.remarks);
      break;
    case 'WALK':
      // Summary covers duration, mobility, assisted/independent.
      // Urinated + (post-walk) stool are new.
      out.push(`Urinated: ${d.urination ? 'yes' : 'no'}`);
      out.push(`Stool: ${d.stool ? 'yes' : 'no'}`);
      break;
    case 'ADMISSION':
      // Summary === data.summary verbatim; nothing left to add.
      break;
  }

  // Activity-level remarks land last regardless of type.
  if (a.remarks && a.remarks.trim().length > 0) {
    out.push(`Remarks: ${a.remarks.trim()}`);
  }
  return out;
}
