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
// Returns one string per populated field — the spec rule is "no fields
// dropped".  String fields left blank are skipped; boolean fields are
// always emitted as `yes`/`no` because absence carries information
// (e.g. `Vomiting: no` is a clinically meaningful confirmation).
//
// `summarizeActivity` is intentionally kept terse for the at-a-glance
// timeline; this sibling is the verbose handover form.
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
  const pushBool = (label: string, v: unknown) => out.push(`${label}: ${v ? 'yes' : 'no'}`);

  switch (a.type) {
    case 'TREATMENT': {
      const meds = (d.meds ?? []) as Array<{ name: string; dose: string; route: string }>;
      meds.forEach((m, i) => out.push(`Med ${i + 1}: ${m.name} · ${m.dose} · ${m.route}`));
      break;
    }
    case 'ROUND':
      pushIf('Temp', d.temp);
      pushIf('Appetite', d.appetite);
      pushIf('Hydration', d.hydration);
      pushIf('Pain', d.pain);
      pushIf('Wound', d.wound);
      pushIf('Stool', d.stool);
      pushIf('Progress', d.progress);
      pushIf('Notes', d.notes);
      break;
    case 'DIAGNOSTIC': {
      const tests = (d.tests ?? []) as string[];
      if (tests.length > 0) out.push(`Tests: ${tests.join(', ')}`);
      pushIf('Findings', d.findings);
      pushIf('Interpretation', d.interpretation);
      break;
    }
    case 'SURGERY':
      pushIf('Surgery name', d.surgeryName);
      pushIf('Surgeon', d.surgeon);
      pushIf('Anesthesia', d.anesthesia);
      pushIf('Duration', d.duration);
      pushIf('Findings', d.findings);
      pushIf('Complications', d.complications);
      pushIf('Post-op', d.postOp);
      break;
    case 'FOOD':
      pushIf('Food type', d.foodType);
      pushIf('Quantity', d.qty);
      pushIf('Water', d.water);
      pushIf('Intake', d.intake);
      pushBool('Vomiting', d.vomiting);
      break;
    case 'BATH':
      pushIf('Bath type', d.bathType);
      pushIf('Grooming by', d.groomingBy);
      pushIf('Bath notes', d.remarks);
      break;
    case 'WALK':
      pushIf('Duration', d.duration);
      pushIf('Mobility', d.mobility);
      pushBool('Urinated', d.urination);
      pushBool('Stool', d.stool);
      pushBool('Assisted', d.assisted);
      break;
    case 'ADMISSION':
      pushIf('Summary', d.summary);
      break;
  }

  // Activity-level remarks land last regardless of type.  For BATH the
  // bath-internal `data.remarks` is labelled "Bath notes" above so the
  // two don't collide.
  if (a.remarks && a.remarks.trim().length > 0) {
    out.push(`Remarks: ${a.remarks.trim()}`);
  }
  return out;
}
