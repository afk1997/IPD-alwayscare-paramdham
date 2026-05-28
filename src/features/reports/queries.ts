import { activityDetailLines, summarizeActivity } from '@/features/activities/summary';
import { signMediaUrl } from '@/lib/media-sign';
import { prisma } from '@/lib/prisma';
import { startOfISTDay } from '@/lib/time';
import type { ActivityType } from '@prisma/client';
import { unstable_cache } from 'next/cache';

const ACTIVITIES_ON_DATE_CAP = 1000;
const TODAY_TIMELINE_CAP = 200;
const PER_ANIMAL_HISTORY_CAP = 500;

// ── Today timeline ────────────────────────────────────────────────────────
// Latest activities across ALL animals for "today" (start of local day → now).
// Summary text is computed server-side so the cache row is plain strings,
// keeping cache hits cheap and the wire payload small.

export interface TodayTimelineItem {
  id: string;
  animalId: string;
  animalName: string;
  animalSpecies: string;
  /** Pre-signed URL for the animal's intake thumbnail, ready to use in <img src>. */
  animalThumbnailUrl: string | null;
  type: ActivityType;
  occurredAt: Date;
  byName: string;
  remarks: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: per-type activity payload erased at the cache boundary
  data: any;
  editedAt: Date | null;
  // Media attached to THIS activity (for the in-row thumbnail and the
  // ActivitySheet's image / video viewer).  Excludes pending uploads —
  // PENDING / FAILED would 425 / 410 through /api/files/[id].
  media: Array<{
    id: string;
    assetId: string;
    kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
    label: string | null;
    /** Pre-signed URL for this media asset, ready to use in <img src>. */
    url: string;
  }>;
  summary: string;
}

interface TodayTimelineItemCached extends Omit<TodayTimelineItem, 'occurredAt' | 'editedAt'> {
  occurredAt: string;
  editedAt: string | null;
}

