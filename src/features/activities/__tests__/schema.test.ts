import { describe, expect, it } from 'vitest';
import { CreateActivitySchema } from '../schema';

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
