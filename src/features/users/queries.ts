import { prisma } from '@/lib/prisma';

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ active: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
      invitedAt: true,
    },
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}