async function _listTodayActivitiesRaw(): Promise<TodayTimelineItemCached[]> {
  const now = new Date();
  // Day boundary in IST, not the process timezone (UTC on Vercel).
  const start = startOfISTDay(now);
  // Cap the upper bound at "now" — future-dated entries (a doctor pre-
  // logging a 14:00 surgery at 09:00) shouldn't appear in "today's
  // activities" until they've actually happened.  Also defends the page
  // from accidental future timestamps in seed/test data.
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const upper = now < end ? now : end;

  const rows = await prisma.activity.findMany({
    where: { occurredAt: { gte: start, lte: upper }, deletedAt: null, animal: { deletedAt: null } },
    // Order by `createdAt` desc, not occurredAt — the timeline is a
    // "latest entries logged today" feed.  Sorting by occurredAt pushed
    // future-occurring entries to the top and buried the rows the user
    // had just logged seconds ago.
    orderBy: { createdAt: 'desc' },
    take: TODAY_TIMELINE_CAP,
    select: {
      id: true,
      animalId: true,
      type: true,
      occurredAt: true,
      byName: true,
      remarks: true,
      data: true,
      editedAt: true,
      // The activity's own attached media — for the row thumbnail and
      // the ActivitySheet's media grid.  Skip PENDING/FAILED so the
      // wire payload doesn't reference an asset the API would 425/410.
      media: {
        where: { asset: { status: 'READY' } },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          assetId: true,
          label: true,
          asset: { select: { kind: true } },
        },
      },
      animal: {
        select: {
          name: true,
          species: true,
          media: {
            take: 1,
            orderBy: { order: 'asc' },
            // Only READY assets resolve via /api/files/[id]; skip
            // PENDING/FAILED so the timeline doesn't ship broken images.
            where: { asset: { status: 'READY' } },
            select: { asset: { select: { id: true } } },
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
    animalThumbnailUrl: r.animal.media[0]?.asset.id ? signMediaUrl(r.animal.media[0].asset.id) : null,
    type: r.type,
    occurredAt: r.occurredAt.toISOString(),
    byName: r.byName,
    remarks: r.remarks,
    data: r.data,
    editedAt: r.editedAt ? r.editedAt.toISOString() : null,
    media: r.media.map((m) => ({
      id: m.id,
      assetId: m.assetId,
      kind: m.asset.kind,
      label: m.label,
      url: signMediaUrl(m.assetId),
    })),
    summary: summarizeActivity({ type: r.type, data: r.data, remarks: r.remarks }),
  }));
}

// Tag segmentation: the today timeline has its own `today-timeline` tag
// so non-surgery activity creates don't also bust the dashboard counts
// cache (which still listens on `today-counts`).  `animals` stays so a
// patient rename / avatar change refreshes the timeline rows.
const _listTodayActivitiesCached = unstable_cache(_listTodayActivitiesRaw, ['today-timeline'], {
  revalidate: 30,
  tags: ['today-timeline', 'animals'],
});

export async function listTodayActivities(): Promise<TodayTimelineItem[]> {
  const items = await _listTodayActivitiesCached();
  return items.map((i) => ({
    ...i,
    occurredAt: new Date(i.occurredAt),
    editedAt: i.editedAt ? new Date(i.editedAt) : null,
  }));
}

// ── Daily report (used by /reports/today) ─────────────────────────────────

export interface ActivityRow {
  id: string;
  animalId: string;
  animalName: string;
  animalSpecies: string;
  animalWard: string | null;
  type: ActivityType;
  occurredAt: Date;
  byName: string;
  summary: string;
  // Verbose per-field detail for the daily-report Share output.  One
  // entry per populated field (string fields are skipped when blank;
  // boolean fields render as `yes`/`no` because the negative is
  // clinically meaningful).
  detailLines: string[];
  mediaCount: number;
}

export async function listActivitiesOnDate(date: Date): Promise<ActivityRow[]> {
  const start = startOfISTDay(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows = await prisma.activity.findMany({
    where: { occurredAt: { gte: start, lt: end }, deletedAt: null, animal: { deletedAt: null } },
    orderBy: { occurredAt: 'desc' },
    take: ACTIVITIES_ON_DATE_CAP,
    select: {
      id: true,
      animalId: true,
      type: true,
      occurredAt: true,
      byName: true,
      remarks: true,
      data: true,
      animal: { select: { name: true, species: true, ward: true } },
      // Count only READY assets — PENDING / FAILED would 425/410 through
      // /api/files and shouldn't claim the 📎 indicator in the copy.
      _count: { select: { media: { where: { asset: { status: 'READY' } } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    animalId: r.animalId,
    animalName: r.animal.name,
    animalSpecies: r.animal.species,
    animalWard: r.animal.ward,
    type: r.type,
    occurredAt: r.occurredAt,
    byName: r.byName,
    summary: summarizeActivity({ type: r.type, data: r.data, remarks: r.remarks }),
    detailLines: activityDetailLines({ type: r.type, data: r.data, remarks: r.remarks }),
    mediaCount: r._count.media,
  }));
}

// Same shape + ordering as listActivitiesOnDate but scoped to one
// animal — feeds the per-patient daily Share button.
export async function listActivitiesOnDateForAnimal(date: Date, animalId: string): Promise<ActivityRow[]> {
  const start = startOfISTDay(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows = await prisma.activity.findMany({
    where: {
      animalId,
      occurredAt: { gte: start, lt: end },
      deletedAt: null,
      animal: { deletedAt: null },
    },
    orderBy: { occurredAt: 'desc' },
    take: ACTIVITIES_ON_DATE_CAP,
    select: {
      id: true,
      animalId: true,
      type: true,
      occurredAt: true,
      byName: true,
      remarks: true,
      data: true,
      animal: { select: { name: true, species: true, ward: true } },
      _count: { select: { media: { where: { asset: { status: 'READY' } } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    animalId: r.animalId,
    animalName: r.animal.name,
    animalSpecies: r.animal.species,
    animalWard: r.animal.ward,
    type: r.type,
    occurredAt: r.occurredAt,
    byName: r.byName,
    summary: summarizeActivity({ type: r.type, data: r.data, remarks: r.remarks }),
    detailLines: activityDetailLines({ type: r.type, data: r.data, remarks: r.remarks }),
    mediaCount: r._count.media,
  }));
}

// ── Per-animal report (used by /reports/by-animal) ────────────────────────

export interface AnimalActivitySummary {
  id: string;
  type: ActivityType;
  occurredAt: Date;
  byName: string;
  summary: string;
}

export interface PerAnimalReport {
  animal: {
    id: string;
    name: string;
    species: string;
    ward: string | null;
    admittedAt: Date;
    dischargedAt: Date | null;
    deceasedAt: Date | null;
  };
  totals: Record<ActivityType, number>;
  history: AnimalActivitySummary[];
}

export async function getPerAnimalReport(animalId: string): Promise<PerAnimalReport | null> {
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, deletedAt: null },
    select: {
      id: true,
      name: true,
      species: true,
      ward: true,
      admittedAt: true,
      dischargedAt: true,
      deceasedAt: true,
    },
  });
  if (!animal) return null;

  const [history, totalsRaw] = await Promise.all([
    prisma.activity.findMany({
      where: { animalId, deletedAt: null },
      orderBy: { occurredAt: 'desc' },
      take: PER_ANIMAL_HISTORY_CAP,
      select: { id: true, type: true, occurredAt: true, byName: true, data: true, remarks: true },
    }),
    prisma.activity.groupBy({
      by: ['type'],
      where: { animalId, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const totals: Record<ActivityType, number> = {
    ADMISSION: 0,
    TREATMENT: 0,
    ROUND: 0,
    DIAGNOSTIC: 0,
    SURGERY: 0,
    FOOD: 0,
    BATH: 0,
    WALK: 0,
  };
  for (const row of totalsRaw) totals[row.type] = row._count._all;

  return {
    animal,
    totals,
    history: history.map((h) => ({
      id: h.id,
      type: h.type,
      occurredAt: h.occurredAt,
      byName: h.byName,
      summary: summarizeActivity({ type: h.type, data: h.data, remarks: h.remarks }),
    })),
  };
}
