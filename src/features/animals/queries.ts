import { prisma } from '@/lib/prisma';
import type { AnimalStatus, Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';

export interface ListAnimalsParams {
  status?: AnimalStatus;
  species?: string;
  search?: string;
  take?: number;
  cursor?: string;
}

export interface AnimalListItem {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  ward: string | null;
  status: AnimalStatus;
  contagious: boolean;
  aggressive: boolean;
  admittedAt: Date;
  lastActivityAt: Date | null;
  thumbnailKey: string | null;
}

export async function listAnimals(params: ListAnimalsParams = {}): Promise<AnimalListItem[]> {
  const { status, species, search, take = 30, cursor } = params;
  const where: Prisma.AnimalWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(species ? { species } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  };

  const rows = await prisma.animal.findMany({
    where,
    orderBy: { admittedAt: 'desc' },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      ward: true,
      status: true,
      contagious: true,
      aggressive: true,
      admittedAt: true,
      media: {
        take: 1,
        orderBy: { order: 'asc' },
        select: { asset: { select: { storageKey: true } } },
      },
      activities: {
        take: 1,
        orderBy: { occurredAt: 'desc' },
        where: { deletedAt: null },
        select: { occurredAt: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    breed: r.breed,
    ward: r.ward,
    status: r.status,
    contagious: r.contagious,
    aggressive: r.aggressive,
    admittedAt: r.admittedAt,
    lastActivityAt: r.activities[0]?.occurredAt ?? null,
    thumbnailKey: r.media[0]?.asset.storageKey ?? null,
  }));
}

export async function getAnimal(id: string) {
  return prisma.animal.findFirst({
    where: { id, deletedAt: null },
    include: {
      testsAdvised: true,
      media: {
        orderBy: { order: 'asc' },
        include: { asset: true },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export interface ActiveAnimalLite {
  id: string;
  name: string;
  species: string;
  ward: string | null;
  status: AnimalStatus;
}

async function _searchActiveAnimalsRaw(query: string, take: number): Promise<ActiveAnimalLite[]> {
  const q = query.trim();
  const where: Prisma.AnimalWhereInput = {
    deletedAt: null,
    dischargedAt: null,
    deceasedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { species: { contains: q, mode: 'insensitive' as const } },
            { ward: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  return prisma.animal.findMany({
    where,
    orderBy: [{ status: 'asc' }, { admittedAt: 'desc' }],
    take,
    select: { id: true, name: true, species: true, ward: true, status: true },
  });
}

// Cached: return shape is plain strings only — no Date / Decimal — so the
// default JSON cache survives the round-trip cleanly. Cache key includes
// `query` + `take` so every distinct search is memoized separately.
const _searchActiveAnimalsCached = unstable_cache(_searchActiveAnimalsRaw, ['search-active-animals'], {
  revalidate: 30,
  tags: ['animals'],
});

export async function searchActiveAnimals(query: string, take = 20): Promise<ActiveAnimalLite[]> {
  return _searchActiveAnimalsCached(query, take);
}

export const getCachedTodayCounts = unstable_cache(
  async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [admissionsToday, dischargesToday, deathsToday, critical] = await Promise.all([
      prisma.animal.count({ where: { admittedAt: { gte: today }, deletedAt: null } }),
      prisma.animal.count({ where: { dischargedAt: { gte: today }, deletedAt: null } }),
      prisma.animal.count({ where: { deceasedAt: { gte: today }, deletedAt: null } }),
      prisma.animal.count({
        where: { status: 'CRITICAL', deletedAt: null, dischargedAt: null, deceasedAt: null },
      }),
    ]);
    return { admissionsToday, dischargesToday, deathsToday, critical };
  },
  ['today-counts'],
  { revalidate: 60, tags: ['today-counts', 'animals'] },
);
