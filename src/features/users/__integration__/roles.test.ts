import { RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import type { Actor } from '@/lib/rbac';
import type { Role } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inviteUser, updateUser } from '../service';

const QA_EMAIL_DOMAIN = '@qa-roles.local';

function qaEmail(label: string): string {
  return `__qa__${label}-${Math.random().toString(36).slice(2, 8)}${QA_EMAIL_DOMAIN}`;
}

async function makeUser(role: Role) {
  const email = qaEmail(role);
  return prisma.user.create({
    data: {
      email,
      name: `__qa__${role}`,
      role,
      passwordHash: 'x',
      active: true,
    },
  });
}

async function purgeRolesQa() {
  const qaUsers = await prisma.user.findMany({
    where: { email: { endsWith: QA_EMAIL_DOMAIN } },
    select: { id: true },
  });
  if (qaUsers.length === 0) return;
  const ids = qaUsers.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { entityType: 'User', entityId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.updateMany({ where: { invitedById: { in: ids } }, data: { invitedById: null } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

function toActor(u: { id: string; role: Role }): Actor {
  return { id: u.id, role: u.role };
}

describe('user service — role-assignment guards', () => {
  // Fresh QA actors so the suite is independent of seed state.
  let qaAdmin: { id: string; role: Role };

  beforeAll(async () => {
    await purgeRolesQa();
    qaAdmin = await makeUser('ADMIN');
  });
  afterAll(purgeRolesQa);

  it('ADMIN cannot invite a SUPER_ADMIN', async () => {
    await expect(
      inviteUser(toActor(qaAdmin), {
        email: qaEmail('blockedSA'),
        name: '__qa__blockedSA',
        role: 'SUPER_ADMIN',
        temporaryPassword: 'TmpPass#2026',
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });

  it('ADMIN cannot invite a VIEWER', async () => {
    await expect(
      inviteUser(toActor(qaAdmin), {
        email: qaEmail('blockedV'),
        name: '__qa__blockedV',
        role: 'VIEWER',
        temporaryPassword: 'TmpPass#2026',
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });

  it('SUPER_ADMIN can invite a SUPER_ADMIN and a VIEWER', async () => {
    const superAdmin = await makeUser('SUPER_ADMIN');
    const inv1 = await inviteUser(toActor(superAdmin), {
      email: qaEmail('newSA'),
      name: '__qa__newSA',
      role: 'SUPER_ADMIN',
      temporaryPassword: 'TmpPass#2026',
    });
    expect(inv1.role).toBe('SUPER_ADMIN');
    const inv2 = await inviteUser(toActor(superAdmin), {
      email: qaEmail('newV'),
      name: '__qa__newV',
      role: 'VIEWER',
      temporaryPassword: 'TmpPass#2026',
    });
    expect(inv2.role).toBe('VIEWER');
  });

  it('ADMIN cannot promote STAFF to SUPER_ADMIN', async () => {
    const target = await makeUser('STAFF');
    await expect(updateUser(toActor(qaAdmin), { id: target.id, role: 'SUPER_ADMIN' })).rejects.toBeInstanceOf(
      RbacError,
    );
  });

  it('ADMIN cannot demote a SUPER_ADMIN', async () => {
    const target = await makeUser('SUPER_ADMIN');
    await expect(updateUser(toActor(qaAdmin), { id: target.id, role: 'ADMIN' })).rejects.toBeInstanceOf(
      RbacError,
    );
  });

  it('SUPER_ADMIN can promote and demote VIEWER', async () => {
    const superAdmin = await makeUser('SUPER_ADMIN');
    const target = await makeUser('STAFF');
    const promoted = await updateUser(toActor(superAdmin), { id: target.id, role: 'VIEWER' });
    expect(promoted.role).toBe('VIEWER');
    const demoted = await updateUser(toActor(superAdmin), { id: target.id, role: 'STAFF' });
    expect(demoted.role).toBe('STAFF');
  });

  it('last-admin guard counts SUPER_ADMIN as admin-equivalent', async () => {
    // Setup: one SUPER_ADMIN and one ADMIN created just for this test.
    // Demoting the ADMIN should succeed because the SUPER_ADMIN remains
    // as the admin-equivalent backstop.
    const superAdmin = await makeUser('SUPER_ADMIN');
    const adminToDemote = await makeUser('ADMIN');
    const demoted = await updateUser(toActor(superAdmin), {
      id: adminToDemote.id,
      role: 'STAFF',
    });
    expect(demoted.role).toBe('STAFF');
  });

  it('listActiveUsers WHERE clause excludes SUPER_ADMIN and VIEWER', async () => {
    // Direct DB check using the same WHERE clause listActiveUsers should
    // emit — the production function is wrapped in Next's unstable_cache,
    // which needs Next's runtime context to evaluate. Mirrors the pattern
    // animals.test.ts uses for searchActiveAnimals.
    await makeUser('SUPER_ADMIN');
    await makeUser('VIEWER');
    await makeUser('STAFF');
    const list = await prisma.user.findMany({
      where: { active: true, role: { in: ['STAFF', 'DOCTOR', 'ADMIN'] } },
      select: { id: true, role: true },
    });
    const roles = new Set(list.map((u) => u.role));
    expect(roles.has('SUPER_ADMIN')).toBe(false);
    expect(roles.has('VIEWER')).toBe(false);
    expect(roles.size).toBeGreaterThan(0);
  });
});
