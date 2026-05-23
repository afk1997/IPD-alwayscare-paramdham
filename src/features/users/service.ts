import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, RbacError, ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan } from '@/lib/rbac';
import type { Role as PrismaRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { type InviteUserInput, InviteUserSchema, type UpdateUserInput, UpdateUserSchema } from './schema';

export async function inviteUser(actor: Actor, input: InviteUserInput) {
  assertCan(actor, 'user.manage');
  const parsed = InviteUserSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
  if (existing) throw new ValidationError('Email already in use');
  const passwordHash = await bcrypt.hash(parsed.temporaryPassword, 12);

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: parsed.email.toLowerCase(),
        name: parsed.name,
        role: parsed.role as PrismaRole,
        passwordHash,
        active: true,
        invitedById: actor.id,
        invitedAt: new Date(),
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'create',
      entityType: 'User',
      entityId: created.id,
      after: { email: created.email, name: created.name, role: created.role },
    });
    return created;
  });
}

export async function updateUser(actor: Actor, input: UpdateUserInput) {
  assertCan(actor, 'user.manage');
  const parsed = UpdateUserSchema.parse(input);
  const before = await prisma.user.findUnique({ where: { id: parsed.id } });
  if (!before) throw new NotFoundError('User', parsed.id);

  // H3-s: refuse self-role-change.  Without this, an ADMIN editing their
  // own row could downgrade to STAFF and lose access mid-shift; worse,
  // they could accidentally make themselves the only person who can no
  // longer fix it.
  if (actor.id === parsed.id && parsed.role !== undefined && parsed.role !== before.role) {
    throw new RbacError('cannot change your own role');
  }
  // H3-s (extended): refuse self-deactivation.  deactivateUser() blocks
  // this for its own callers, but updateUserAction({id: ownId,
  // active: false}) bypasses that wrapper — close the gap here too.
  if (actor.id === parsed.id && parsed.active === false) {
    throw new RbacError('cannot deactivate yourself');
  }

  // H2-s (broadened): refuse to deactivate or demote the LAST active
  // admin-equivalent. SUPER_ADMIN and ADMIN count together — losing all
  // of them locks the clinic out of the admin surface.
  const wouldRemoveAdminEquivalent =
    (before.role === 'ADMIN' || before.role === 'SUPER_ADMIN') &&
    ((parsed.role !== undefined && parsed.role !== 'ADMIN' && parsed.role !== 'SUPER_ADMIN') ||
      (parsed.active !== undefined && parsed.active === false));
  if (wouldRemoveAdminEquivalent) {
    const otherActiveAdminEquivalents = await prisma.user.count({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        active: true,
        id: { not: parsed.id },
      },
    });
    if (otherActiveAdminEquivalents === 0) {
      throw new RbacError('cannot remove the last active admin');
    }
  }

  const updateData: { name?: string; role?: PrismaRole; active?: boolean; passwordHash?: string } = {};
  if (parsed.name !== undefined) updateData.name = parsed.name;
  if (parsed.role !== undefined) updateData.role = parsed.role as PrismaRole;
  if (parsed.active !== undefined) updateData.active = parsed.active;
  // Empty-string password means "no change" — only hash when a real
  // value was provided.  The audit row records the change as a bare
  // "password reset" flag; the hash itself never lands in the log.
  const passwordChanged = parsed.password !== undefined && parsed.password.length > 0;
  if (passwordChanged) {
    updateData.passwordHash = await bcrypt.hash(parsed.password as string, 12);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: parsed.id },
      data: updateData,
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'User',
      entityId: updated.id,
      before: { name: before.name, role: before.role, active: before.active },
      after: {
        name: updated.name,
        role: updated.role,
        active: updated.active,
        ...(passwordChanged ? { passwordReset: true } : {}),
      },
    });
    return updated;
  });
}

export async function deactivateUser(actor: Actor, userId: string) {
  if (actor.id === userId) throw new RbacError('cannot deactivate yourself');
  return updateUser(actor, { id: userId, active: false });
}
