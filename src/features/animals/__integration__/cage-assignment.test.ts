import type { CreateAnimalInput } from '@/features/animals/schema';
import { createAnimal, updateAnimal } from '@/features/animals/service';
import { DOCTOR_EMAIL, actorByEmail, purgeQa, qaName } from '@/lib/__integration__/helpers';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const base: Omit<CreateAnimalInput, 'name'> = {
  species: 'Dog',
  vaccination: 'NONE',
  sterilized: false,
  aggressive: false,
  status: 'OBSERVATION',
  contagious: false,
  testsAdvised: [],
  mediaAssetIds: [],
};

describe('cage assignment via animal service — integration', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('assigns a cage at admission and frees it via update(null)', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await prisma.cage.create({ data: { name: qaName('CageAdmit') } });
    const animal = await createAnimal(doctor, { ...base, name: qaName('CageAdmitPatient'), cageId: cage.id });
    expect(animal.cageId).toBe(cage.id);
    await updateAnimal(doctor, animal.id, { cageId: null });
    const after = await prisma.animal.findUnique({ where: { id: animal.id } });
    expect(after?.cageId).toBeNull();
  });

  it('refuses to assign a cage already held by another patient', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await prisma.cage.create({ data: { name: qaName('CageTaken') } });
    await createAnimal(doctor, { ...base, name: qaName('CageTakenFirst'), cageId: cage.id });
    // Second admission into the same cage → friendly ValidationError.
    await expect(
      createAnimal(doctor, { ...base, name: qaName('CageTakenSecond'), cageId: cage.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Same via update of a second patient.
    const other = await createAnimal(doctor, { ...base, name: qaName('CageTakenOther') });
    await expect(updateAnimal(doctor, other.id, { cageId: cage.id })).rejects.toBeInstanceOf(ValidationError);
  });

  it('records cageId in the audit diff on update', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await prisma.cage.create({ data: { name: qaName('CageAudit') } });
    const animal = await createAnimal(doctor, { ...base, name: qaName('CageAuditPatient') });
    await updateAnimal(doctor, animal.id, { cageId: cage.id });
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Animal', entityId: animal.id, action: 'update' },
      orderBy: { createdAt: 'desc' },
    });
    expect((audit?.context as { changedFields?: string[] } | null)?.changedFields).toContain('cageId');
  });
});
