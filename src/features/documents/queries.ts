import { prisma } from '@/lib/prisma';

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

export async function listAllDocuments(limit = 100) {
  return prisma.document.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      animal: { select: { id: true, name: true, species: true } },
      file: true,
      uploadedBy: { select: { name: true } },
    },
  });
}
