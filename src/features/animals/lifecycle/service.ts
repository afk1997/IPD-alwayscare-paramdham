import { assertOwnedReadyAssets } from '@/features/media/service';
import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan } from '@/lib/rbac';
import { type DeathInput, DeathSchema, type DischargeInput, DischargeSchema } from './schema';

interface ActorWithName extends Actor {
  name: string;
}

export async function dischargeAnimal(actor: ActorWithName, input: DischargeInput) {
  assertCan(actor, 'animal.discharge');
  const parsed = DischargeSchema.parse(input);
  // RBAC-2: verify the caller actually uploaded the document files being
  // attached. Without this, anyone with discharge rights could attach an
  // arbitrary MediaAsset id (including PENDING ones or another user's
  // uploads), giving them a back-door read path via /api/files/[id].
  if (parsed.documentFileIds.length > 0) {
    await assertOwnedReadyAssets(actor, parsed.documentFileIds);
  }

  return prisma.$transaction(async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: parsed.animalId, deletedAt: null },
    });
    if (!animal) throw new NotFoundError('Animal', parsed.animalId);
    // Lifecycle is terminal. Without this guard a second discharge hits the
    // DischargeRecord PK (animalId) as an opaque P2002, and a
    // discharge-after-death would leave contradictory status/timestamps and
    // double-count the animal in today's stats.
    if (animal.status === 'DISCHARGED' || animal.status === 'DECEASED') {
      throw new ValidationError(
        animal.status === 'DECEASED'
          ? 'This patient is already recorded as deceased'
          : 'This patient is already discharged',
      );
    }
    const now = new Date();

    const updated = await tx.animal.update({
      where: { id: parsed.animalId },
      data: {
        status: 'DISCHARGED',
        dischargedAt: now,
        cageId: null,
        editedAt: now,
        editedById: actor.id,
      },
    });

    await tx.dischargeRecord.create({
      data: {
        animalId: parsed.animalId,
        summary: parsed.summary,
        instructions: parsed.instructions ?? null,
        dischargedAt: now,
        dischargedById: actor.id,
      },
    });

    if (parsed.documentFileIds.length > 0) {
      await tx.document.createMany({
        data: parsed.documentFileIds.map((fileId) => ({
          animalId: parsed.animalId,
          category: 'CONSENT' as const,
          kind: 'Discharge summary',
          name: 'Discharge document',
          fileId,
          uploadedById: actor.id,
        })),
      });
    }

    // SD-7: Discharge previously fabricated an ADMISSION-typed activity
    // row which polluted admission counts and clouded the audit. The
    // discharge is now fully represented by DischargeRecord + the
    // Animal.dischargedAt update + this audit row.
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Animal',
      entityId: parsed.animalId,
      before: { status: animal.status, dischargedAt: animal.dischargedAt?.toISOString() ?? null },
      after: { status: 'DISCHARGED', dischargedAt: now.toISOString(), summary: parsed.summary },
      context: { lifecycle: 'discharge' },
    });

    return updated;
  });
}

export async function recordDeath(actor: ActorWithName, input: DeathInput) {
  assertCan(actor, 'animal.death');
  const parsed = DeathSchema.parse(input);
  if (parsed.documentFileIds.length > 0) {
    await assertOwnedReadyAssets(actor, parsed.documentFileIds);
  }

  return prisma.$transaction(async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: parsed.animalId, deletedAt: null },
    });
    if (!animal) throw new NotFoundError('Animal', parsed.animalId);
    // Lifecycle is terminal — see dischargeAnimal. Blocks double-death (an
    // opaque DeathRecord PK violation) and death-after-discharge (which would
    // leave both records attached with contradictory timestamps).
    if (animal.status === 'DISCHARGED' || animal.status === 'DECEASED') {
      throw new ValidationError(
        animal.status === 'DISCHARGED'
          ? 'This patient is already discharged'
          : 'This patient is already recorded as deceased',
      );
    }
    const now = new Date();

    const updated = await tx.animal.update({
      where: { id: parsed.animalId },
      data: {
        status: 'DECEASED',
        deceasedAt: now,
        cageId: null,
        editedAt: now,
        editedById: actor.id,
      },
    });

    await tx.deathRecord.create({
      data: {
        animalId: parsed.animalId,
        causeOfDeath: parsed.causeOfDeath,
        diedAt: now,
        bodyHandedOverTo: parsed.bodyHandedOverTo ?? null,
        bodyHandedOverAt: parsed.bodyHandedOverTo ? now : null,
        recordedById: actor.id,
      },
    });

    if (parsed.documentFileIds.length > 0) {
      await tx.document.createMany({
        data: parsed.documentFileIds.map((fileId) => ({
          animalId: parsed.animalId,
          category: 'DEATH' as const,
          kind: 'Death record',
          name: 'Death document',
          fileId,
          uploadedById: actor.id,
        })),
      });
    }

    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Animal',
      entityId: parsed.animalId,
      before: { status: animal.status, deceasedAt: animal.deceasedAt?.toISOString() ?? null },
      after: { status: 'DECEASED', causeOfDeath: parsed.causeOfDeath, diedAt: now.toISOString() },
      context: { lifecycle: 'death' },
    });

    return updated;
  });
}

