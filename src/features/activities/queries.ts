import { prisma } from '@/lib/prisma';

export async function listActivitiesForAnimal(animalId: string) {
  return prisma.activity.findMany({
    where: { animalId, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
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
