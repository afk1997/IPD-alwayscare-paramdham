import { ACTIVITY_LABELS, type ActivityType } from '@/features/activities/schema';
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
    cageName: string | null;
    status: string;
    admittedAt: string;
    complaint: string | null;
    diagnosis: string | null;
    rescuer: string | null;
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
  type: ActivityType;
  time: string;
  byName: string;
  edited: boolean;
  summary: string;
  details: string[];
  stills: RawMedia[];
  links: RawMedia[];
  // Set on SURGERY / DIAGNOSTIC day-log rows: the full card (with stills)
  // lives in the dedicated section; the log shows a compact cross-ref row.
  crossRef?: 'surgery' | 'diagnostics';
}

export interface SectionEntry extends ReportEntry {
  dayLabel: string;
}
export interface ReportDay {
  key: string;
  label: string;
  entries: ReportEntry[];
}
export interface ReportMed {
  name: string;
  doses: string[];
  routes: string[];
  times: number;
  days: number;
  span: string;
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
    cage: string | null;
    status: string;
    admittedAt: string;
    complaint: string | null;
    diagnosis: string | null;
    rescuer: string | null;
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
  stats: { days: number; perType: { type: ActivityType; label: string; count: number }[]; photos: number };
  meds: ReportMed[];
  recovery: { first: { assetId: string; label: string }; last: { assetId: string; label: string } } | null;
  surgeries: SectionEntry[];
  diagnostics: SectionEntry[];
  admissionMedia: RawMedia[];
  days: ReportDay[];
  documents: RawDocument[];
}

const isStill = (k: MediaKindLite) => k === 'PHOTO' || k === 'XRAY';

type MedEntry = { doses: Set<string>; routes: Set<string>; days: Set<string>; times: number };

function groupedPush(map: Map<string, ReportEntry[]>, key: string, entry: ReportEntry): void {
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  arr.push(entry);
}

function accumulateMeds(medMap: Map<string, MedEntry>, act: RawActivity): void {
  const meds = (act.data as { meds?: Array<{ name?: string; dose?: string; route?: string }> })?.meds ?? [];
  for (const md of meds) {
    const k = (md.name || '—').trim();
    const e = medMap.get(k) ?? { doses: new Set(), routes: new Set(), days: new Set(), times: 0 };
    if (md.dose) e.doses.add(md.dose);
    if (md.route) e.routes.add(md.route);
    e.days.add(dayKey(act.occurredAt));
    e.times += 1;
    medMap.set(k, e);
  }
}

function buildMedSpan(ds: string[]): string {
  if (!ds.length) return '—';
  const first = shortDate(`${ds[0]}T12:00:00+05:30`);
  if (ds.length === 1) return first;
  return `${first} – ${shortDate(`${ds[ds.length - 1]}T12:00:00+05:30`)}`;
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
  const endIso = a.death?.diedAt ?? a.discharge?.dischargedAt ?? raw.generatedAt;
  const days = Math.max(1, Math.ceil((+new Date(endIso) - +new Date(a.admittedAt)) / 86_400_000));

  const outcome = buildOutcome(a);
  const perTypeMap = new Map<ActivityType, number>();
  let photos = 0;
  const medMap = new Map<string, MedEntry>();
  const grouped = new Map<string, ReportEntry[]>();
  const surgeries: SectionEntry[] = [];
  const diagnostics: SectionEntry[] = [];
  // Recovery-pair candidates: PHOTO kind only, never X-rays.
  let firstActivityPhoto: { assetId: string; day: string } | null = null;
  let lastActivityPhoto: { assetId: string; day: string } | null = null;

  for (const act of raw.activities) {
    perTypeMap.set(act.type, (perTypeMap.get(act.type) ?? 0) + 1);
    const stills = act.media.filter((m) => isStill(m.kind));
    photos += stills.length;
    if (act.type === 'TREATMENT') accumulateMeds(medMap, act);
    const entry: ReportEntry = {
      type: act.type,
      time: timeLabel(act.occurredAt),
      byName: act.byName,
      edited: !!act.editedAt,
      summary: summarizeActivity({ type: act.type, data: act.data, remarks: act.remarks }),
      details: activityDetailLines({ type: act.type, data: act.data, remarks: act.remarks }),
      stills,
      links: act.media.filter((m) => !isStill(m.kind)),
    };
    for (const m of stills) {
      if (m.kind !== 'PHOTO') continue;
      const cand = { assetId: m.assetId, day: dayKey(act.occurredAt) };
      if (!firstActivityPhoto) firstActivityPhoto = cand;
      lastActivityPhoto = cand;
    }
    if (act.type === 'SURGERY' || act.type === 'DIAGNOSTIC') {
      const isSurgery = act.type === 'SURGERY';
      (isSurgery ? surgeries : diagnostics).push({ ...entry, dayLabel: dayLabel(act.occurredAt) });
      groupedPush(grouped, dayKey(act.occurredAt), {
        ...entry,
        stills: [],
        crossRef: isSurgery ? 'surgery' : 'diagnostics',
      });
    } else {
      groupedPush(grouped, dayKey(act.occurredAt), entry);
    }
  }

  const daysArr: ReportDay[] = Array.from(grouped.entries())
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([key, entries]) => ({ key, label: dayLabel(`${key}T12:00:00+05:30`), entries }));

  const meds: ReportMed[] = Array.from(medMap.entries()).map(([name, e]) => {
    const ds = Array.from(e.days).sort();
    return {
      name,
      doses: [...e.doses],
      routes: [...e.routes],
      times: e.times,
      days: e.days.size,
      span: buildMedSpan(ds),
    };
  });

  const admissionPhoto = a.media.find((m) => m.kind === 'PHOTO') ?? null;
  const first = admissionPhoto
    ? { assetId: admissionPhoto.assetId, day: dayKey(a.admittedAt) }
    : firstActivityPhoto;
  const last = lastActivityPhoto;
  const recovery =
    first && last && first.assetId !== last.assetId && first.day !== last.day
      ? {
          first: { assetId: first.assetId, label: 'DAY 1 · at admission' },
          last: {
            assetId: last.assetId,
            label: `DAY ${days} · ${outcome.kind === 'discharged' ? 'at discharge' : 'latest'}`,
          },
        }
      : null;

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
      cage: a.cageName,
      status: a.status,
      admittedAt: a.admittedAt,
      complaint: a.complaint,
      diagnosis: a.diagnosis,
      rescuer: a.rescuer,
      broughtBy: a.broughtBy,
      avatarAssetId: a.media.find((m) => isStill(m.kind))?.assetId ?? null,
    },
    outcome,
    stats: {
      days,
      perType: Array.from(perTypeMap.entries()).map(([type, count]) => ({
        type,
        label: ACTIVITY_LABELS[type],
        count,
      })),
      photos,
    },
    meds,
    recovery,
    surgeries,
    diagnostics,
    admissionMedia: a.media.filter((m) => isStill(m.kind)),
    days: daysArr,
    documents: raw.documents,
  };
}
