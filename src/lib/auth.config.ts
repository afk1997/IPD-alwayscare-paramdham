import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const ALLOWED_ROLES = new Set(['STAFF', 'DOCTOR', 'ADMIN'] as const);

export const authConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8, updateAge: 0 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async () => null,
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        const raw = (user as { role?: string }).role;
        token.role = raw && ALLOWED_ROLES.has(raw as 'STAFF' | 'DOCTOR' | 'ADMIN') ? raw : undefined;
        token.iat = Math.floor(Date.now() / 1000);
      }
      if (trigger === 'update' && token.id) {
        token.iat = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
        const role = token.role as string | undefined;
        session.user.role = role && ALLOWED_ROLES.has(role as 'STAFF' | 'DOCTOR' | 'ADMIN') ? role : '';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
