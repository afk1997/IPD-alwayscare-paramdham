import { writeAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan } from '@/lib/rbac';
import type { AnimalStatus, Gender, Prisma, TestKind, Vaccination } from '@prisma/client';
import { type CreateAnimalInput, CreateAnimalSchema } from './schema';

function nz(v: string | undefined | null): string | null {
  if (v === '' || v === undefined || v === null) return null;
  return v;
}

export async function createAnimal(actor: Actor, input: CreateAnimalInput) {
  assertCan(actor, 'animal.create');
  const parsed = CreateAnimalSchema.parse(input);

  const data: Prisma.AnimalCreateInput = {
    name: parsed.name,
    species: parsed.species,
    breed: nz(parsed.breed),
    gender: (parsed.gender ?? null) as Gender | null,
    ageText: nz(parsed.ageText),
    color: nz(parsed.color),
    weightKg: parsed.weightKg ?? null,
    vaccination: parsed.vaccination as Vaccination,
    sterilized: parsed.sterilized,
    aggressive: parsed.aggressive,
    rescuer: nz(parsed.rescuer),
    rescuerPhone: nz(parsed.rescuerPhone),
    address: nz(parsed.address),
    ngo: nz(parsed.ngo),
    broughtBy: nz(parsed.broughtBy),
    complaint: nz(parsed.complaint),
    injuryType: nz(parsed.injuryType),
    history: nz(parsed.history),
    diagnosis: nz(parsed.diagnosis),
    surgeryRequired: nz(parsed.surgeryRequired),
    contagious: parsed.contagious,
    status: parsed.status as AnimalStatus,
    ward: nz(parsed.ward),
    createdBy: { connect: { id: actor.id } },
    testsAdvised: {
      create: parsed.testsAdvised.map((test) => ({ test: test as TestKind })),
    },
    media: {
      create: parsed.mediaAssetIds.map((assetId, order) => ({
        asset: { connect: { id: assetId } },
        order,
        source: 'admission',
      })),
    },
  };

  return prisma.$transaction(async (tx) => {
    const created = await tx.animal.create({
      data,
      include: { testsAdvised: true, media: { include: { asset: true } } },
    });

    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'create',
      entityType: 'Animal',
      entityId: created.id,
      after: {
        id: created.id,
        name: created.name,
        species: created.species,
        status: created.status,
      },
    });

    return created;
  });
}
