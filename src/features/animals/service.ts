import { writeAuditLog } from '@/lib/audit';
import { NotFoundError } from '@/lib/errors';
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

export interface UpdateAnimalPatch {
  name?: string;
  breed?: string | null;
  ageText?: string | null;
  color?: string | null;
  weightKg?: number | null;
  vaccination?: Vaccination;
  sterilized?: boolean;
  aggressive?: boolean;
  rescuer?: string | null;
  rescuerPhone?: string | null;
  address?: string | null;
  ngo?: string | null;
  broughtBy?: string | null;
  complaint?: string | null;
  injuryType?: string | null;
  history?: string | null;
  diagnosis?: string | null;
  surgeryRequired?: string | null;
  contagious?: boolean;
  status?: AnimalStatus;
  ward?: string | null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: applies many optional patch fields one by one
export async function updateAnimal(actor: Actor, animalId: string, patch: UpdateAnimalPatch) {
  assertCan(actor, 'animal.update');
  const before = await prisma.animal.findUnique({ where: { id: animalId } });
  if (!before) throw new NotFoundError('Animal', animalId);

  const data: Prisma.AnimalUpdateInput = {
    editedAt: new Date(),
    editedById: actor.id,
  };
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.breed !== undefined) data.breed = patch.breed;
  if (patch.ageText !== undefined) data.ageText = patch.ageText;
  if (patch.color !== undefined) data.color = patch.color;
  if (patch.weightKg !== undefined) data.weightKg = patch.weightKg;
  if (patch.vaccination !== undefined) data.vaccination = patch.vaccination;
  if (patch.sterilized !== undefined) data.sterilized = patch.sterilized;
  if (patch.aggressive !== undefined) data.aggressive = patch.aggressive;
  if (patch.rescuer !== undefined) data.rescuer = patch.rescuer;
  if (patch.rescuerPhone !== undefined) data.rescuerPhone = patch.rescuerPhone;
  if (patch.address !== undefined) data.address = patch.address;
  if (patch.ngo !== undefined) data.ngo = patch.ngo;
  if (patch.broughtBy !== undefined) data.broughtBy = patch.broughtBy;
  if (patch.complaint !== undefined) data.complaint = patch.complaint;
  if (patch.injuryType !== undefined) data.injuryType = patch.injuryType;
  if (patch.history !== undefined) data.history = patch.history;
  if (patch.diagnosis !== undefined) data.diagnosis = patch.diagnosis;
  if (patch.surgeryRequired !== undefined) data.surgeryRequired = patch.surgeryRequired;
  if (patch.contagious !== undefined) data.contagious = patch.contagious;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.ward !== undefined) data.ward = patch.ward;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.animal.update({ where: { id: animalId }, data });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Animal',
      entityId: animalId,
      before: pickAuditFields(before),
      after: pickAuditFields(updated),
    });
    return updated;
  });
}

type AnimalLike = { name: string; status: AnimalStatus; ward: string | null; complaint: string | null };
function pickAuditFields(a: AnimalLike) {
  return { name: a.name, status: a.status, ward: a.ward, complaint: a.complaint };
}
