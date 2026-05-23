import { createActivity, softDeleteActivity } from '@/features/activities/service';
import { createAnimal, restoreAnimal, softDeleteAnimal } from '@/features/animals/service';
import {
  listTrashActivities,
  listTrashAnimals,
  listTrashDocuments,
  trashCounts,
} from '@/features/trash/queries';
import {
  ADMIN_EMAIL,
  DOCTOR_EMAIL,
  STAFF_EMAIL,
  actorByEmail,
  purgeQa,
  qaName,
  qaRemarks,
} from '@/lib/__integration__/helpers';
import { RbacError } from '@/lib/errors';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('trash queries — integration vs real DB', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('STAFF and DOCTOR cannot list trash (trash.read is ADMIN)', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    await expect(listTrashActivities(staff)).rejects.toBeInstanceOf(RbacError);
    await expect(listTrashDocuments(doctor)).rejects.toBeInstanceOf(RbacError);
    await expect(listTrashAnimals(staff)).rejects.toBeInstanceOf(RbacError);
    await expect(trashCounts(doctor)).rejects.toBeInstanceOf(RbacError);
  });

  it('ADMIN sees deleted animals + activities in the right tabs', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    // Spawn an animal and an activity, delete both
    const animal = await createAnimal(admin, {
      name: qaName('TrashAnimal'),
      species: 'Dog',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    const activity = await createActivity(admin, {
      animalId: animal.id,
      type: 'FOOD',
      byName: admin.name,
      remarks: qaRemarks('trash test'),
      mediaAssetIds: [],
      data: { foodType: 'kibble', qty: '50g', water: '50ml', intake: 'Fully', vomiting: false },
    });
    await softDeleteActivity(admin, activity.id);
    await softDeleteAnimal(admin, animal.id);

    const counts = await trashCounts(admin);
    expect(counts.activities).toBeGreaterThanOrEqual(1);
    expect(counts.animals).toBeGreaterThanOrEqual(1);

    const trashActs = await listTrashActivities(admin, { take: 100 });
    expect(trashActs.find((a) => a.id === activity.id)).toBeDefined();
    const trashAnimals = await listTrashAnimals(admin, { take: 100 });
    expect(trashAnimals.find((a) => a.id === animal.id)).toBeDefined();

    // Restore the animal — it should leave the trash list.
    await restoreAnimal(admin, animal.id);
    const trashAnimals2 = await listTrashAnimals(admin, { take: 100 });
    expect(trashAnimals2.find((a) => a.id === animal.id)).toBeUndefined();
  });

  it('Trash rows include the deletedBy name (joined via audit log)', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const animal = await createAnimal(admin, {
      name: qaName('TrashWho'),
      species: 'Dog',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    await softDeleteAnimal(admin, animal.id);
    const rows = await listTrashAnimals(admin, { take: 100 });
    const row = rows.find((r) => r.id === animal.id);
    expect(row).toBeDefined();
    expect(row?.deletedByName).toBe(admin.name);
  });

  it('soft-deleted activities for soft-deleted animals still show in trash (queries on deletedAt: not null)', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const animal = await createAnimal(admin, {
      name: qaName('TrashChild'),
      species: 'Dog',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    const activity = await createActivity(admin, {
      animalId: animal.id,
      type: 'FOOD',
      byName: admin.name,
      remarks: qaRemarks('orphan-candidate'),
      mediaAssetIds: [],
      data: { foodType: 'kibble', qty: '50g', water: '50ml', intake: 'Fully', vomiting: false },
    });
    await softDeleteActivity(admin, activity.id);
    await softDeleteAnimal(admin, animal.id);

    const trashActs = await listTrashActivities(admin, { take: 200 });
    expect(trashActs.find((a) => a.id === activity.id)).toBeDefined();
  });
});
