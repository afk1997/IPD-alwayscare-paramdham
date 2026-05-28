import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, RbacError, ValidationError } from '@/lib/errors';
import { folderResolver } from '@/lib/folders';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan, can } from '@/lib/rbac';
import type { Prisma, ActivityType as PrismaActivityType } from '@prisma/client';
import {
  ACTIVITY_DATA_SCHEMAS,
  type CreateActivityInput,
  CreateActivitySchema,
  type UpdateActivityInput,
  UpdateActivitySchema,
} from './schema';

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
  // ACT-3: confirm the animal exists and is not soft-deleted before
  // writing the activity.  Without this, a user could attach activities
  // to deleted patients (whose queries filter on Animal.deletedAt).
  const animal = await prisma.animal.findFirst({
    where: { id: parsed.animalId, deletedAt: null },
    select: { id: true },
  });
  if (!animal) throw new NotFoundError('Animal', parsed.animalId);
  const { assertOwnedReadyAssets } = await import('../media/service');
  await assertOwnedReadyAssets(actor, parsed.mediaAssetIds);

  // RBAC-9: only DOCTOR/ADMIN may re-attribute via `byName`. STAFF
  // entries are stamped with their own name regardless of payload so
  // they cannot impersonate a doctor in the audit/timeline.
  const canReattribute = can(actor, 'activity.update.any');
  const finalByName = canReattribute && parsed.byName ? parsed.byName : actor.name;

  return prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        animalId: parsed.animalId,
        type: parsed.type,
        byUserId: actor.id,
        byName: finalByName,
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

export async function updateActivity(actor: ActivityActor, activityId: string, patch: UpdateActivityInput) {
  // Parse the patch once — closes the gap where the prior loose
  // signature accepted empty `byName`, arbitrary-length `byName`, and
  // any string for `occurredAt`.  `data` is left as unknown here and
  // validated per-type below against the stored row's discriminator.
  const parsed = UpdateActivitySchema.parse(patch);

  const before = await prisma.activity.findFirst({
    where: { id: activityId, deletedAt: null, animal: { deletedAt: null } },
  });
  if (!before) throw new NotFoundError('Activity', activityId);

  const owns = before.byUserId === actor.id;
  const withinWindow = Date.now() - new Date(before.createdAt).getTime() < 24 * 60 * 60 * 1000;
  const canEditAny = can(actor, 'activity.update.any');
  if (!canEditAny && !(owns && withinWindow)) throw new RbacError('activity.update');

  const updateData: Prisma.ActivityUpdateInput = {
    editedAt: new Date(),
    editedBy: { connect: { id: actor.id } },
  };
  if (parsed.remarks !== undefined) updateData.remarks = parsed.remarks;
  if (parsed.data !== undefined) {
    // C3: validate the patch's `data` against the stored row's type.  Without
    // this, a STAFF user editing their own FOOD entry could swap the JSON
    // for an arbitrary shape (fake surgery findings, broken summarizer
    // inputs, etc.).  Build a one-shape schema keyed by the row's type.
    const schema = ACTIVITY_DATA_SCHEMAS[before.type as keyof typeof ACTIVITY_DATA_SCHEMAS];
    if (!schema) throw new ValidationError(`unknown activity type: ${before.type}`);
    const dataParsed = schema.parse(parsed.data);
    updateData.data = dataParsed as unknown as Prisma.InputJsonValue;
  }
  if (parsed.occurredAt !== undefined) updateData.occurredAt = new Date(parsed.occurredAt);
  // RBAC-9: STAFF cannot rename the author of an entry. Only DOCTOR/ADMIN
  // (activity.update.any holders) may rewrite byName.
  if (parsed.byName !== undefined && canEditAny) {
    updateData.byName = parsed.byName.trim();
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.activity.update({
      where: { id: activityId },
      data: updateData,
      include: { media: { include: { asset: true } }, byUser: { select: { id: true, name: true } } },
    });
    // Audit diff now captures byName + occurredAt alongside the existing
    // remarks/data.  A re-attribution edit ("by Dr. Mehta" → "by Dr. Iyer")
    // and an occurredAt back-fill both leave a trail.
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Activity',
      entityId: activityId,
      before: {
        remarks: before.remarks,
        data: before.data as Prisma.InputJsonValue,
        byName: before.byName,
        occurredAt: before.occurredAt.toISOString(),
      },
      after: {
        remarks: updated.remarks,
        data: updated.data as Prisma.InputJsonValue,
        byName: updated.byName,
        occurredAt: updated.occurredAt.toISOString(),
      },
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
      include: { media: { include: { asset: true } }, byUser: { select: { id: true, name: true } } },
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

  // RBAC-7: STAFF can only delete their own activity inside a 24h window.
  // Past that, only DOCTOR/ADMIN (activity.delete) can remove clinical
  // history. Mirrors the editing window already enforced in updateActivity.
  const owns = activity.byUserId === actor.id;
  const withinWindow = Date.now() - new Date(activity.createdAt).getTime() < 24 * 60 * 60 * 1000;
  const canDeleteAny = can(actor, 'activity.delete');
  if (!canDeleteAny && !(owns && withinWindow)) throw new RbacError('activity.delete');

  // ACT-8: race-safe — do the existence check inside the update by
  // matching deletedAt: null, and treat P2025 (no rows updated) as
  // "already deleted" rather than a hard error.
  let updated: typeof activity;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const u = await tx.activity.update({
        where: { id: activityId, deletedAt: null },
        data: { deletedAt: new Date(), editedById: actor.id, editedAt: new Date() },
        include: { media: { include: { asset: true } }, byUser: { select: { id: true, name: true } } },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        action: 'delete',
        entityType: 'Activity',
        entityId: activityId,
        before: {
          type: activity.type,
          animalId: activity.animalId,
          occurredAt: activity.occurredAt.toISOString(),
          byName: activity.byName,
        },
      });
      return u;
    });
  } catch (e) {
    // Prisma P2025 is the "record to update not found" error — race with
    // a concurrent delete; treat as a no-op rather than surfacing.
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2025') {
      return activity;
    }
    throw e;
  }

  await renameDriveFiles(actor.id, activity.media, 'delete');
  return updated;
}

export async function restoreActivity(actor: Actor, activityId: string) {
  // RBAC-3: the matrix now has a dedicated `activity.restore` action
  // (ADMIN-only for use from the Trash page), but the in-toast Undo
  // flow that triggers immediately after a delete needs to work for any
  // user who could delete it. So we accept either delete OR restore
  // privileges — whichever the caller holds.
  if (!can(actor, 'activity.delete') && !can(actor, 'activity.restore')) {
    throw new RbacError('activity.restore');
  }
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { media: { include: { asset: true } } },
  });
  if (!activity) throw new NotFoundError('Activity', activityId);
  if (!activity.deletedAt) return activity;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.activity.update({
      where: { id: activityId },
      data: { deletedAt: null, editedById: actor.id, editedAt: new Date() },
      include: { media: { include: { asset: true } }, byUser: { select: { id: true, name: true } } },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'restore',
      entityType: 'Activity',
      entityId: activityId,
      after: { type: activity.type, animalId: activity.animalId },
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
