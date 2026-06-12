import { describe, expect, it } from 'vitest';
import { type RawReportData, buildReportModel } from '../model';

const raw: RawReportData = {
  generatedAt: '2026-05-31T06:30:00.000Z',
  generatedByName: 'Asha (Reception)',
  range: null,
  animal: {
    name: 'Facebook ',
    species: 'Dog',
    breed: 'Indie',
    gender: 'MALE',
    ageText: '~2y',
    cageName: 'C-3',
    status: 'DISCHARGED',
    admittedAt: '2026-05-25T10:00:00.000Z',
    complaint: 'Hit by vehicle',
    diagnosis: 'Fracture',
    rescuer: 'Asha',
    broughtBy: 'NGO',
    media: [{ assetId: 'adm1', kind: 'PHOTO', label: null, filename: 'a.jpg', storageKey: 'local:x/a.jpg' }],
    death: null,
    discharge: {
      dischargedAt: '2026-05-29T10:00:00.000Z',
      summary: 'Recovered well, weight-bearing on all limbs',
      instructions: 'Cone for 5 days; review after 2 weeks',
      dischargedByName: 'Dr. Mehta',
    },
  },
  activities: [
    {
      type: 'TREATMENT',
      occurredAt: '2026-05-26T09:00:00.000Z',
      byName: 'Dr. Mehta',
      editedAt: null,
      remarks: null,
      data: { meds: [{ name: 'Amoxiclav', dose: '20mg/kg', route: 'Oral' }] },
      media: [],
    },
    {
      type: 'FOOD',
      occurredAt: '2026-05-26T12:00:00.000Z',
      byName: 'Pooja',
      editedAt: null,
      remarks: null,
      data: { foodType: 'Khichdi', qty: '50g', intake: 'Fully', vomiting: false },
      media: [
        { assetId: 'p1', kind: 'PHOTO', label: 'bowl', filename: 'p1.jpg', storageKey: 'local:x/p1.jpg' },
      ],
    },
  ],
  documents: [],
};

describe('buildReportModel', () => {
  it('computes outcome, stats, meds, day groups', () => {
    const m = buildReportModel(raw);
    expect(m.patient.name).toBe('Facebook'); // trimmed
    expect(m.patient.cage).toBe('C-3');
    expect(buildReportModel({ ...raw, animal: { ...raw.animal, cageName: null } }).patient.cage).toBeNull();
    expect(m.outcome.kind).toBe('discharged');
    expect(m.stats.days).toBe(4); // 25 -> 29 May
    expect(m.stats.perType.find((t) => t.type === 'TREATMENT')?.count).toBe(1);
    expect(m.stats.photos).toBe(1); // one activity still (admission counted separately)
    expect(m.meds).toHaveLength(1);
    expect(m.meds[0]?.name).toBe('Amoxiclav');
    expect(m.meds[0]?.times).toBe(1);
    expect(m.days).toHaveLength(1);
    expect(m.days[0]?.entries).toHaveLength(2);
    const food = m.days[0]?.entries.find((e) => e.type === 'FOOD');
    expect(food?.summary).toContain('Khichdi');
    expect(food?.stills).toHaveLength(1);
    expect(food?.details).toContain('Vomiting: no');
    expect(m.outcome.summary).toBe('Recovered well, weight-bearing on all limbs');
    expect(m.outcome.instructions).toBe('Cone for 5 days; review after 2 weeks');
    expect(m.outcome.byName).toBe('Dr. Mehta');
    expect(m.generatedByName).toBe('Asha (Reception)');
  });

  it('builds the deceased outcome with cause and recorded-by', () => {
    const dead: typeof raw = structuredClone(raw);
    dead.animal.discharge = null;
    dead.animal.death = {
      causeOfDeath: 'Multi-organ failure',
      diedAt: '2026-05-28T22:00:00.000Z',
      recordedByName: 'Dr. Iyer',
    };
    const m = buildReportModel(dead);
    expect(m.outcome.kind).toBe('deceased');
    expect(m.outcome.causeOfDeath).toBe('Multi-organ failure');
    expect(m.outcome.byName).toBe('Dr. Iyer');
    expect(m.outcome.summary).toBeNull();
  });

  const photo = (assetId: string): (typeof raw.animal.media)[number] => ({
    assetId,
    kind: 'PHOTO',
    label: null,
    filename: `${assetId}.jpg`,
    storageKey: `local:x/${assetId}.jpg`,
  });

  it('extracts surgeries into a section and compacts their log rows', () => {
    const withSurgery: typeof raw = structuredClone(raw);
    withSurgery.activities.push({
      type: 'SURGERY',
      occurredAt: '2026-05-26T11:30:00.000Z',
      byName: 'Dr. Iyer',
      editedAt: null,
      remarks: null,
      data: { surgeryName: 'Fracture repair', surgeon: 'Dr. Iyer', anesthesia: 'Iso' },
      media: [photo('sx1')],
    });
    const m = buildReportModel(withSurgery);
    expect(m.surgeries).toHaveLength(1);
    expect(m.surgeries[0]?.stills.map((s) => s.assetId)).toEqual(['sx1']);
    expect(m.surgeries[0]?.dayLabel).toContain('26 May 2026');
    const logRow = m.days.flatMap((d) => d.entries).find((e) => e.type === 'SURGERY');
    expect(logRow?.crossRef).toBe('surgery');
    expect(logRow?.stills).toEqual([]);
    // the surgery photo is counted exactly once
    expect(m.stats.photos).toBe(2);
  });

  it('builds the recovery pair from admission photo → last activity photo on different days', () => {
    const r: typeof raw = structuredClone(raw);
    r.animal.media = [photo('adm1')];
    r.activities.push({
      type: 'FOOD',
      occurredAt: '2026-05-28T12:00:00.000Z',
      byName: 'Pooja',
      editedAt: null,
      remarks: null,
      data: { foodType: 'Rice', intake: 'Fully', vomiting: false },
      media: [photo('late1')],
    });
    const m = buildReportModel(r);
    expect(m.recovery).toEqual({
      first: { assetId: 'adm1', label: 'DAY 1 · at admission' },
      last: { assetId: 'late1', label: 'DAY 4 · at discharge' },
    });
  });

  it('omits the recovery pair when photos fall on the same day or only one exists', () => {
    const sameDay: typeof raw = structuredClone(raw);
    sameDay.animal.media = [];
    // raw already has exactly one FOOD activity photo (p1) — single photo → null
    expect(buildReportModel(sameDay).recovery).toBeNull();
  });

  it('ignores X-rays for the recovery pair', () => {
    const xr: typeof raw = structuredClone(raw);
    xr.animal.media = [{ ...photo('adm1'), kind: 'XRAY' as const }];
    expect(buildReportModel(xr).recovery?.first.assetId).not.toBe('adm1');
  });
});
