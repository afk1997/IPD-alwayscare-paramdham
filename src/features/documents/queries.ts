import { prisma } from '@/lib/prisma';
import type { DocCategory } from './schema';

// Practical hard cap on per-animal documents.  Typical patient has <20;
// generous cap protects the patient page from pathological inputs.
const DOC_PER_ANIMAL_CAP = 500;

export async function listDocumentsForAnimal(animalId: string) {
  return prisma.document.findMany({
    where: { animalId, deletedAt: null },
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

export async function listAllDocuments(params: ListAllDocumentsParams = {}) {
  const { limit = 100, search, category } = params;
  return prisma.document.findMany({
    where: {
      deletedAt: null,
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
