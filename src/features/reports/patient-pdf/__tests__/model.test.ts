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
    color: 'Brown & white',
    weightKg: '12.5',
    vaccination: 'NONE',
    sterilized: true,
    aggressive: false,
    contagious: true,
    cageName: 'C-3',
    status: 'DISCHARGED',
    admittedAt: '2026-05-25T10:00:00.000Z',
    complaint: 'Hit by vehicle',
    injuryType: 'Trauma',
    history: 'Found roadside near the temple',
    diagnosis: 'Fracture',
    immediateTreatment: 'Pain relief, wound dressing',
    surgeryRequired: 'Likely',
    testsAdvised: ['XRAY', 'BLOOD_TEST'],
    rescuer: 'Asha',
    rescuerPhone: '+91 99999 99999',
    address: '12 Temple Road',
    ngo: 'Seva',
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
  it('maps the full intake onto the patient and groups the day log', () => {
    const m = buildReportModel(raw);
    expect(m.patient.name).toBe('Facebook'); // trimmed
    expect(m.patient.breedAge).toBe('Dog · Indie');
    expect(m.patient.color).toBe('Brown & white');
    expect(m.patient.weightKg).toBe('12.5');
    expect(m.patient.vaccination).toBe('None');
    expect(m.patient.flags).toBe('Sterilized · Contagious');
    expect(m.patient.injuryType).toBe('Trauma');
    expect(m.patient.history).toBe('Found roadside near the temple');
    expect(m.patient.immediateTreatment).toBe('Pain relief, wound dressing');
    expect(m.patient.surgeryRequired).toBe('Likely');
    expect(m.patient.testsAdvised).toBe('X-ray, Blood test');
    expect(m.patient.rescuerPhone).toBe('+91 99999 99999');
    expect(m.patient.address).toBe('12 Temple Road');
    expect(m.patient.ngo).toBe('Seva');
    expect(m.patient.avatarAssetId).toBe('adm1');
    expect(m.outcome.kind).toBe('discharged');
    expect(m.outcome.summary).toBe('Recovered well, weight-bearing on all limbs');
    expect(m.outcome.instructions).toBe('Cone for 5 days; review after 2 weeks');
    expect(m.outcome.byName).toBe('Dr. Mehta');
    expect(m.generatedByName).toBe('Asha (Reception)');
    expect(m.days).toHaveLength(1);
    expect(m.days[0]?.entries).toHaveLength(2);
    const food = m.days[0]?.entries.find((e) => e.type === 'FOOD');
    expect(food?.summary).toContain('Khichdi');
    expect(food?.stills.map((x) => x.assetId)).toEqual(['p1']);
    expect(food?.occurredAt).toBe('2026-05-26T12:00:00.000Z');
  });

  it('hides empty flags and tests-advised', () => {
    const plain: typeof raw = structuredClone(raw);
    plain.animal.sterilized = false;
    plain.animal.contagious = false;
    plain.animal.testsAdvised = [];
    const m = buildReportModel(plain);
    expect(m.patient.flags).toBeNull();
    expect(m.patient.testsAdvised).toBeNull();
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
});
