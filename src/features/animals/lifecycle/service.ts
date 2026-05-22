import { assertOwnedReadyAssets } from '@/features/media/service';
import { writeAuditLog } from '@/lib/audit';
import { NotFoundError } from '@/lib/errors';
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
    const now = new Date();

    const updated = await tx.animal.update({
      where: { id: parsed.animalId },
      data: {
        status: 'DISCHARGED',
        dischargedAt: now,
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
    const now = new Date();

    const updated = await tx.animal.update({
      where: { id: parsed.animalId },
      data: {
        status: 'DECEASED',
        deceasedAt: now,
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
