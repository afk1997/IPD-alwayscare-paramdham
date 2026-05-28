import { signMediaUrl } from '@/lib/media-sign';
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
  cage: string | null;
  status: AnimalStatus;
  contagious: boolean;
  aggressive: boolean;
  admittedAt: Date;
  lastActivityAt: Date | null;
  // Pre-signed URL for the first photo, ready to use directly in <img src>.
  // The URL is HMAC-signed with AUTH_SECRET so it can be served from the
  // edge cache without a cookie check.
  thumbnailUrl: string | null;
}

export async function listAnimals(params: ListAnimalsParams = {}): Promise<AnimalListItem[]> {
  const { status, species, search, take = 30, cursor } = params;
  const where: Prisma.AnimalWhereInput = {
    deletedAt: null,
    // Patient list shows currently-admitted animals only.  Discharged or
    // deceased animals stay discoverable via per-animal reports.
    dischargedAt: null,
    deceasedAt: null,
    ...(status ? { status } : {}),
    ...(species ? { species } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { breed: { contains: search, mode: 'insensitive' as const } },
            { ward: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
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
      cage: { select: { name: true } },
      status: true,
      contagious: true,
      aggressive: true,
      admittedAt: true,
      media: {
        take: 1,
        orderBy: { order: 'asc' },
        // Only READY thumbnails — PENDING / FAILED would 425 / 410
        // through /api/files/[id].
        where: { asset: { status: 'READY' } },
        select: { asset: { select: { id: true } } },
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
    cage: r.cage?.name ?? null,
    status: r.status,
    contagious: r.contagious,
    aggressive: r.aggressive,
    admittedAt: r.admittedAt,
    lastActivityAt: r.activities[0]?.occurredAt ?? null,
    thumbnailUrl: r.media[0]?.asset.id ? signMediaUrl(r.media[0].asset.id) : null,
  }));
}

export async function getAnimal(id: string) {
  const animal = await prisma.animal.findFirst({
    where: { id, deletedAt: null },
    include: {
      testsAdvised: true,
      media: {
        orderBy: { order: 'asc' },
        // Only READY thumbnails — PENDING / FAILED would 425 / 410
        // through /api/files/[id].
        where: { asset: { status: 'READY' } },
        include: { asset: true },
      },
      createdBy: { select: { id: true, name: true } },
      cage: { select: { name: true } },
    },
  });
  if (!animal) return null;
  return {
    ...animal,
    media: animal.media.map((m) => ({ ...m, url: signMediaUrl(m.asset.id) })),
  };
}

export interface ActiveAnimalLite {
  id: string;
  name: string;
  species: string;
  ward: string | null;
  status: AnimalStatus;
}

async function _searchActiveAnimalsRaw(
  query: string,
  take: number,
  includePast: boolean,
): Promise<ActiveAnimalLite[]> {
  const q = query.trim();
  const where: Prisma.AnimalWhereInput = {
    deletedAt: null,
    // When includePast=false, restrict to currently admitted animals.
    // When true, return everyone — including discharged + deceased.
    ...(includePast ? {} : { dischargedAt: null, deceasedAt: null }),
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

// Cached.  unstable_cache uses (keys, args) as the cache key, so the
// additional includePast arg automatically separates entries.
const _searchActiveAnimalsCached = unstable_cache(_searchActiveAnimalsRaw, ['search-active-animals'], {
  revalidate: 30,
  tags: ['animals'],
});

export async function searchActiveAnimals(
  query: string,
  take = 20,
  includePast = false,
): Promise<ActiveAnimalLite[]> {
  return _searchActiveAnimalsCached(query, take, includePast);
}

export const getCachedTodayCounts = unstable_cache(
  async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [admissionsToday, dischargesToday, deathsToday, surgeriesToday, critical] = await Promise.all([
      prisma.animal.count({ where: { admittedAt: { gte: today }, deletedAt: null } }),
      prisma.animal.count({ where: { dischargedAt: { gte: today }, deletedAt: null } }),
      prisma.animal.count({ where: { deceasedAt: { gte: today }, deletedAt: null } }),
      prisma.activity.count({
        where: { type: 'SURGERY', occurredAt: { gte: today }, deletedAt: null },
      }),
      prisma.animal.count({
        where: { status: 'CRITICAL', deletedAt: null, dischargedAt: null, deceasedAt: null },
      }),
    ]);
    return { admissionsToday, dischargesToday, deathsToday, surgeriesToday, critical };
  },
  ['today-counts'],
  { revalidate: 60, tags: ['today-counts', 'animals'] },
);
