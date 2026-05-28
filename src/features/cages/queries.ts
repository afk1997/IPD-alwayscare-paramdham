import { prisma } from '@/lib/prisma';

export async function listCagesWithOccupancy() {
  return prisma.cage.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      occupant: { select: { id: true, name: true, species: true, status: true } },
    },
  });
}

// Cages a patient can be assigned to right now: every empty cage, plus the
// cage this patient already occupies (so the edit form can show + keep it).
export async function listAssignableCages(animalId?: string): Promise<{ id: string; name: string }[]> {
  const current = animalId
    ? await prisma.animal.findUnique({ where: { id: animalId }, select: { cageId: true } })
    : null;
  return prisma.cage.findMany({
    where: {
      OR: [{ occupant: { is: null } }, ...(current?.cageId ? [{ id: current.cageId }] : [])],
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
