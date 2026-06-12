import {
  dischargeAnimal,
  invalidateLifecycle,
  recordDeath,
  revalidateLifecycle,
} from '@/features/animals/lifecycle/service';
import { createAnimal, updateAnimal } from '@/features/animals/service';
import { DOCTOR_EMAIL, STAFF_EMAIL, actorByEmail, purgeQa, qaName } from '@/lib/__integration__/helpers';
import { RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('animal lifecycle — integration vs real DB', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('STAFF cannot discharge or record death', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const animal = await createAnimal(staff, {
      name: qaName('LifecycleStaff'),
      species: 'Dog',
      complaint: 'QA: test complaint',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    await expect(
      dischargeAnimal(staff, { animalId: animal.id, summary: 'Recovered', documentFileIds: [] }),
    ).rejects.toBeInstanceOf(RbacError);
    await expect(
      recordDeath(staff, {
        animalId: animal.id,
        causeOfDeath: 'cardiac arrest',
        documentFileIds: [],
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });

  it('DOCTOR can discharge — sets status, dischargedAt, DischargeRecord, audit', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await createAnimal(doctor, {
      name: qaName('DischargeTarget'),
      species: 'Dog',
      complaint: 'QA: test complaint',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'STABLE',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    const updated = await dischargeAnimal(doctor, {
      animalId: animal.id,
      summary: 'Recovered fully',
      instructions: 'Re-check in 7 days',
      documentFileIds: [],
    });
    expect(updated.status).toBe('DISCHARGED');
    expect(updated.dischargedAt).not.toBeNull();
    const record = await prisma.dischargeRecord.findUnique({ where: { animalId: animal.id } });
    expect(record?.summary).toBe('Recovered fully');
    expect(record?.dischargedById).toBe(doctor.id);
    // SD-7 verification: no synthetic ADMISSION activity row was created.
    const synthetic = await prisma.activity.count({
      where: { animalId: animal.id, type: 'ADMISSION' },
    });
    expect(synthetic).toBe(0);
    // Audit row with lifecycle context.
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Animal', entityId: animal.id, action: 'update' },
      orderBy: { createdAt: 'desc' },
    });
    expect((audit?.context as { lifecycle?: string } | null)?.lifecycle).toBe('discharge');
  });

  it('DOCTOR can record death — sets status, deceasedAt, DeathRecord, audit', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await createAnimal(doctor, {
      name: qaName('DeathTarget'),
      species: 'Dog',
      complaint: 'QA: test complaint',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'CRITICAL',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    const updated = await recordDeath(doctor, {
      animalId: animal.id,
      causeOfDeath: 'Sepsis',
      bodyHandedOverTo: 'NGO X',
      documentFileIds: [],
    });
    expect(updated.status).toBe('DECEASED');
    expect(updated.deceasedAt).not.toBeNull();
    const record = await prisma.deathRecord.findUnique({ where: { animalId: animal.id } });
    expect(record?.causeOfDeath).toBe('Sepsis');
    expect(record?.bodyHandedOverAt).not.toBeNull();
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Animal', entityId: animal.id, action: 'update' },
      orderBy: { createdAt: 'desc' },
    });
    expect((audit?.context as { lifecycle?: string } | null)?.lifecycle).toBe('death');
  });

  it('Discharge on a soft-deleted animal is rejected (NotFound)', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await createAnimal(doctor, {
      name: qaName('DischargeSoftDel'),
      species: 'Dog',
      complaint: 'QA: test complaint',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    await prisma.animal.update({ where: { id: animal.id }, data: { deletedAt: new Date() } });
    await expect(
      dischargeAnimal(doctor, { animalId: animal.id, summary: 'attempt', documentFileIds: [] }),
    ).rejects.toThrow();
  });

  it('RBAC-2: discharge/death reject documentFileIds the actor does not own', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await createAnimal(doctor, {
      name: qaName('DocOwnership'),
      species: 'Dog',
      complaint: 'QA: test complaint',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    // A fabricated UUID that doesn't exist as a MediaAsset.
    await expect(
      dischargeAnimal(doctor, {
        animalId: animal.id,
        summary: 'Recovered',
        documentFileIds: ['clxxxnotexist00000000001'],
      }),
    ).rejects.toThrow();
  });
});

describe('closed-case lock — animal mutations', () => {
  it('DOCTOR cannot edit a DECEASED animal', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('locked'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
      },
    });
    await expect(updateAnimal(doctor, animal.id, { name: qaName('hacked') })).rejects.toBeInstanceOf(
      RbacError,
    );
  });
});

describe('invalidate / re-validate', () => {
  async function makeSuperAdmin() {
    return prisma.user.create({
      data: {
        email: `${qaName('sa')}@qa-roles.local`,
        name: qaName('SA'),
        role: 'SUPER_ADMIN',
        passwordHash: 'x',
        active: true,
      },
    });
  }
  async function cleanupSuper(id: string) {
    await prisma.auditLog.deleteMany({ where: { actorId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }

  it('SUPER_ADMIN invalidates a death: animal returns to OBSERVATION, record kept + flagged, cage null', async () => {
    const sa = await makeSuperAdmin();
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('inv'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
        deathRecord: { create: { causeOfDeath: qaName('c'), diedAt: new Date(), recordedById: doctor.id } },
      },
    });
    await invalidateLifecycle({ id: sa.id, role: 'SUPER_ADMIN' }, animal.id);
    const after = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(after.status).toBe('OBSERVATION');
    expect(after.deceasedAt).toBeNull();
    expect(after.cageId).toBeNull();
    const rec = await prisma.deathRecord.findUniqueOrThrow({ where: { animalId: animal.id } });
    expect(rec.invalidatedAt).not.toBeNull();
    expect(rec.invalidatedById).toBe(sa.id);
    await cleanupSuper(sa.id);
  });

  it('DOCTOR cannot invalidate', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('inv2'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
        deathRecord: { create: { causeOfDeath: qaName('c'), diedAt: new Date(), recordedById: doctor.id } },
      },
    });
    await expect(invalidateLifecycle(doctor, animal.id)).rejects.toBeInstanceOf(RbacError);
  });

  it('re-validate re-declares deceased, restores original diedAt, releases held cage', async () => {
    const sa = await makeSuperAdmin();
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const diedAt = new Date('2026-05-20T10:00:00.000Z');
    const animal = await prisma.animal.create({
      data: {
        name: qaName('reval'),
        species: 'Dog',
        status: 'OBSERVATION',
        vaccination: 'NONE',
        createdById: doctor.id,
        deathRecord: {
          create: {
            causeOfDeath: qaName('c'),
            diedAt,
            recordedById: doctor.id,
            invalidatedAt: new Date(),
            invalidatedById: sa.id,
          },
        },
      },
    });
    const cage = await prisma.cage.create({ data: { name: qaName('cage') } });
    await prisma.animal.update({ where: { id: animal.id }, data: { cageId: cage.id } });
    await revalidateLifecycle({ id: sa.id, role: 'SUPER_ADMIN' }, animal.id);
    const after = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(after.status).toBe('DECEASED');
    expect(after.deceasedAt?.toISOString()).toBe(diedAt.toISOString());
    expect(after.cageId).toBeNull();
    const rec = await prisma.deathRecord.findUniqueOrThrow({ where: { animalId: animal.id } });
    expect(rec.invalidatedAt).toBeNull();
    await prisma.animal.update({ where: { id: animal.id }, data: { cageId: null } });
    await prisma.cage.delete({ where: { id: cage.id } });
    await cleanupSuper(sa.id);
  });
});
