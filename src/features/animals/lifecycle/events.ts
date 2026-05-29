export interface LifecycleEvent {
  kind: 'admission' | 'discharge' | 'death';
  at: string; // ISO
  detail: string | null;
  byName: string | null;
  invalidated: boolean;
  invalidatedByName: string | null;
}

export interface AnimalForEvents {
  admittedAt: Date;
  complaint: string | null;
  createdBy: { name: string };
  deathRecord: {
    causeOfDeath: string;
    diedAt: Date;
    recordedBy: { name: string };
    invalidatedAt: Date | null;
    invalidatedBy: { name: string } | null;
  } | null;
  dischargeRecord: {
    summary: string;
    dischargedAt: Date;
    dischargedBy: { name: string };
    invalidatedAt: Date | null;
    invalidatedBy: { name: string } | null;
  } | null;
}

// Synthetic, record-sourced lifecycle entries for a patient. NOT Activity rows
// (keeps counts/summaries clean — the SD-7 fix). Death/discharge are sourced
// from the records so they still render (struck-through) after invalidation,
// even though the animal's deceasedAt/dischargedAt get cleared.
export function buildLifecycleEvents(a: AnimalForEvents): LifecycleEvent[] {
  const events: LifecycleEvent[] = [
    {
      kind: 'admission',
      at: a.admittedAt.toISOString(),
      detail: a.complaint,
      byName: a.createdBy.name,
      invalidated: false,
      invalidatedByName: null,
    },
  ];
  if (a.deathRecord) {
    events.push({
      kind: 'death',
      at: a.deathRecord.diedAt.toISOString(),
      detail: a.deathRecord.causeOfDeath,
      byName: a.deathRecord.recordedBy.name,
      invalidated: a.deathRecord.invalidatedAt !== null,
      invalidatedByName: a.deathRecord.invalidatedBy?.name ?? null,
    });
  }
  if (a.dischargeRecord) {
    events.push({
      kind: 'discharge',
      at: a.dischargeRecord.dischargedAt.toISOString(),
      detail: a.dischargeRecord.summary,
      byName: a.dischargeRecord.dischargedBy.name,
      invalidated: a.dischargeRecord.invalidatedAt !== null,
      invalidatedByName: a.dischargeRecord.invalidatedBy?.name ?? null,
    });
  }
  return events;
}
