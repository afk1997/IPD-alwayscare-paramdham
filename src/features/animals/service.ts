import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { folderResolver } from '@/lib/folders';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan } from '@/lib/rbac';
import type { AnimalStatus, Gender, Prisma, TestKind, Vaccination } from '@prisma/client';
import {
  type CreateAnimalInput,
  CreateAnimalSchema,
  type UpdateAnimalInput,
  UpdateAnimalSchema,
} from './schema';

function nz(v: string | undefined | null): string | null {
  if (v === '' || v === undefined || v === null) return null;
  return v;
}

// Animal.cageId is the only unique column on Animal, so a P2002 here always
// means the chosen cage is taken; P2025 means the connected cage is gone.
// Rethrow as ValidationError so callers surface a friendly message.
function translateCageError(e: unknown): never {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code?: string }).code;
    if (code === 'P2002') throw new ValidationError('That cage is already occupied');
    // P2003 = FK violation (scalar cageId → missing cage); P2025 = relational
    // record-not-found. The only user-supplied FK on these writes is cageId.
    if (code === 'P2003' || code === 'P2025') throw new ValidationError('Selected cage no longer exists');
  }
  throw e;
}

export async function createAnimal(actor: Actor, input: CreateAnimalInput) {
  assertCan(actor, 'animal.create');
  const parsed = CreateAnimalSchema.parse(input);
  // Refuse to adopt assets uploaded by another user — see media service.
  const { assertOwnedReadyAssets } = await import('../media/service');
  await assertOwnedReadyAssets(actor, parsed.mediaAssetIds);

  const data: Prisma.AnimalUncheckedCreateInput = {
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
    immediateTreatment: nz(parsed.immediateTreatment),
    surgeryRequired: nz(parsed.surgeryRequired),
    contagious: parsed.contagious,
    status: parsed.status as AnimalStatus,
    ward: nz(parsed.ward),
    // Set the FK scalar directly (not `cage: { connect }`): a relational
    // connect on this 1-to-1 would STEAL an occupied cage by nulling its
    // current occupant. The scalar write instead trips the unique index
    // (P2002) when the cage is already taken — race-proof single occupancy.
    cageId: nz(parsed.cageId),
    createdById: actor.id,
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

  const created = await prisma
    .$transaction(async (tx) => {
      const animal = await tx.animal.create({
        data,
        include: { testsAdvised: true, media: { include: { asset: true } } },
      });

      await writeAuditLog(tx, {
        actorId: actor.id,
        action: 'create',
        entityType: 'Animal',
        entityId: animal.id,
        after: {
          id: animal.id,
          name: animal.name,
          species: animal.species,
          status: animal.status,
        },
      });

      return animal;
    })
    .catch((e) => translateCageError(e));

  // After the DB transaction commits, move any staged Drive files into the
  // animal's admission folder. A Drive failure shouldn't roll back the
  // animal record (files can be re-linked manually), but we DO write an
  // audit row so an admin can reconcile.
  const stagedAssets = created.media.map((m) => m.asset).filter((a) => a.storageKey.startsWith('gdrive:'));
  if (parsed.uploadSessionId && stagedAssets.length > 0) {
    try {
      const folders = folderResolver();
      const fromParent = await folders.stagingFolder(parsed.uploadSessionId);
      const toParent = await folders.admissionFolder({ id: created.id, name: created.name });
      await folders.movePending(
        fromParent,
        toParent,
        stagedAssets.map((a) => a.storageKey),
      );
    } catch (e) {
      await writeAuditLog(prisma, {
        actorId: actor.id,
        action: 'update',
        entityType: 'Animal',
        entityId: created.id,
        context: {
          driveOp: 'movePending(staging→admission)',
          uploadSessionId: parsed.uploadSessionId,
          assetIds: stagedAssets.map((a) => a.id),
          error: e instanceof Error ? e.message : String(e),
        },
      });
    }
  }

  return created;
}

export type UpdateAnimalPatch = UpdateAnimalInput;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: applies many optional patch fields one by one
export async function updateAnimal(actor: Actor, animalId: string, patch: UpdateAnimalPatch) {
  assertCan(actor, 'animal.update');
  // Validate the patch — without this, `animal.update` callers could write
  // a multi-MB name or an invalid enum straight to the DB (H1-s).
  const parsed = UpdateAnimalSchema.parse(patch);
  const before = await prisma.animal.findUnique({ where: { id: animalId } });
  if (!before) throw new NotFoundError('Animal', animalId);

  const data: Prisma.AnimalUncheckedUpdateInput = {
    editedAt: new Date(),
    editedById: actor.id,
  };
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.breed !== undefined) data.breed = parsed.breed;
  if (parsed.ageText !== undefined) data.ageText = parsed.ageText;
  if (parsed.color !== undefined) data.color = parsed.color;
  if (parsed.weightKg !== undefined) data.weightKg = parsed.weightKg;
  if (parsed.vaccination !== undefined) data.vaccination = parsed.vaccination;
  if (parsed.sterilized !== undefined) data.sterilized = parsed.sterilized;
  if (parsed.aggressive !== undefined) data.aggressive = parsed.aggressive;
  if (parsed.rescuer !== undefined) data.rescuer = parsed.rescuer;
  if (parsed.rescuerPhone !== undefined) data.rescuerPhone = parsed.rescuerPhone;
  if (parsed.address !== undefined) data.address = parsed.address;
  if (parsed.ngo !== undefined) data.ngo = parsed.ngo;
  if (parsed.broughtBy !== undefined) data.broughtBy = parsed.broughtBy;
  if (parsed.complaint !== undefined) data.complaint = parsed.complaint;
  if (parsed.injuryType !== undefined) data.injuryType = parsed.injuryType;
  if (parsed.history !== undefined) data.history = parsed.history;
  if (parsed.diagnosis !== undefined) data.diagnosis = parsed.diagnosis;
  if (parsed.immediateTreatment !== undefined) data.immediateTreatment = parsed.immediateTreatment;
  if (parsed.surgeryRequired !== undefined) data.surgeryRequired = parsed.surgeryRequired;
  if (parsed.contagious !== undefined) data.contagious = parsed.contagious;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.ward !== undefined) data.ward = parsed.ward;
  // Scalar FK write (not `cage: { connect }`) so reassigning to an occupied
  // cage trips the unique index (P2002) instead of silently stealing it.
  if (parsed.cageId !== undefined) data.cageId = parsed.cageId;

  return prisma
    .$transaction(async (tx) => {
      const updated = await tx.animal.update({
        where: { id: animalId },
        data,
        include: { testsAdvised: true, cage: { select: { id: true, name: true } } },
      });
      // SD-10: per-field diff. The prior implementation only recorded
      // {name, status, ward, complaint} — silently dropping clinical edits
      // like diagnosis, contagious, weightKg, vaccination, etc.
      const diff = diffAnimalFields(before, updated);
      if (diff.changedKeys.length > 0) {
        await writeAuditLog(tx, {
          actorId: actor.id,
          action: 'update',
          entityType: 'Animal',
          entityId: animalId,
          before: diff.before,
          after: diff.after,
          context: { changedFields: diff.changedKeys },
        });
      }
      return updated;
    })
    .catch((e) => translateCageError(e));
}

