import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan, can } from '@/lib/rbac';
import type { Prisma, ActivityType as PrismaActivityType } from '@prisma/client';
import { type CreateActivityInput, CreateActivitySchema } from './schema';

const CLINICAL_TYPES: PrismaActivityType[] = ['ROUND', 'DIAGNOSTIC', 'SURGERY'];

function requiredAction(type: PrismaActivityType) {
  return CLINICAL_TYPES.includes(type) ? 'activity.create.clinical' : 'activity.create';
}

export interface ActivityActor extends Actor {
  name: string;
}

export async function createActivity(actor: ActivityActor, input: CreateActivityInput) {
  const parsed = CreateActivitySchema.parse(input);
  assertCan(actor, requiredAction(parsed.type) as 'activity.create' | 'activity.create.clinical');

  return prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        animalId: parsed.animalId,
        type: parsed.type,
        byUserId: actor.id,
        byName: actor.name,
        remarks: parsed.remarks ?? null,
        data: parsed.data as Prisma.InputJsonValue,
        media: {
          create: parsed.mediaAssetIds.map((assetId) => ({
            asset: { connect: { id: assetId } },
          })),
        },
      },
      include: { media: { include: { asset: true } } },
    });

    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'create',
      entityType: 'Activity',
      entityId: created.id,
      after: { type: created.type, animalId: created.animalId },
    });

    return created;
  });
}

export async function updateActivity(
  actor: ActivityActor,
  activityId: string,
  patch: { remarks?: string | null; data?: unknown },
) {
  const before = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!before) throw new NotFoundError('Activity', activityId);

  const owns = before.byUserId === actor.id;
  const withinWindow = Date.now() - new Date(before.createdAt).getTime() < 24 * 60 * 60 * 1000;
  const canEditAny = can(actor, 'activity.update.any');
  if (!canEditAny && !(owns && withinWindow)) throw new RbacError('activity.update');

  const updateData: Prisma.ActivityUpdateInput = {
    editedAt: new Date(),
    editedBy: { connect: { id: actor.id } },
  };
  if (patch.remarks !== undefined) updateData.remarks = patch.remarks;
  if (patch.data !== undefined) updateData.data = patch.data as Prisma.InputJsonValue;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.activity.update({
      where: { id: activityId },
      data: updateData,
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Activity',
      entityId: activityId,
      before: { remarks: before.remarks, data: before.data as Prisma.InputJsonValue },
      after: { remarks: updated.remarks, data: updated.data as Prisma.InputJsonValue },
    });
    return updated;
  });
}

export async function duplicateActivity(actor: ActivityActor, activityId: string) {
  const original = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!original) throw new NotFoundError('Activity', activityId);
  assertCan(actor, requiredAction(original.type) as 'activity.create' | 'activity.create.clinical');

  return prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        animalId: original.animalId,
        type: original.type,
        byUserId: actor.id,
        byName: actor.name,
        remarks: original.remarks,
        data: original.data as Prisma.InputJsonValue,
        duplicatedFromId: original.id,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'create',
      entityType: 'Activity',
      entityId: created.id,
      after: { type: created.type, duplicatedFromId: original.id },
    });
    return created;
  });
}

export async function softDeleteActivity(actor: Actor, activityId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) throw new NotFoundError('Activity', activityId);
  if (activity.deletedAt) return activity;

  const owns = activity.byUserId === actor.id;
  if (!owns && !can(actor, 'activity.delete')) throw new RbacError('activity.delete');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.activity.update({
      where: { id: activityId },
      data: { deletedAt: new Date(), editedById: actor.id, editedAt: new Date() },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'delete',
      entityType: 'Activity',
      entityId: activityId,
      before: { type: activity.type, animalId: activity.animalId },
    });
    return updated;
  });
}

export async function restoreActivity(actor: Actor, activityId: string) {
  if (!can(actor, 'activity.delete')) throw new RbacError('activity.restore');
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) throw new NotFoundError('Activity', activityId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.activity.update({
      where: { id: activityId },
      data: { deletedAt: null, editedById: actor.id, editedAt: new Date() },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'restore',
      entityType: 'Activity',
      entityId: activityId,
    });
    return updated;
  });
}
