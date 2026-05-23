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

  // Only SUPER_ADMIN can grant the SUPER_ADMIN or VIEWER role. ADMIN can
  // still invite STAFF/DOCTOR/ADMIN normally.
  if ((parsed.role === 'SUPER_ADMIN' || parsed.role === 'VIEWER') && actor.role !== 'SUPER_ADMIN') {
    throw new RbacError(`only SUPER_ADMIN can assign ${parsed.role}`);
  }

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

  // Only SUPER_ADMIN can modify a SUPER_ADMIN or VIEWER user — period.
  // That covers role changes (either direction), deactivations, and
  // renames.  An earlier version of this guard only checked role
  // changes; deactivateUser / updateUser-with-name slipped through and
  // an ADMIN could turn off a SUPER_ADMIN.  Now: if the target is
  // restricted, or the requested role is restricted, the actor must be
  // SUPER_ADMIN.
  const targetIsRestricted = before.role === 'SUPER_ADMIN' || before.role === 'VIEWER';
  const settingRestrictedRole =
    parsed.role !== undefined &&
    parsed.role !== before.role &&
    (parsed.role === 'SUPER_ADMIN' || parsed.role === 'VIEWER');
  if ((targetIsRestricted || settingRestrictedRole) && actor.role !== 'SUPER_ADMIN') {
    throw new RbacError('only SUPER_ADMIN can change SUPER_ADMIN or VIEWER users');
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

  const updateData: { name?: string; role?: PrismaRole; active?: boolean } = {};
  if (parsed.name !== undefined) updateData.name = parsed.name;
  if (parsed.role !== undefined) updateData.role = parsed.role as PrismaRole;
  if (parsed.active !== undefined) updateData.active = parsed.active;

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
      after: { name: updated.name, role: updated.role, active: updated.active },
    });
    return updated;
  });
}

export async function deactivateUser(actor: Actor, userId: string) {
  if (actor.id === userId) throw new RbacError('cannot deactivate yourself');
  return updateUser(actor, { id: userId, active: false });
}
