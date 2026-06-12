import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { ReportModel } from '../model';
import { renderPatientReportPdf } from '../render';

const model: ReportModel = {
  generatedAt: '2026-05-31T06:30:00.000Z',
  rangeLabel: null,
  patient: {
    name: 'रॉकी',
    species: 'Dog',
    breedAge: 'Dog · Indie',
    sexAge: 'MALE · ~2y',
    cage: 'C-3',
    status: 'STABLE',
    admittedAt: '2026-05-25T10:00:00.000Z',
    complaint: 'Hit by vehicle',
    diagnosis: 'Fracture',
    rescuer: 'Asha',
    broughtBy: 'NGO',
    avatarAssetId: 'a1',
  },
  outcome: { kind: 'in-care', label: 'In care', causeOfDeath: null },
  stats: { days: 6, perType: [{ type: 'FOOD', label: 'Food & water', count: 1 }], photos: 1 },
  meds: [
    { name: 'Amoxiclav', doses: ['20mg/kg'], routes: ['Oral'], times: 2, days: 2, span: '26 May – 27 May' },
  ],
  admissionMedia: [],
  days: [
    {
      key: '2026-05-26',
      label: 'Tue 26 May 2026',
      entries: [
        {
          type: 'FOOD',
          time: '12:00',
          byName: 'કૂતરો',
          edited: false,
          summary: 'Khichdi · 50g · Fully',
          details: ['Vomiting: no'],
          stills: [{ assetId: 'a1', kind: 'PHOTO', label: 'bowl', filename: 'p.jpg', storageKey: 'k' }],
          links: [],
        },
      ],
    },
  ],
  documents: [],
};

describe('renderPatientReportPdf', () => {
  it('produces a PDF buffer (fonts load, image embeds, mixed scripts)', async () => {
    const img = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 21, g: 128, b: 61 } },
    })
      .jpeg()
      .toBuffer();
    const buf = await renderPatientReportPdf(
      model,
      new Map([['a1', { data: img, width: 400, height: 300 }]]),
    );
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
  });
});
