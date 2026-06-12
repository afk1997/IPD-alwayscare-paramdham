import { describe, expect, it } from 'vitest';
import { type RawReportData, buildReportModel } from '../model';

const raw: RawReportData = {
  generatedAt: '2026-05-31T06:30:00.000Z',
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
    discharge: { dischargedAt: '2026-05-29T10:00:00.000Z' },
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
  });
});
