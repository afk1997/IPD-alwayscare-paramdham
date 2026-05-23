import { dischargeAnimal, recordDeath } from '@/features/animals/lifecycle/service';
import { createAnimal } from '@/features/animals/service';
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