export async function invalidateLifecycle(actor: Actor, animalId: string) {
  assertCan(actor, 'lifecycle.invalidate');
  return prisma.$transaction(async (tx) => {
    const animal = await tx.animal.findFirst({ where: { id: animalId, deletedAt: null } });
    if (!animal) throw new NotFoundError('Animal', animalId);
    if (animal.status !== 'DECEASED' && animal.status !== 'DISCHARGED') {
      throw new ValidationError('This patient is not discharged or deceased');
    }
    const kind = animal.status === 'DECEASED' ? 'death' : 'discharge';
    const now = new Date();
    if (kind === 'death') {
      await tx.deathRecord.update({
        where: { animalId },
        data: { invalidatedAt: now, invalidatedById: actor.id },
      });
    } else {
      await tx.dischargeRecord.update({
        where: { animalId },
        data: { invalidatedAt: now, invalidatedById: actor.id },
      });
    }
    // Return to active care. cageId is already null (released at close); do NOT
    // restore the old cage — it may now hold another patient.
    const updated = await tx.animal.update({
      where: { id: animalId },
      data: {
        status: 'OBSERVATION',
        deceasedAt: null,
        dischargedAt: null,
        editedAt: now,
        editedById: actor.id,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Animal',
      entityId: animalId,
      before: { status: animal.status },
      after: { status: 'OBSERVATION' },
      context: { lifecycle: 'invalidate', kind },
    });
    return updated;
  });
}

export async function revalidateLifecycle(actor: Actor, animalId: string) {
  assertCan(actor, 'lifecycle.invalidate');
  return prisma.$transaction(async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, deletedAt: null },
      include: { deathRecord: true, dischargeRecord: true },
    });
    if (!animal) throw new NotFoundError('Animal', animalId);
    if (animal.status === 'DECEASED' || animal.status === 'DISCHARGED') {
      throw new ValidationError('This patient is already closed');
    }
    const now = new Date();
    if (animal.deathRecord?.invalidatedAt) {
      await tx.deathRecord.update({
        where: { animalId },
        data: { invalidatedAt: null, invalidatedById: null },
      });
      const updated = await tx.animal.update({
        where: { id: animalId },
        data: {
          status: 'DECEASED',
          deceasedAt: animal.deathRecord.diedAt,
          cageId: null,
          editedAt: now,
          editedById: actor.id,
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        action: 'update',
        entityType: 'Animal',
        entityId: animalId,
        before: { status: animal.status },
        after: { status: 'DECEASED' },
        context: { lifecycle: 'revalidate', kind: 'death' },
      });
      return updated;
    }
    if (animal.dischargeRecord?.invalidatedAt) {
      await tx.dischargeRecord.update({
        where: { animalId },
        data: { invalidatedAt: null, invalidatedById: null },
      });
      const updated = await tx.animal.update({
        where: { id: animalId },
        data: {
          status: 'DISCHARGED',
          dischargedAt: animal.dischargeRecord.dischargedAt,
          cageId: null,
          editedAt: now,
          editedById: actor.id,
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        action: 'update',
        entityType: 'Animal',
        entityId: animalId,
        before: { status: animal.status },
        after: { status: 'DISCHARGED' },
        context: { lifecycle: 'revalidate', kind: 'discharge' },
      });
      return updated;
    }
    throw new ValidationError('No invalidated death or discharge to re-validate');
  });
}
