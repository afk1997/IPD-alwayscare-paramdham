import type { ActivityType } from '@/features/activities/schema';
import { activityDetailLines, summarizeActivity } from '@/features/activities/summary';

const TZ = 'Asia/Kolkata';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  });
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: TZ });

const TEST_LABELS: Record<string, string> = {
  XRAY: 'X-ray',
  USG: 'USG',
  BLOOD_TEST: 'Blood test',
  MRI: 'MRI',
  CT_SCAN: 'CT scan',
  SONOGRAPHY: 'Sonography',
};
const VACC_LABELS: Record<string, string> = { DONE: 'Done', PARTIAL: 'Partial', NONE: 'None', NA: 'N/A' };

export type MediaKindLite = 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
export interface RawMedia {
  assetId: string;
  kind: MediaKindLite;
  label: string | null;
  filename: string;
  storageKey: string;
}
export interface RawActivity {
  type: ActivityType;
  occurredAt: string;
  byName: string;
  editedAt: string | null;
  remarks: string | null;
  data: unknown;
  media: RawMedia[];
}
export interface RawDocument {
  id: string;
  category: string;
  kind: string;
  name: string;
  createdAt: string;
  file: { assetId: string; kind: MediaKindLite; filename: string; storageKey: string } | null;
}
export interface RawReportData {
  generatedAt: string;
  generatedByName: string;
  range: { from: string; to: string } | null;
  animal: {
    name: string;
    species: string;
    breed: string | null;
    gender: string | null;
    ageText: string | null;
    color: string | null;
    weightKg: string | null;
    vaccination: string;
    sterilized: boolean;
    aggressive: boolean;
    contagious: boolean;
    cageName: string | null;
    status: string;
    admittedAt: string;
    complaint: string | null;
    injuryType: string | null;
    history: string | null;
    diagnosis: string | null;
    immediateTreatment: string | null;
    surgeryRequired: string | null;
    testsAdvised: string[];
    rescuer: string | null;
    rescuerPhone: string | null;
    address: string | null;
    ngo: string | null;
    broughtBy: string | null;
    media: RawMedia[];
    death: { causeOfDeath: string; diedAt: string; recordedByName: string } | null;
    discharge: {
      dischargedAt: string;
      summary: string;
      instructions: string | null;
      dischargedByName: string;
    } | null;
  };
  activities: RawActivity[];
  documents: RawDocument[];
}

export interface ReportEntry {
  // Raw ISO timestamp — the renderer's unique key (day+time can collide).
  occurredAt: string;
  type: ActivityType;
  time: string;
  byName: string;
  edited: boolean;
  summary: string;
  details: string[];
  stills: RawMedia[];
  links: RawMedia[];
}

export interface ReportDay {
  key: string;
  label: string;
  entries: ReportEntry[];
}
export interface ReportModel {
  generatedAt: string;
  generatedByName: string;
  rangeLabel: string | null;
  patient: {
    name: string;
    species: string;
    breedAge: string;
    sexAge: string;
    color: string | null;
    weightKg: string | null;
    vaccination: string;
    // 'Sterilized · Aggressive · Contagious' — only the flags that apply; null when none.
    flags: string | null;
    cage: string | null;
    status: string;
    admittedAt: string;
    complaint: string | null;
    injuryType: string | null;
    history: string | null;
    diagnosis: string | null;
    immediateTreatment: string | null;
    surgeryRequired: string | null;
    // 'X-ray, Blood test' — human labels; null when none advised.
    testsAdvised: string | null;
    rescuer: string | null;
    rescuerPhone: string | null;
    address: string | null;
    ngo: string | null;
    broughtBy: string | null;
    avatarAssetId: string | null;
  };
  outcome: {
    kind: 'in-care' | 'discharged' | 'deceased';
    label: string;
    causeOfDeath: string | null;
    summary: string | null;
    instructions: string | null;
    byName: string | null;
  };
  admissionMedia: RawMedia[];
  days: ReportDay[];
  documents: RawDocument[];
}

