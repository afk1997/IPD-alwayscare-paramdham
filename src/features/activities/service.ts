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
