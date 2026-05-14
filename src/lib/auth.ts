import { LoginSchema } from '@/features/auth/schema';
import { verifyCredentials } from '@/features/auth/service';
import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(raw) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        return verifyCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? 'STAFF';
      }
      return session;
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
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
    role: (session.user.role ?? 'STAFF') as CurrentUser['role'],
  };
}
