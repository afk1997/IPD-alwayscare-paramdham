import { ADMIN_EMAIL, actorByEmail, purgeQa, qaName } from '@/lib/__integration__/helpers';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listDeaths, listTodayDeaths } from '../queries';

describe('outcomes queries', () => {
  let animalId: string;
  beforeAll(async () => {
    await purgeQa();
    const admin = await actorByEmail(ADMIN_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('dead'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: admin.id,
        deathRecord: {
          create: { causeOfDeath: qaName('cause'), diedAt: new Date(), recordedById: admin.id },
        },
      },
    });
    animalId = animal.id;
  });
  afterAll(purgeQa);

  it('listDeaths returns the deceased animal with its cause + recorder', async () => {
    const rows = await listDeaths();
    const row = rows.find((r) => r.animalId === animalId);
    expect(row).toBeTruthy();
    expect(row?.animalName).toContain('__qa__');
    expect(row?.causeOfDeath).toContain('__qa__');
    expect(row?.recordedByName).toBeTruthy();
  });

  it('listTodayDeaths includes a death recorded today', async () => {
    const rows = await listTodayDeaths();
    expect(rows.some((r) => r.id === animalId)).toBe(true);
  });

  it('excludes a soft-deleted animal', async () => {
    await prisma.animal.update({ where: { id: animalId }, data: { deletedAt: new Date() } });
    const rows = await listDeaths();
    expect(rows.some((r) => r.animalId === animalId)).toBe(false);
    await prisma.animal.update({ where: { id: animalId }, data: { deletedAt: null } });
  });

  it('listDeaths excludes an invalidated death', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const a = await prisma.animal.create({
      data: {
        name: qaName('invdead'),
        species: 'Dog',
        status: 'OBSERVATION',
        vaccination: 'NONE',
        createdById: admin.id,
        deathRecord: {
          create: {
            causeOfDeath: qaName('c'),
            diedAt: new Date(),
            recordedById: admin.id,
            invalidatedAt: new Date(),
            invalidatedById: admin.id,
          },
        },
      },
    });
    const rows = await listDeaths();
    expect(rows.some((r) => r.animalId === a.id)).toBe(false);
  });
});
