import { describe, expect, it } from 'vitest';
import { CreateAnimalSchema } from '../schema';

// Minimal valid input minus complaint — every other required field either
// appears here or carries a schema default.
const base = { name: 'Bruno', species: 'Dog' as const };

describe('CreateAnimalSchema — complaint', () => {
  it('rejects a missing complaint', () => {
    const r = CreateAnimalSchema.safeParse(base);
    expect(r.success).toBe(false);
  });

  it('rejects an empty complaint with the field message', () => {
    const r = CreateAnimalSchema.safeParse({ ...base, complaint: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === 'complaint');
      expect(issue?.message).toBe('Chief complaint is required');
    }
  });

  it('rejects a whitespace-only complaint', () => {
    const r = CreateAnimalSchema.safeParse({ ...base, complaint: '   ' });
    expect(r.success).toBe(false);
  });

  it('accepts and trims a real complaint', () => {
    const r = CreateAnimalSchema.safeParse({ ...base, complaint: '  Hit by vehicle ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.complaint).toBe('Hit by vehicle');
  });
});
