import { signMediaUrl } from '@/lib/media-sign';
import { prisma } from '@/lib/prisma';

// Hard cap on activity-feed depth per animal — far past a realistic IPD stay
// (months of multi-daily logs).  Pages that need older history paginate
// separately.
const ACTIVITY_FEED_CAP = 500;

export async function listActivitiesForAnimal(animalId: string) {
  const rows = await prisma.activity.findMany({
    where: { animalId, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
    take: ACTIVITY_FEED_CAP,
    include: {
      media: {
        where: { asset: { status: 'READY' } },
        include: { asset: true },
      },
      byUser: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    media: r.media.map((m) => ({ ...m, url: signMediaUrl(m.asset.id) })),
  }));
}

export async function getLastActivityAt(animalId: string): Promise<Date | null> {
  const last = await prisma.activity.findFirst({
    where: { animalId, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
    select: { occurredAt: true },
  });
  return last?.occurredAt ?? null;
}
