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

export interface ActiveUserLite {
  id: string;
  name: string;
}

// Thin projection for the activity-form "Logged by" dropdown.  Sorted
// by name (case-insensitive via Postgres collation) so the menu reads
// alphabetically.  Cheap query (~5 ms for ~10 rows), called once per
// layout render and surfaced via ActiveUsersProvider.
export async function listActiveUsers(): Promise<ActiveUserLite[]> {
  return prisma.user.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
