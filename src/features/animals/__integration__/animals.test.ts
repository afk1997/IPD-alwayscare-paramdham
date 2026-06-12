import { listAnimalCardsByIds } from '@/features/animals/queries';
import { createAnimal, restoreAnimal, softDeleteAnimal, updateAnimal } from '@/features/animals/service';
import {
  ADMIN_EMAIL,
  DOCTOR_EMAIL,
  STAFF_EMAIL,
  actorByEmail,
  purgeQa,
  qaName,
} from '@/lib/__integration__/helpers';
import { RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('animals service — integration vs real DB', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('STAFF can admit an animal', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const name = qaName('Bruno');
    const created = await createAnimal(staff, {
      name,
      species: 'Dog',
      complaint: 'QA: test complaint',
      breed: 'Indie',
      gender: 'MALE',
      ageText: '~2 yrs',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    expect(created.id).toBeTruthy();
    expect(created.createdById).toBe(staff.id);
    const row = await prisma.animal.findUnique({ where: { id: created.id } });
    expect(row?.name).toBe(name);
    // Audit row was written
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Animal', entityId: created.id, action: 'create' },
    });
    expect(audit?.actorId).toBe(staff.id);
  });

  it('STAFF cannot edit an animal (animal.update is DOCTOR+)', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const created = await createAnimal(staff, {
      name: qaName('StaffEditTarget'),
      species: 'Cat',
      complaint: 'QA: test complaint',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    await expect(updateAnimal(staff, created.id, { injuryType: 'Trauma' })).rejects.toBeInstanceOf(RbacError);
    // DOCTOR is allowed
    const updated = await updateAnimal(doctor, created.id, {
      injuryType: 'Trauma',
      diagnosis: 'Probable URI',
    });
    expect(updated.injuryType).toBe('Trauma');
    expect(updated.diagnosis).toBe('Probable URI');
  });

  it('updateAnimal writes a per-field audit diff (SD-10)', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const created = await createAnimal(doctor, {
      name: qaName('DiffTest'),
      species: 'Dog',
      complaint: 'QA: test complaint',
      weightKg: 12.5,
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'STABLE',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    await updateAnimal(doctor, created.id, {
      weightKg: 13.0,
      diagnosis: 'Fracture, left forelimb',
      contagious: true,
    });
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Animal', entityId: created.id, action: 'update' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    const before = audit?.before as Record<string, unknown>;
    const after = audit?.after as Record<string, unknown>;
    expect(after.diagnosis).toBe('Fracture, left forelimb');
    expect(after.contagious).toBe(true);
    expect(String(after.weightKg)).toBe('13');
    expect(before.diagnosis ?? null).toBe(null);
    expect(before.contagious).toBe(false);
    expect(String(before.weightKg)).toBe('12.5');
  });

  it('STAFF cannot soft-delete an animal (animal.delete is ADMIN)', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const admin = await actorByEmail(ADMIN_EMAIL);
    const created = await createAnimal(admin, {
      name: qaName('DeleteTarget'),
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
    await expect(softDeleteAnimal(staff, created.id)).rejects.toBeInstanceOf(RbacError);
    await expect(softDeleteAnimal(await actorByEmail(DOCTOR_EMAIL), created.id)).rejects.toBeInstanceOf(
      RbacError,
    );
  });

  it('ADMIN can soft-delete then restore an animal; queries respect deletedAt', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const created = await createAnimal(admin, {
      name: qaName('RoundTrip'),
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
    const deleted = await softDeleteAnimal(admin, created.id);
    expect(deleted.deletedAt).not.toBeNull();
    // Hidden from search
    // Direct DB check so we don't hit the Next unstable_cache wrapper
    // (which needs Next's runtime context to evaluate). The point is to
    // verify Animal.deletedAt is honoured — the same WHERE clause
    // searchActiveAnimals uses.
    const hidden = await prisma.animal.findFirst({
      where: { id: created.id, deletedAt: null },
    });
    expect(hidden).toBeNull();

    const restored = await restoreAnimal(admin, created.id);
    expect(restored.deletedAt).toBeNull();
    const visibleAgain = await prisma.animal.findFirst({
      where: { id: created.id, deletedAt: null },
    });
    expect(visibleAgain).not.toBeNull();

    // Audit trail: one delete + one restore row.
    const audits = await prisma.auditLog.findMany({
      where: { entityType: 'Animal', entityId: created.id, action: { in: ['delete', 'restore'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits.map((a) => a.action)).toEqual(['delete', 'restore']);
  });

  it('softDeleteAnimal is idempotent — second call is a no-op', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const created = await createAnimal(admin, {
      name: qaName('Idem'),
      species: 'Cat',
      complaint: 'QA: test complaint',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    const first = await softDeleteAnimal(admin, created.id);
    const second = await softDeleteAnimal(admin, created.id);
    expect(first.deletedAt?.toISOString()).toBe(second.deletedAt?.toISOString());
    const deletes = await prisma.auditLog.count({
      where: { entityType: 'Animal', entityId: created.id, action: 'delete' },
    });
    expect(deletes).toBe(1);
  });

  it('CreateAnimalSchema rejects overlength name (>100 chars)', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    await expect(
      createAnimal(admin, {
        name: `${QA_PREFIX}${'X'.repeat(150)}`,
        species: 'Dog',
        complaint: 'QA: test complaint',
        vaccination: 'NONE',
        sterilized: false,
        aggressive: false,
        status: 'OBSERVATION',
        contagious: false,
        testsAdvised: [],
        mediaAssetIds: [],
      }),
    ).rejects.toThrow();
  });
});

const QA_PREFIX = '__qa__';

describe('listAnimalCardsByIds', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('returns AnimalListItem cards for the given ids, including deceased, in input order', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const a1 = await prisma.animal.create({
      data: {
        name: qaName('card1'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: admin.id,
      },
    });
    const a2 = await prisma.animal.create({
      data: {
        name: qaName('card2'),
        species: 'Cat',
        status: 'OBSERVATION',
        vaccination: 'NONE',
        createdById: admin.id,
      },
    });
    const cards = await listAnimalCardsByIds([a2.id, a1.id]);
    expect(cards.map((c) => c.id)).toEqual([a2.id, a1.id]);
    expect(cards[0]).toMatchObject({ species: 'Cat', status: 'OBSERVATION' });
    expect(cards[1]?.status).toBe('DECEASED');
  });

  it('returns [] for no ids and skips soft-deleted', async () => {
    expect(await listAnimalCardsByIds([])).toEqual([]);
    const admin = await actorByEmail(ADMIN_EMAIL);
    const del = await prisma.animal.create({
      data: {
        name: qaName('del'),
        species: 'Dog',
        status: 'OBSERVATION',
        vaccination: 'NONE',
        createdById: admin.id,
        deletedAt: new Date(),
      },
    });
    expect(await listAnimalCardsByIds([del.id])).toEqual([]);
  });
});