const AUDITED_ANIMAL_FIELDS = [
  'name',
  'species',
  'breed',
  'gender',
  'ageText',
  'color',
  'weightKg',
  'vaccination',
  'sterilized',
  'aggressive',
  'rescuer',
  'rescuerPhone',
  'address',
  'ngo',
  'broughtBy',
  'complaint',
  'injuryType',
  'history',
  'diagnosis',
  'immediateTreatment',
  'surgeryRequired',
  'contagious',
  'status',
  'ward',
  'cageId',
] as const;

type AuditedKey = (typeof AUDITED_ANIMAL_FIELDS)[number];

function jsonValue(v: unknown): unknown {
  // Prisma Decimal serialises through toString; everything else passes
  // through. Dates aren't on this list so we don't need a Date branch.
  if (v && typeof v === 'object' && 'toFixed' in v) return (v as { toString(): string }).toString();
  return v ?? null;
}

function diffAnimalFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { changedKeys: AuditedKey[]; before: Record<string, unknown>; after: Record<string, unknown> } {
  const beforeOut: Record<string, unknown> = {};
  const afterOut: Record<string, unknown> = {};
  const changedKeys: AuditedKey[] = [];
  for (const k of AUDITED_ANIMAL_FIELDS) {
    const b = jsonValue(before[k]);
    const a = jsonValue(after[k]);
    if (b !== a) {
      changedKeys.push(k);
      beforeOut[k] = b;
      afterOut[k] = a;
    }
  }
  return { changedKeys, before: beforeOut, after: afterOut };
}

export async function softDeleteAnimal(actor: Actor, animalId: string) {
  assertCan(actor, 'animal.delete');
  const before = await prisma.animal.findUnique({ where: { id: animalId } });
  if (!before) throw new NotFoundError('Animal', animalId);
  if (before.deletedAt) return before;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.animal.update({
      where: { id: animalId },
      data: { deletedAt: new Date(), cageId: null, editedAt: new Date(), editedById: actor.id },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'delete',
      entityType: 'Animal',
      entityId: animalId,
      before: {
        name: before.name,
        species: before.species,
        status: before.status,
        ward: before.ward,
        admittedAt: before.admittedAt.toISOString(),
      },
    });
    return updated;
  });
}

export async function restoreAnimal(actor: Actor, animalId: string) {
  assertCan(actor, 'animal.restore');
  const before = await prisma.animal.findUnique({ where: { id: animalId } });
  if (!before) throw new NotFoundError('Animal', animalId);
  if (!before.deletedAt) return before;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.animal.update({
      where: { id: animalId },
      data: { deletedAt: null, editedAt: new Date(), editedById: actor.id },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'restore',
      entityType: 'Animal',
      entityId: animalId,
      after: { name: updated.name, species: updated.species, status: updated.status },
      // SD-9: when restoring a DECEASED or DISCHARGED animal, the
      // DeathRecord / DischargeRecord remain attached. Record the
      // discrepancy so an admin can decide whether to re-admit (which
      // requires explicitly clearing the lifecycle state via Edit).
      ...(updated.status === 'DECEASED' || updated.status === 'DISCHARGED'
        ? { context: { staleLifecycle: updated.status } }
        : {}),
    });
    return updated;
  });
}
