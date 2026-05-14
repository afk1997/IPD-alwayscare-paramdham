import { prisma } from '@/lib/prisma';

export async function listDocumentsForAnimal(animalId: string) {
  return prisma.document.findMany({
    where: { animalId, deletedAt: null },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
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
