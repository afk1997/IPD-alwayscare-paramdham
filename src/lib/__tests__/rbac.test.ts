import { describe, expect, it } from 'vitest';
import { RbacError } from '../errors';
import { assertCan, can } from '../rbac';

describe('rbac matrix — negative paths', () => {
  it('STAFF cannot delete a document', () => {
    expect(can({ id: 'u1', role: 'STAFF' }, 'document.delete')).toBe(false);
    expect(() => assertCan({ id: 'u1', role: 'STAFF' }, 'document.delete')).toThrowError(RbacError);
  });

  it('STAFF cannot delete an animal', () => {
    expect(can({ id: 'u1', role: 'STAFF' }, 'animal.delete')).toBe(false);
  });

  it('DOCTOR cannot manage users', () => {
    expect(can({ id: 'u1', role: 'DOCTOR' }, 'user.manage')).toBe(false);
    expect(() => assertCan({ id: 'u1', role: 'DOCTOR' }, 'user.manage')).toThrowError(RbacError);
  });

  it('DOCTOR cannot read the audit log', () => {
    expect(can({ id: 'u1', role: 'DOCTOR' }, 'audit.read.all')).toBe(false);
  });

  it('DOCTOR cannot reach the Trash page (trash.read)', () => {
    expect(can({ id: 'u1', role: 'DOCTOR' }, 'trash.read')).toBe(false);
  });

  it('STAFF cannot log clinical activities (SURGERY, ROUND, DIAGNOSTIC)', () => {
    expect(can({ id: 'u1', role: 'STAFF' }, 'activity.create.clinical')).toBe(false);
  });

  it('STAFF cannot discharge an animal', () => {
    expect(can({ id: 'u1', role: 'STAFF' }, 'animal.discharge')).toBe(false);
  });

  it('STAFF cannot record a death', () => {
    expect(can({ id: 'u1', role: 'STAFF' }, 'animal.death')).toBe(false);
  });

  it('ADMIN sees everything', () => {
    const all = [
      'animal.create',
      'animal.read',
      'animal.update',
      'animal.delete',
      'animal.restore',
      'animal.discharge',
      'animal.death',
      'activity.create',
      'activity.create.clinical',
      'activity.update.any',
      'activity.delete',
      'activity.restore',
      'document.create',
      'document.delete',
      'document.restore',
      'document.read.all',
      'user.manage',
      'audit.read.all',
      'trash.read',
    ] as const;
    for (const a of all) {
      expect(can({ id: 'u1', role: 'ADMIN' }, a)).toBe(true);
    }
  });
});
