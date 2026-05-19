import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, RbacError } from '@/lib/errors';
import { folderResolver } from '@/lib/folders';
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
  const { assertOwnedReadyAssets } = await import('../media/service');
  await assertOwnedReadyAssets(actor, parsed.mediaAssetIds);

  return prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        animalId: parsed.animalId,
        type: parsed.type,
        byUserId: actor.id,
        byName: parsed.byName ?? actor.name,
        remarks: parsed.remarks ?? null,
        data: parsed.data as Prisma.InputJsonValue,
        ...(parsed.occurredAt ? { occurredAt: new Date(parsed.occurredAt) } : {}),
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
  patch: { remarks?: string | null; data?: unknown; occurredAt?: string; byName?: string },
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
  if (patch.occurredAt !== undefined) updateData.occurredAt = new Date(patch.occurredAt);
  if (patch.byName !== undefined && patch.byName.trim().length > 0) {
    updateData.byName = patch.byName.trim();
  }

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
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { media: { include: { asset: true } } },
  });
  if (!activity) throw new NotFoundError('Activity', activityId);
  if (activity.deletedAt) return activity;

  const owns = activity.byUserId === actor.id;
  if (!owns && !can(actor, 'activity.delete')) throw new RbacError('activity.delete');

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.activity.update({
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
    return u;
  });

  await renameDriveFiles(actor.id, activity.media, 'delete');
  return updated;
}

export async function restoreActivity(actor: Actor, activityId: string) {
  if (!can(actor, 'activity.delete')) throw new RbacError('activity.restore');
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { media: { include: { asset: true } } },
  });
  if (!activity) throw new NotFoundError('Activity', activityId);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.activity.update({
      where: { id: activityId },
      data: { deletedAt: null, editedById: actor.id, editedAt: new Date() },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'restore',
      entityType: 'Activity',
      entityId: activityId,
    });
    return u;
  });

  await renameDriveFiles(actor.id, activity.media, 'restore');
  return updated;
}

type MediaRow = {
  asset: { id: string; storageKey: string; filename: string; originalFilename: string | null };
};

async function renameDriveFiles(
  actorId: string,
  media: MediaRow[],
  mode: 'delete' | 'restore',
): Promise<void> {
  const folders = folderResolver();
  const targets = media.filter((m) => m.asset.storageKey.startsWith('gdrive:'));
  if (targets.length === 0) return;

  const results = await Promise.allSettled(
    targets.map(async (m) => {
      const original = m.asset.originalFilename ?? m.asset.filename;
      const newName =
        mode === 'delete'
          ? await folders.markDeleted(m.asset.storageKey, m.asset.filename)
          : await folders.unmarkDeleted(m.asset.storageKey, original);
      if (newName !== m.asset.filename) {
        await prisma.mediaAsset.update({
          where: { id: m.asset.id },
          data: { filename: newName },
        });
      }
      return { id: m.asset.id, newName };
    }),
  );

  const failed = results
    .map((r, i) => ({ r, asset: targets[i]?.asset }))
    .filter(
      (x): x is { r: PromiseRejectedResult; asset: MediaRow['asset'] } =>
        x.r.status === 'rejected' && !!x.asset,
    );

  if (failed.length > 0) {
    // Write a single audit-log row recording which assets couldn't be
    // renamed so an admin can reconcile manually.
    await writeAuditLog(prisma, {
      actorId,
      action: 'update',
      entityType: 'MediaAsset',
      entityId: failed[0]?.asset.id ?? 'unknown',
      context: {
        driveOp: mode === 'delete' ? 'rename:[DELETED]' : 'rename:restore',
        failures: failed.map((f) => ({
          assetId: f.asset.id,
          reason: f.r.reason instanceof Error ? f.r.reason.message : String(f.r.reason),
        })),
      },
    });
  }
}
