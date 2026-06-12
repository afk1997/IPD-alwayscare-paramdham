import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { ReportModel } from '../model';
import { renderPatientReportPdf } from '../render';

const still = (assetId: string) => ({
  assetId,
  kind: 'PHOTO' as const,
  label: null,
  filename: `${assetId}.jpg`,
  storageKey: `k-${assetId}`,
});

const model: ReportModel = {
  generatedAt: '2026-05-31T06:30:00.000Z',
  generatedByName: 'Asha (Reception)',
  rangeLabel: null,
  patient: {
    name: 'रॉकी',
    species: 'Dog',
    breedAge: 'Dog · Indie',
    sexAge: 'MALE · ~2y',
    cage: 'C-3',
    status: 'DISCHARGED',
    admittedAt: '2026-05-25T10:00:00.000Z',
    complaint: 'Hit by vehicle',
    diagnosis: 'Fracture',
    rescuer: 'Asha',
    broughtBy: 'NGO',
    avatarAssetId: 'a1',
  },
  outcome: {
    kind: 'discharged',
    label: 'Discharged · 29 May',
    causeOfDeath: null,
    summary: 'Recovered well, weight-bearing on all limbs',
    instructions: 'Cone for 5 days',
    byName: 'Dr. Mehta',
  },
  recovery: {
    first: { assetId: 'a1', label: 'DAY 1 · at admission' },
    last: { assetId: 'a2', label: 'DAY 5 · at discharge' },
  },
  stats: { days: 5, perType: [{ type: 'FOOD', label: 'Food & water', count: 1 }], photos: 2 },
  meds: [
    { name: 'Amoxiclav', doses: ['20mg/kg'], routes: ['Oral'], times: 2, days: 2, span: '26 May – 27 May' },
  ],
  surgeries: [
    {
      occurredAt: '2026-05-26T11:30:00.000Z',
      type: 'SURGERY',
      time: '11:30',
      byName: 'Dr. Iyer',
      edited: false,
      summary: 'Fracture repair (45 min) — Dr. Iyer',
      details: ['Anesthesia: Iso', 'Findings: clean break'],
      stills: [still('a2')],
      links: [],
      dayLabel: 'Tue 26 May 2026',
    },
  ],
  diagnostics: [],
  admissionMedia: [still('a1')],
  days: [
    {
      key: '2026-05-26',
      label: 'Tue 26 May 2026',
      entries: [
        {
          occurredAt: '2026-05-26T12:00:00.000Z',
          type: 'FOOD',
          time: '12:00',
          byName: 'કૂતરો',
          edited: false,
          summary: 'Khichdi · 50g · Fully',
          details: ['Vomiting: no'],
          stills: [still('a1')],
          links: [],
        },
        {
          occurredAt: '2026-05-26T11:30:00.000Z',
          type: 'SURGERY',
          time: '11:30',
          byName: 'Dr. Iyer',
          edited: false,
          summary: 'Fracture repair (45 min) — Dr. Iyer',
          details: [],
          stills: [],
          links: [],
          crossRef: 'surgery',
        },
      ],
    },
  ],
  documents: [],
};

describe('renderPatientReportPdf', () => {
  it('renders the v2 document (brand, sections, recovery, sign-off, mixed scripts)', async () => {
    const mk = (rgb: { r: number; g: number; b: number }, w: number, h: number) =>
      sharp({ create: { width: w, height: h, channels: 3 as const, background: rgb } })
        .jpeg()
        .toBuffer();
    const [imgA, imgB] = await Promise.all([
      mk({ r: 21, g: 128, b: 61 }, 400, 300),
      mk({ r: 14, g: 124, b: 123 }, 300, 500),
    ]);
    const buf = await renderPatientReportPdf(
      model,
      new Map([
        ['a1', { data: imgA, width: 400, height: 300 }],
        ['a2', { data: imgB, width: 300, height: 500 }],
      ]),
    );
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(4000);
  });
});
