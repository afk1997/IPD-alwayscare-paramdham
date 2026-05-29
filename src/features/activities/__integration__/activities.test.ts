import {
  createActivity,
  duplicateActivity,
  restoreActivity,
  softDeleteActivity,
  updateActivity,
} from '@/features/activities/service';
import type { CreateAnimalInput } from '@/features/animals/schema';
import { createAnimal } from '@/features/animals/service';
import {
  DOCTOR_EMAIL,
  STAFF_EMAIL,
  actorByEmail,
  purgeQa,
  qaName,
  qaRemarks,
} from '@/lib/__integration__/helpers';
import { RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const baseAnimal: Omit<CreateAnimalInput, 'name'> = {
  species: 'Dog',
  vaccination: 'NONE',
  sterilized: false,
  aggressive: false,
  status: 'OBSERVATION',
  contagious: false,
  testsAdvised: [],
  mediaAssetIds: [],
};

async function spawnAnimal(actor: {
  id: string;
  role: 'STAFF' | 'DOCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'VIEWER';
  name: string;
}) {
  return createAnimal(actor, { ...baseAnimal, name: qaName('AnimalForActivity') });
}

describe('activities service — integration vs real DB', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('STAFF can log routine activity (FOOD)', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const animal = await spawnAnimal(staff);
    const created = await createActivity(staff, {
      animalId: animal.id,
      type: 'FOOD',
      byName: staff.name,
      remarks: qaRemarks('food entry'),
      mediaAssetIds: [],
      data: { foodType: 'kibble', qty: '80g', water: '100ml', intake: 'Fully', vomiting: false },
    });
    expect(created.id).toBeTruthy();
    expect(created.type).toBe('FOOD');
    expect(created.byUserId).toBe(staff.id);
  });

  it('STAFF cannot log clinical activity (SURGERY) — activity.create.clinical', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const animal = await spawnAnimal(staff);
    await expect(
      createActivity(staff, {
        animalId: animal.id,
        type: 'SURGERY',
        byName: staff.name,
        remarks: qaRemarks('blocked surgery'),
        mediaAssetIds: [],
        data: { surgeryName: 'spay', surgeon: 'X', findings: 'n/a', complications: 'none' },
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });

  it('DOCTOR can log clinical activity (ROUND)', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await spawnAnimal(doctor);
    const created = await createActivity(doctor, {
      animalId: animal.id,
      type: 'ROUND',
      byName: doctor.name,
      remarks: qaRemarks('doctor round'),
      mediaAssetIds: [],
      data: {
        temp: '38.5',
        pain: '2',
        appetite: 'Normal',
        hydration: 'Good',
        wound: 'healing',
        stool: 'normal',
        progress: 'Improving',
        notes: 'continue tramadol',
      },
    });
    expect(created.type).toBe('ROUND');
  });

  it('STAFF impersonation of byName is silently overridden (RBAC-9)', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const animal = await spawnAnimal(staff);
    const created = await createActivity(staff, {
      animalId: animal.id,
      type: 'FOOD',
      byName: 'Dr. Mehta',
      remarks: qaRemarks('impersonation attempt'),
      mediaAssetIds: [],
      data: { foodType: 'rice', qty: '50g', water: '100ml', intake: 'Partially', vomiting: false },
    });
    expect(created.byName).toBe(staff.name);
    expect(created.byName).not.toBe('Dr. Mehta');
  });

  it('DOCTOR can re-attribute byName (activity.update.any)', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await spawnAnimal(doctor);
    const created = await createActivity(doctor, {
      animalId: animal.id,
      type: 'FOOD',
      byName: 'Pooja (nurse)',
      remarks: qaRemarks('attributed entry'),
      mediaAssetIds: [],
      data: { foodType: 'kibble', qty: '40g', water: '50ml', intake: 'Fully', vomiting: false },
    });
    expect(created.byName).toBe('Pooja (nurse)');
  });

  it('STAFF can edit own activity within 24h', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const animal = await spawnAnimal(staff);
    const created = await createActivity(staff, {
      animalId: animal.id,
      type: 'FOOD',
      byName: staff.name,
      remarks: qaRemarks('original'),
      mediaAssetIds: [],
      data: { foodType: 'kibble', qty: '80g', water: '100ml', intake: 'Fully', vomiting: false },
    });
    const updated = await updateActivity(staff, created.id, {
      remarks: `${qaRemarks('edited')}`,
      data: { foodType: 'kibble', qty: '90g', water: '120ml', intake: 'Fully', vomiting: false },
    });
    expect(updated.editedById).toBe(staff.id);
    expect(updated.editedAt).not.toBeNull();
  });

  it("STAFF cannot edit another user's activity", async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const staff = await actorByEmail(STAFF_EMAIL);
    const animal = await spawnAnimal(doctor);
    const created = await createActivity(doctor, {
      animalId: animal.id,
      type: 'ROUND',
      byName: doctor.name,
      remarks: qaRemarks("doctor's round"),
      mediaAssetIds: [],
      data: {
        temp: '38.5',
        pain: '0',
        appetite: 'Normal',
        hydration: 'Good',
        wound: 'n/a',
        stool: 'fine',
        progress: 'Stable',
        notes: 'observe',
      },
    });
    await expect(updateActivity(staff, created.id, { remarks: 'hijack' })).rejects.toBeInstanceOf(RbacError);
  });

  it('updateActivity rejects payload that does not match the row type (defence in depth)', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await spawnAnimal(doctor);
    const created = await createActivity(doctor, {
      animalId: animal.id,
      type: 'FOOD',
      byName: doctor.name,
      remarks: qaRemarks('food'),
      mediaAssetIds: [],
      data: { foodType: 'kibble', qty: '80g', water: '100ml', intake: 'Fully', vomiting: false },
    });
    // Try to switch the FOOD entry to a SURGERY-shaped payload.
    await expect(
      updateActivity(doctor, created.id, {
        data: { surgeryName: 'spay', surgeon: 'X', findings: 'n/a', complications: 'none' },
      }),
    ).rejects.toThrow();
  });

  it('STAFF can delete own activity within 24h; cannot delete after 24h (RBAC-7)', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const animal = await spawnAnimal(staff);
    const created = await createActivity(staff, {
      animalId: animal.id,
      type: 'WALK',
      byName: staff.name,
      remarks: qaRemarks('walk'),
      mediaAssetIds: [],
      data: { duration: '15min', urination: true, stool: false, assisted: false, mobility: 'Normal' },
    });
    // Force createdAt back 25h to test the window.
    await prisma.activity.update({
      where: { id: created.id },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    await expect(softDeleteActivity(staff, created.id)).rejects.toBeInstanceOf(RbacError);
    // ADMIN/DOCTOR can still delete past the window.
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const deleted = await softDeleteActivity(doctor, created.id);
    expect(deleted.deletedAt).not.toBeNull();
  });

  it('DOCTOR can restore a soft-deleted activity (in-toast Undo path)', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await spawnAnimal(doctor);
    const created = await createActivity(doctor, {
      animalId: animal.id,
      type: 'TREATMENT',
      byName: doctor.name,
      remarks: qaRemarks('treatment'),
      mediaAssetIds: [],
      data: { meds: [{ name: 'Tramadol', dose: '50mg', route: 'IV' }] },
    });
    await softDeleteActivity(doctor, created.id);
    const restored = await restoreActivity(doctor, created.id);
    expect(restored.deletedAt).toBeNull();
    const audits = await prisma.auditLog.findMany({
      where: { entityType: 'Activity', entityId: created.id, action: { in: ['delete', 'restore'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits.map((a) => a.action)).toEqual(['delete', 'restore']);
  });

  it('softDeleteActivity is race-safe — concurrent calls produce one delete row', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await spawnAnimal(doctor);
    const created = await createActivity(doctor, {
      animalId: animal.id,
      type: 'FOOD',
      byName: doctor.name,
      remarks: qaRemarks('race target'),
      mediaAssetIds: [],
      data: { foodType: 'kibble', qty: '50g', water: '50ml', intake: 'Fully', vomiting: false },
    });
    await Promise.allSettled([
      softDeleteActivity(doctor, created.id),
      softDeleteActivity(doctor, created.id),
      softDeleteActivity(doctor, created.id),
    ]);
    const audits = await prisma.auditLog.count({
      where: { entityType: 'Activity', entityId: created.id, action: 'delete' },
    });
    expect(audits).toBe(1);
  });

  it('duplicateActivity creates a new row pointing back via duplicatedFromId', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await spawnAnimal(doctor);
    const created = await createActivity(doctor, {
      animalId: animal.id,
      type: 'TREATMENT',
      byName: doctor.name,
      remarks: qaRemarks('original treatment'),
      mediaAssetIds: [],
      data: { meds: [{ name: 'Cefixime', dose: '100mg', route: 'Oral' }] },
    });
    const dup = await duplicateActivity(doctor, created.id);
    expect(dup.id).not.toBe(created.id);
    expect(dup.duplicatedFromId).toBe(created.id);
    expect(dup.type).toBe('TREATMENT');
  });
});

describe('closed-case lock — activity mutations', () => {
  it('DOCTOR cannot add an activity to a DISCHARGED animal', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL); // { id, role, name }
    const animal = await prisma.animal.create({
      data: {
        name: qaName('closed-act'),
        species: 'Cat',
        status: 'DISCHARGED',
        dischargedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
      },
    });
    await expect(
      createActivity(doctor, {
        animalId: animal.id,
        type: 'FOOD',
        byName: doctor.name,
        data: { foodType: 'kibble', intake: 'Fully', vomiting: false },
        mediaAssetIds: [],
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });
});
