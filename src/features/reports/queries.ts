import { summarizeActivity } from '@/features/activities/summary';
import { prisma } from '@/lib/prisma';
import type { ActivityType } from '@prisma/client';
import { unstable_cache } from 'next/cache';

const ACTIVITIES_ON_DATE_CAP = 1000;
const TODAY_TIMELINE_CAP = 200;

// ── Today timeline ────────────────────────────────────────────────────────
// Latest activities across ALL animals for "today" (start of local day → now).
// Summary text is computed server-side so the cache row is plain strings,
// keeping cache hits cheap and the wire payload small.

export interface TodayTimelineItem {
  id: string;
  animalId: string;
  animalName: string;
  animalSpecies: string;
  animalThumbnailKey: string | null;
  type: ActivityType;
  occurredAt: Date;
  byName: string;
  summary: string;
}

interface TodayTimelineItemCached extends Omit<TodayTimelineItem, 'occurredAt'> {
  occurredAt: string;
}

async function _listTodayActivitiesRaw(): Promise<TodayTimelineItemCached[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const rows = await prisma.activity.findMany({
    where: { occurredAt: { gte: start, lt: end }, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
    take: TODAY_TIMELINE_CAP,
    select: {
      id: true,
      animalId: true,
      type: true,
      occurredAt: true,
      byName: true,
      remarks: true,
      data: true,
      animal: {
        select: {
          name: true,
          species: true,
          media: {
            take: 1,
            orderBy: { order: 'asc' },
            select: { asset: { select: { storageKey: true } } },
          },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    animalId: r.animalId,
    animalName: r.animal.name,
    animalSpecies: r.animal.species,
    animalThumbnailKey: r.animal.media[0]?.asset.storageKey ?? null,
    type: r.type,
    occurredAt: r.occurredAt.toISOString(),
    byName: r.byName,
    summary: summarizeActivity({ type: r.type, data: r.data, remarks: r.remarks }),
  }));
}

const _listTodayActivitiesCached = unstable_cache(_listTodayActivitiesRaw, ['today-timeline'], {
  revalidate: 30,
  tags: ['today-counts', 'animals'],
});

export async function listTodayActivities(): Promise<TodayTimelineItem[]> {
  const items = await _listTodayActivitiesCached();
  return items.map((i) => ({ ...i, occurredAt: new Date(i.occurredAt) }));
}

// ── Daily report (used by /reports/today) ─────────────────────────────────

export interface ActivityRow {
  id: string;
  animalId: string;
  animalName: string;
  type: ActivityType;
  occurredAt: Date;
  byName: string;
}

export async function listActivitiesOnDate(date: Date): Promise<ActivityRow[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const rows = await prisma.activity.findMany({
    where: { occurredAt: { gte: start, lt: end }, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
    take: ACTIVITIES_ON_DATE_CAP,
    include: { animal: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    animalId: r.animalId,
    animalName: r.animal.name,
    type: r.type,
    occurredAt: r.occurredAt,
    byName: r.byName,
  }));
}