const isStill = (k: MediaKindLite) => k === 'PHOTO' || k === 'XRAY';

// Legacy rows carry ''/whitespace text (pre-validation admissions); the
// renderer hides null, so normalise here.
const nz = (v: string | null) => {
  const t = v?.trim();
  return t ? t : null;
};

function groupedPush(map: Map<string, ReportEntry[]>, key: string, entry: ReportEntry): void {
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  arr.push(entry);
}

function buildOutcome(a: RawReportData['animal']): ReportModel['outcome'] {
  if (a.death)
    return {
      kind: 'deceased',
      label: `Deceased · ${shortDate(a.death.diedAt)}`,
      causeOfDeath: a.death.causeOfDeath,
      summary: null,
      instructions: null,
      byName: a.death.recordedByName,
    };
  if (a.discharge)
    return {
      kind: 'discharged',
      label: `Discharged · ${shortDate(a.discharge.dischargedAt)}`,
      causeOfDeath: null,
      summary: a.discharge.summary,
      instructions: a.discharge.instructions,
      byName: a.discharge.dischargedByName,
    };
  return {
    kind: 'in-care',
    label: 'In care',
    causeOfDeath: null,
    summary: null,
    instructions: null,
    byName: null,
  };
}

export function buildReportModel(raw: RawReportData): ReportModel {
  const a = raw.animal;
  const grouped = new Map<string, ReportEntry[]>();

  for (const act of raw.activities) {
    const stills = act.media.filter((m) => isStill(m.kind));
    groupedPush(grouped, dayKey(act.occurredAt), {
      occurredAt: act.occurredAt,
      type: act.type,
      time: timeLabel(act.occurredAt),
      byName: act.byName,
      edited: !!act.editedAt,
      summary: summarizeActivity({ type: act.type, data: act.data, remarks: act.remarks }),
      details: activityDetailLines({ type: act.type, data: act.data, remarks: act.remarks }),
      stills,
      links: act.media.filter((m) => !isStill(m.kind)),
    });
  }

  const daysArr: ReportDay[] = Array.from(grouped.entries())
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([key, entries]) => ({ key, label: dayLabel(`${key}T12:00:00+05:30`), entries }));

  const flags = [
    a.sterilized ? 'Sterilized' : null,
    a.aggressive ? 'Aggressive' : null,
    a.contagious ? 'Contagious' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    generatedAt: raw.generatedAt,
    generatedByName: raw.generatedByName,
    rangeLabel: raw.range
      ? `${shortDate(`${raw.range.from}T12:00:00+05:30`)} – ${shortDate(`${raw.range.to}T12:00:00+05:30`)}`
      : null,
    patient: {
      name: a.name.trim(),
      species: a.species,
      breedAge: [a.species, a.breed].filter(Boolean).join(' · '),
      sexAge: [a.gender, a.ageText].filter(Boolean).join(' · '),
      color: nz(a.color),
      weightKg: a.weightKg,
      vaccination: VACC_LABELS[a.vaccination] ?? a.vaccination,
      flags: flags || null,
      cage: a.cageName,
      status: a.status,
      admittedAt: a.admittedAt,
      complaint: nz(a.complaint),
      injuryType: nz(a.injuryType),
      history: nz(a.history),
      diagnosis: nz(a.diagnosis),
      immediateTreatment: nz(a.immediateTreatment),
      surgeryRequired: nz(a.surgeryRequired),
      testsAdvised: a.testsAdvised.length ? a.testsAdvised.map((t) => TEST_LABELS[t] ?? t).join(', ') : null,
      rescuer: nz(a.rescuer),
      rescuerPhone: nz(a.rescuerPhone),
      address: nz(a.address),
      ngo: nz(a.ngo),
      broughtBy: nz(a.broughtBy),
      avatarAssetId: a.media.find((m) => isStill(m.kind))?.assetId ?? null,
    },
    outcome: buildOutcome(a),
    admissionMedia: a.media.filter((m) => isStill(m.kind)),
    days: daysArr,
    documents: raw.documents,
  };
}
