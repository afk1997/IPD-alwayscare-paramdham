import { listAssignableCages, listCagesWithOccupancy } from '@/features/cages/queries';
import { createCage, deleteCage, renameCage } from '@/features/cages/service';
import {
  ADMIN_EMAIL,
  DOCTOR_EMAIL,
  STAFF_EMAIL,
  actorByEmail,
  purgeQa,
  qaName,
} from '@/lib/__integration__/helpers';
import { RbacError, ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('cages service — integration vs real DB', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('STAFF cannot manage cages', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    await expect(createCage(staff, { name: qaName('CageStaff') })).rejects.toBeInstanceOf(RbacError);
  });

  it('DOCTOR can create a cage; duplicate names (case-insensitive) are rejected', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const name = qaName('CageDup');
    const cage = await createCage(doctor, { name });
    expect(cage.name).toBe(name);
    await expect(createCage(doctor, { name: name.toUpperCase() })).rejects.toBeInstanceOf(ValidationError);
  });

  it('rename rejects a colliding name but allows a fresh one', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const a = await createCage(admin, { name: qaName('CageRenA') });
    const b = await createCage(admin, { name: qaName('CageRenB') });
    await expect(renameCage(admin, { id: b.id, name: a.name })).rejects.toBeInstanceOf(ValidationError);
    const renamed = await renameCage(admin, { id: b.id, name: qaName('CageRenB2') });
    expect(renamed.name).toContain('CageRenB2');
  });

  it('delete is blocked while occupied, allowed when empty', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await createCage(doctor, { name: qaName('CageDel') });
    const animal = await prisma.animal.create({
      data: { name: qaName('CageDelOccupant'), species: 'Dog', createdById: doctor.id, cageId: cage.id },
    });
    await expect(deleteCage(doctor, { id: cage.id })).rejects.toBeInstanceOf(ValidationError);
    // Free it, then delete succeeds.
    await prisma.animal.update({ where: { id: animal.id }, data: { cageId: null } });
    await deleteCage(doctor, { id: cage.id });
    expect(await prisma.cage.findUnique({ where: { id: cage.id } })).toBeNull();
  });

  it('listAssignableCages excludes occupied cages but keeps the patient’s own', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const cage = await createCage(doctor, { name: qaName('CageAssign') });
    const animal = await prisma.animal.create({
      data: { name: qaName('CageAssignOccupant'), species: 'Dog', createdById: doctor.id, cageId: cage.id },
    });
    const free = await listAssignableCages();
    expect(free.find((c) => c.id === cage.id)).toBeUndefined();
    const forAnimal = await listAssignableCages(animal.id);
    expect(forAnimal.find((c) => c.id === cage.id)).toBeDefined();
    const withOcc = await listCagesWithOccupancy();
    expect(withOcc.find((c) => c.id === cage.id)?.occupant?.id).toBe(animal.id);
  });
});
