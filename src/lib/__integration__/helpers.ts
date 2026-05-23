import { prisma } from '@/lib/prisma';
import type { Actor } from '@/lib/rbac';

/**
 * Shared helpers for integration tests. Anything created via these helpers
 * carries the `__qa__` marker so scripts/cleanup-qa-data.ts can delete
 * the trail at the end of the campaign.
 */

export const QA = '__qa__';

export function qaName(label: string): string {
  // Random suffix prevents collisions across parallel test files.
  return `${QA}${label}-${Math.random().toString(36).slice(2, 8)}`;
}

export function qaRemarks(label: string): string {
  return `${QA} ${label} ${Date.now()}`;
}

/**
 * Look up one of the seeded users by email and return an Actor.  Seeded
 * admins/doctors/staff are reused across tests; we never invite new ones
 * because there's no clean way to delete a User row that has audit log
 * references (FK Restrict, by design — DB-1 fix).
 */
export async function actorByEmail(email: string): Promise<Actor & { name: string }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true, name: true },
  });
  return { id: user.id, role: user.role, name: user.name };
}

export const ADMIN_EMAIL = 'admin@arham.care';
export const DOCTOR_EMAIL = 'mehta@arham.care';
export const DOCTOR2_EMAIL = 'iyer@arham.care';
export const STAFF_EMAIL = 'sahil@arham.care';

/** Delete every row carrying the __qa__ marker. Safe to call repeatedly. */
export async function purgeQa(): Promise<void> {
  // Discover targets first so we can delete dependent rows in the right
  // order without tripping FK Restrict on User references.
  const [animals, activities, documents, mediaAssets] = await Promise.all([
    prisma.animal.findMany({
      where: { name: { contains: QA } },
      select: { id: true },
    }),
    prisma.activity.findMany({
      where: {
        OR: [
          { remarks: { contains: QA } },
          { byName: { contains: QA } },
          { animal: { name: { contains: QA } } },
        ],
      },
      select: { id: true },
    }),
    prisma.document.findMany({
      where: { OR: [{ name: { contains: QA } }, { animal: { name: { contains: QA } } }] },
      select: { id: true },
    }),
    prisma.mediaAsset.findMany({
      where: {
        OR: [{ filename: { contains: QA } }, { originalFilename: { contains: QA } }],
      },
      select: { id: true },
    }),
  ]);

  const allIds = [
    ...animals.map((a) => a.id),
    ...activities.map((x) => x.id),
    ...documents.map((d) => d.id),
    ...mediaAssets.map((m) => m.id),
  ];
  if (allIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: allIds } } });
  }

  if (documents.length > 0) {
    await prisma.document.deleteMany({ where: { id: { in: documents.map((d) => d.id) } } });
  }
  if (activities.length > 0) {
    await prisma.activity.deleteMany({ where: { id: { in: activities.map((x) => x.id) } } });
  }
  if (animals.length > 0) {
    const ids = animals.map((a) => a.id);
    await prisma.dischargeRecord.deleteMany({ where: { animalId: { in: ids } } });
    await prisma.deathRecord.deleteMany({ where: { animalId: { in: ids } } });
    await prisma.animal.deleteMany({ where: { id: { in: ids } } });
  }
  if (mediaAssets.length > 0) {
    await prisma.mediaAsset.deleteMany({ where: { id: { in: mediaAssets.map((m) => m.id) } } });
  }
  await prisma.driveFolder.deleteMany({ where: { key: { contains: QA } } });
}
