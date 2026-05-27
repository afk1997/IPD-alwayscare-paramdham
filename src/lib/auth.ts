import { LoginSchema } from '@/features/auth/schema';
import { verifyCredentials } from '@/features/auth/service';
import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Credentials from 'next-auth/providers/credentials';
import { redirect } from 'next/navigation';
import { writeAuditLog } from './audit';
import { authConfig } from './auth.config';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        return verifyCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (!user?.id) return;
      try {
        await writeAuditLog(prisma, {
          actorId: user.id,
          action: 'login',
          entityType: 'User',
          entityId: user.id,
        });
      } catch (e) {
        console.error('[auth] signIn audit failed', e instanceof Error ? e.message : 'unknown');
      }
    },
    async signOut(message) {
      const userId = 'token' in message ? message.token?.id : undefined;
      if (!userId || typeof userId !== 'string') return;
      try {
        await writeAuditLog(prisma, {
          actorId: userId,
          action: 'logout',
          entityType: 'User',
          entityId: userId,
        });
      } catch (e) {
        console.error('[auth] signOut audit failed', e instanceof Error ? e.message : 'unknown');
      }
    },
  },
});

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'STAFF' | 'DOCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'VIEWER';
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!dbUser || !dbUser.active) return null;
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
}

// Server-side guard: redirect VIEWER away from write-only routes.
// Mount at the top of any patient new / edit / discharge / death page so
// VIEWER never sees the form chrome (defence-in-depth on top of the
// server action's RBAC denial).
export async function requireWriteRole(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role === 'VIEWER') redirect('/');
  return user;
}

// Server-side guard: redirect anyone who isn't admin-equivalent away
// from the /admin/* subtree, /documents, audit log, trash. SUPER_ADMIN
// counts as admin (it's a superset). Replaces the scattered
// `user.role !== 'ADMIN'` checks that were missing SUPER_ADMIN.
export async function requireAdminRole(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') redirect('/');
  return user;
}

// Server-side guard for the /cages page. DOCTOR is included (broader than
// the admin-only pages) because doctors manage cages too.
export async function requireCageManageRole(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'DOCTOR' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') redirect('/');
  return user;
}
