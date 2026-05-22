import { LoginSchema } from '@/features/auth/schema';
import { verifyCredentials } from '@/features/auth/service';
import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Credentials from 'next-auth/providers/credentials';
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
  role: 'STAFF' | 'DOCTOR' | 'ADMIN';
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
