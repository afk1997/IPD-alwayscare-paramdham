import { prisma } from '@/lib/prisma';

// Hard cap on activity-feed depth per animal — far past a realistic IPD stay
// (months of multi-daily logs).  Pages that need older history paginate
// separately.
const ACTIVITY_FEED_CAP = 500;

export async function listActivitiesForAnimal(animalId: string) {
  return prisma.activity.findMany({
    where: { animalId, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
    take: ACTIVITY_FEED_CAP,
    include: {
      media: { include: { asset: true } },
      byUser: { select: { id: true, name: true } },
    },
  });
}

export async function getLastActivityAt(animalId: string): Promise<Date | null> {
  const last = await prisma.activity.findFirst({
    where: { animalId, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
    select: { occurredAt: true },
  });
  return last?.occurredAt ?? null;
}
