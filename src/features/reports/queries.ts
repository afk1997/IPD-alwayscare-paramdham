import { prisma } from '@/lib/prisma';
import type { ActivityType } from '@prisma/client';

export interface NeedsAttentionItem {
  id: string;
  name: string;
  species: string;
  status: string;
  lastActivityAt: Date | null;
}

export async function listNeedsAttention(): Promise<NeedsAttentionItem[]> {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const animals = await prisma.animal.findMany({
    where: {
      deletedAt: null,
      dischargedAt: null,
      deceasedAt: null,
      OR: [
        { status: 'CRITICAL' },
        { activities: { none: { occurredAt: { gte: sixHoursAgo }, deletedAt: null } } },
      ],
    },
    orderBy: { admittedAt: 'desc' },
    select: {
      id: true,
      name: true,
      species: true,
      status: true,
      activities: {
        take: 1,
        orderBy: { occurredAt: 'desc' },
        where: { deletedAt: null },
        select: { occurredAt: true },
      },
    },
    take: 50,
  });
  return animals.map((a) => ({
    id: a.id,
    name: a.name,
    species: a.species,
    status: a.status,
    lastActivityAt: a.activities[0]?.occurredAt ?? null,
  }));
}

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
