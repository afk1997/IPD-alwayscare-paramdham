import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

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

async function _listActiveUsersRaw(): Promise<ActiveUserLite[]> {
  return prisma.user.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

// Thin projection for the activity-form "Logged by" dropdown.  Cached
// for 5 minutes; invalidated by every user mutation via the
// `active-users` tag (see inviteUserAction / updateUserAction /
// deactivateUserAction).  Without the cache, every page render hits
// Postgres for the same ~10 rows.
const _listActiveUsersCached = unstable_cache(_listActiveUsersRaw, ['active-users'], {
  revalidate: 300,
  tags: ['active-users'],
});

export async function listActiveUsers(): Promise<ActiveUserLite[]> {
  return _listActiveUsersCached();
}
