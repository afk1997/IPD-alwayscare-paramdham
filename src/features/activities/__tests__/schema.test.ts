import { describe, expect, it } from 'vitest';
import { CreateActivitySchema, UpdateActivitySchema } from '../schema';

const baseTreatment = {
  type: 'TREATMENT' as const,
  animalId: 'animal-1',
  data: { meds: [{ name: 'Amoxiclav', dose: '20mg/kg', route: 'Oral' as const }] },
  mediaAssetIds: [],
};

describe('CreateActivitySchema — byName', () => {
  it('rejects missing byName', () => {
    const result = CreateActivitySchema.safeParse({ ...baseTreatment });
    expect(result.success).toBe(false);
  });

  it('rejects empty byName', () => {
    const result = CreateActivitySchema.safeParse({ ...baseTreatment, byName: '' });
    expect(result.success).toBe(false);
  });

  it('accepts a non-empty byName', () => {
    const result = CreateActivitySchema.safeParse({ ...baseTreatment, byName: 'Dr. Mehta' });
    expect(result.success).toBe(true);
  });
});

describe('UpdateActivitySchema', () => {
  it('accepts an empty patch (all fields optional)', () => {
    expect(UpdateActivitySchema.safeParse({}).success).toBe(true);
  });

  it('rejects an explicit empty byName', () => {
    expect(UpdateActivitySchema.safeParse({ byName: '' }).success).toBe(false);
  });

  it('rejects byName > 120 chars', () => {
    expect(UpdateActivitySchema.safeParse({ byName: 'A'.repeat(121) }).success).toBe(false);
  });

  it('accepts a valid byName change', () => {
    expect(UpdateActivitySchema.safeParse({ byName: 'Dr. Iyer' }).success).toBe(true);
  });

  it('accepts a remarks null (clearing remarks)', () => {
    expect(UpdateActivitySchema.safeParse({ remarks: null }).success).toBe(true);
  });
});
