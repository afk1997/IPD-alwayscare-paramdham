import { describe, expect, it } from 'vitest';
import { collectImageAssets } from '../data';
import type { ReportModel } from '../model';

const model = {
  admissionMedia: [{ assetId: 'adm1', storageKey: 'k-adm1', kind: 'PHOTO', label: null, filename: 'a' }],
  days: [
    {
      key: 'd',
      label: 'd',
      entries: [
        {
          occurredAt: 'iso',
          stills: [{ assetId: 'p1', storageKey: 'k-p1', kind: 'PHOTO', label: null, filename: 'p' }],
          type: 'FOOD',
          time: '12:00',
          byName: 'x',
          edited: false,
          summary: '',
          details: [],
          links: [],
        },
      ],
    },
  ],
  documents: [
    {
      id: 'd1',
      category: 'MEDICAL',
      kind: 'x',
      name: 'n',
      createdAt: 'iso',
      file: { assetId: 'doc1', storageKey: 'k-doc1', kind: 'PHOTO', filename: 'd' },
    },
  ],
} as unknown as ReportModel;

describe('collectImageAssets', () => {
  it('dedupes and includes activity + admission + document images', () => {
    const got = collectImageAssets(model)
      .map((x) => x.assetId)
      .sort();
    expect(got).toEqual(['adm1', 'doc1', 'p1']);
  });
});
