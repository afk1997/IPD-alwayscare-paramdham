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
