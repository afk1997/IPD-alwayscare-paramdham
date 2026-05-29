import { describe, expect, it } from 'vitest';
import { RbacError } from '../errors';
import { type Action, type Actor, type Role, assertCan, assertOpenCase, can } from '../rbac';

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
      'cage.manage',
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

const ROLES: Role[] = ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'];

// Full permission matrix. T = allowed, F = denied.
// Columns: STAFF DOCTOR ADMIN SUPER_ADMIN VIEWER
const MATRIX: Record<Action, [boolean, boolean, boolean, boolean, boolean]> = {
  'animal.create': [true, true, true, true, false],
  'animal.read': [true, true, true, true, true],
  'animal.update': [false, true, true, true, false],
  'animal.delete': [false, false, true, true, false],
  'animal.restore': [false, false, true, true, false],
  'animal.discharge': [false, true, true, true, false],
  'animal.death': [false, true, true, true, false],
  'cage.manage': [false, true, true, true, false],
  'activity.create': [true, true, true, true, false],
  'activity.create.clinical': [false, true, true, true, false],
  'activity.update.any': [false, true, true, true, false],
  'activity.delete': [false, true, true, true, false],
  'activity.restore': [false, false, true, true, false],
  'document.create': [true, true, true, true, false],
  'document.delete': [false, true, true, true, false],
  'document.restore': [false, false, true, true, false],
  'document.read.all': [false, false, true, true, false],
  'user.manage': [false, false, true, true, false],
  'audit.read.all': [false, false, true, true, false],
  'trash.read': [false, false, true, true, false],
  'outcome.read': [false, true, true, true, true],
  'lifecycle.invalidate': [false, false, false, true, false],
};

describe('rbac permission matrix — full 5x19 table', () => {
  for (const [action, expected] of Object.entries(MATRIX) as [Action, boolean[]][]) {
    for (let i = 0; i < ROLES.length; i++) {
      const role = ROLES[i] as Role;
      const allowed = expected[i];
      it(`${role} ${allowed ? 'CAN' : 'cannot'} ${action}`, () => {
        const actor: Actor = { id: 'u1', role };
        expect(can(actor, action)).toBe(allowed);
      });
    }
  }

  it('VIEWER has zero write permissions', () => {
    const writes: Action[] = [
      'animal.create',
      'animal.update',
      'animal.delete',
      'animal.restore',
      'animal.discharge',
      'animal.death',
      'cage.manage',
      'activity.create',
      'activity.create.clinical',
      'activity.update.any',
      'activity.delete',
      'activity.restore',
      'document.create',
      'document.delete',
      'document.restore',
      'user.manage',
    ];
    for (const a of writes) {
      expect(can({ id: 'v', role: 'VIEWER' }, a)).toBe(false);
    }
  });

  it('SUPER_ADMIN has every ADMIN permission', () => {
    const actions = Object.keys(MATRIX) as Action[];
    for (const a of actions) {
      if (can({ id: 'a', role: 'ADMIN' }, a)) {
        expect(can({ id: 's', role: 'SUPER_ADMIN' }, a)).toBe(true);
      }
    }
  });
});

describe('outcome.read permission', () => {
  it.each(['VIEWER', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'] as const)('allows %s', (role) => {
    expect(can({ id: 'u', role }, 'outcome.read')).toBe(true);
  });
  it('denies STAFF', () => {
    expect(can({ id: 'u', role: 'STAFF' }, 'outcome.read')).toBe(false);
  });
});

describe('lifecycle.invalidate permission', () => {
  it('allows only SUPER_ADMIN', () => {
    expect(can({ id: 'u', role: 'SUPER_ADMIN' }, 'lifecycle.invalidate')).toBe(true);
    for (const role of ['STAFF', 'DOCTOR', 'ADMIN', 'VIEWER'] as const) {
      expect(can({ id: 'u', role }, 'lifecycle.invalidate')).toBe(false);
    }
  });
});

describe('assertOpenCase (closed-case lock)', () => {
  it('throws for a non-super actor on a DECEASED animal', () => {
    expect(() => assertOpenCase({ id: 'u', role: 'DOCTOR' }, 'DECEASED')).toThrow(RbacError);
  });
  it('throws for a non-super actor on a DISCHARGED animal', () => {
    expect(() => assertOpenCase({ id: 'u', role: 'ADMIN' }, 'DISCHARGED')).toThrow(RbacError);
  });
  it('allows SUPER_ADMIN on a DECEASED animal', () => {
    expect(() => assertOpenCase({ id: 'u', role: 'SUPER_ADMIN' }, 'DECEASED')).not.toThrow();
  });
  it('allows any role on an open (non-terminal) animal', () => {
    expect(() => assertOpenCase({ id: 'u', role: 'STAFF' }, 'OBSERVATION')).not.toThrow();
    expect(() => assertOpenCase({ id: 'u', role: 'DOCTOR' }, 'CRITICAL')).not.toThrow();
  });
});
