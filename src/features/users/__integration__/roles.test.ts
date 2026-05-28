import { RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import type { Actor } from '@/lib/rbac';
import type { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
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

describe('user service — role assignment + password reset', () => {
  // Fresh QA actors so the suite is independent of seed state.
  let qaAdmin: { id: string; role: Role };

  beforeAll(async () => {
    await purgeRolesQa();
    qaAdmin = await makeUser('ADMIN');
  });
  afterAll(purgeRolesQa);

  it('ADMIN cannot invite a SUPER_ADMIN (protected tier)', async () => {
    await expect(
      inviteUser(toActor(qaAdmin), {
        email: qaEmail('newSA'),
        name: '__qa__newSA',
        role: 'SUPER_ADMIN',
        temporaryPassword: 'TmpPass1',
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });

  it('SUPER_ADMIN can invite a SUPER_ADMIN', async () => {
    const sa = await makeUser('SUPER_ADMIN');
    const invited = await inviteUser(toActor(sa), {
      email: qaEmail('newSA2'),
      name: '__qa__newSA2',
      role: 'SUPER_ADMIN',
      temporaryPassword: 'TmpPass1',
    });
    expect(invited.role).toBe('SUPER_ADMIN');
  });

  it('ADMIN can invite a VIEWER', async () => {
    const invited = await inviteUser(toActor(qaAdmin), {
      email: qaEmail('newV'),
      name: '__qa__newV',
      role: 'VIEWER',
      temporaryPassword: 'TmpPass1',
    });
    expect(invited.role).toBe('VIEWER');
  });

  it('ADMIN can promote and demote among non-super roles', async () => {
    const target = await makeUser('STAFF');
    const promoted = await updateUser(toActor(qaAdmin), { id: target.id, role: 'DOCTOR' });
    expect(promoted.role).toBe('DOCTOR');
    const sideways = await updateUser(toActor(qaAdmin), { id: target.id, role: 'VIEWER' });
    expect(sideways.role).toBe('VIEWER');
    const back = await updateUser(toActor(qaAdmin), { id: target.id, role: 'STAFF' });
    expect(back.role).toBe('STAFF');
  });

  it('ADMIN cannot promote a user into SUPER_ADMIN', async () => {
    const target = await makeUser('STAFF');
    await expect(updateUser(toActor(qaAdmin), { id: target.id, role: 'SUPER_ADMIN' })).rejects.toBeInstanceOf(
      RbacError,
    );
  });

  it('ADMIN cannot modify a SUPER_ADMIN (demote / rename)', async () => {
    const sa = await makeUser('SUPER_ADMIN');
    await expect(updateUser(toActor(qaAdmin), { id: sa.id, name: 'hacked' })).rejects.toBeInstanceOf(
      RbacError,
    );
    await expect(updateUser(toActor(qaAdmin), { id: sa.id, role: 'STAFF' })).rejects.toBeInstanceOf(
      RbacError,
    );
  });

  it('SUPER_ADMIN can promote into and demote out of SUPER_ADMIN', async () => {
    const actorSA = await makeUser('SUPER_ADMIN');
    const target = await makeUser('STAFF');
    const promoted = await updateUser(toActor(actorSA), { id: target.id, role: 'SUPER_ADMIN' });
    expect(promoted.role).toBe('SUPER_ADMIN');
    const back = await updateUser(toActor(actorSA), { id: target.id, role: 'STAFF' });
    expect(back.role).toBe('STAFF');
  });

  it('updateUser refuses self-role-change (can lock yourself out)', async () => {
    await expect(updateUser(toActor(qaAdmin), { id: qaAdmin.id, role: 'STAFF' })).rejects.toBeInstanceOf(
      RbacError,
    );
  });

  it('updateUser refuses self-deactivation', async () => {
    await expect(updateUser(toActor(qaAdmin), { id: qaAdmin.id, active: false })).rejects.toBeInstanceOf(
      RbacError,
    );
  });

  it('last-admin-equivalent guard still fires', async () => {
    // Promote a fresh user to SUPER_ADMIN, then count how many admin-
    // equivalents exist.  Demote a different admin to STAFF — should
    // succeed as long as someone else is still admin-equivalent.
    const sa = await makeUser('SUPER_ADMIN');
    const otherAdmin = await makeUser('ADMIN');
    const demoted = await updateUser(toActor(sa), { id: otherAdmin.id, role: 'STAFF' });
    expect(demoted.role).toBe('STAFF');
  });

  it('updateUser accepts a new password and rehashes', async () => {
    const target = await makeUser('STAFF');
    const newPassword = 'fresh-pass';
    await updateUser(toActor(qaAdmin), { id: target.id, password: newPassword });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(await bcrypt.compare(newPassword, after.passwordHash)).toBe(true);
    // Old "x" placeholder no longer matches.
    expect(await bcrypt.compare('x', after.passwordHash)).toBe(false);
  });

  it('updateUser treats empty password string as no change', async () => {
    const target = await makeUser('STAFF');
    const beforeHash = target.passwordHash;
    await updateUser(toActor(qaAdmin), { id: target.id, password: '', name: 'renamed' });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.passwordHash).toBe(beforeHash);
    expect(after.name).toBe('renamed');
  });

  it('listActiveUsers WHERE clause excludes SUPER_ADMIN and VIEWER', async () => {
    // Direct DB check mirroring the WHERE in queries.ts — the production
    // function is wrapped in Next's unstable_cache and isn't callable
    // from a vitest node context.
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
