import { writeAuditLog } from '@/lib/audit';
import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan } from '@/lib/rbac';
import type { Prisma } from '@prisma/client';
import { type DeathInput, DeathSchema, type DischargeInput, DischargeSchema } from './schema';

interface ActorWithName extends Actor {
  name: string;
}

export async function dischargeAnimal(actor: ActorWithName, input: DischargeInput) {
  assertCan(actor, 'animal.discharge');
  const parsed = DischargeSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const animal = await tx.animal.findUnique({ where: { id: parsed.animalId } });
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

    await tx.activity.create({
      data: {
        animalId: parsed.animalId,
        type: 'ADMISSION',
        byUserId: actor.id,
        byName: actor.name,
        occurredAt: now,
        remarks: 'Discharged',
        data: { summary: parsed.summary, kind: 'DISCHARGE' } as Prisma.InputJsonValue,
      },
    });

    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Animal',
      entityId: parsed.animalId,
      before: { status: animal.status },
      after: { status: 'DISCHARGED', dischargedAt: now.toISOString() },
    });

    return updated;
  });
}

export async function recordDeath(actor: ActorWithName, input: DeathInput) {
  assertCan(actor, 'animal.death');
  const parsed = DeathSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const animal = await tx.animal.findUnique({ where: { id: parsed.animalId } });
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

    if (parsed.postmortemFileId) {
      await tx.document.create({
        data: {
          animalId: parsed.animalId,
          category: 'DEATH',
          kind: 'Postmortem report',
          name: 'Postmortem',
          fileId: parsed.postmortemFileId,
          uploadedById: actor.id,
        },
      });
    }

    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Animal',
      entityId: parsed.animalId,
      before: { status: animal.status },
      after: { status: 'DECEASED', causeOfDeath: parsed.causeOfDeath, diedAt: now.toISOString() },
    });

    return updated;
  });
}
