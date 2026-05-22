import { prisma } from '@/lib/prisma';
import { type Actor, assertCan } from '@/lib/rbac';
import type { DocCategory } from './schema';

// Practical hard cap on per-animal documents.  Typical patient has <20;
// generous cap protects the patient page from pathological inputs.
const DOC_PER_ANIMAL_CAP = 500;

export async function listDocumentsForAnimal(animalId: string) {
  return prisma.document.findMany({
    where: { animalId, deletedAt: null, animal: { deletedAt: null } },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    take: DOC_PER_ANIMAL_CAP,
    include: {
      file: true,
      uploadedBy: { select: { name: true } },
    },
  });
}

export interface ListAllDocumentsParams {
  limit?: number;
  search?: string;
  category?: DocCategory;
}

export async function listAllDocuments(actor: Actor, params: ListAllDocumentsParams = {}) {
  // Aggregated cross-animal document listing exposes PHI (death certificates,
  // consent forms, identity documents). ADMIN-only — RBAC-5 / SD-4.
  assertCan(actor, 'document.read.all');
  const { limit = 100, search, category } = params;
  return prisma.document.findMany({
    where: {
      deletedAt: null,
      animal: { deletedAt: null },
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { kind: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
              { animal: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      animal: { select: { id: true, name: true, species: true } },
      file: true,
      uploadedBy: { select: { name: true } },
    },
  });
}
