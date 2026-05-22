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
      // AUTH-9: absolute timeout. Even with updateAge:0 the cookie can
      // hang around for `maxAge` seconds of inactivity, but once iat is
      // older than 12h treat the token as expired regardless. Doctors
      // hand off devices between shifts; the floor matters.
      const issuedAt = typeof token.iat === 'number' ? token.iat : 0;
      const ABSOLUTE_MAX_SEC = 12 * 60 * 60;
      if (issuedAt > 0 && Date.now() / 1000 - issuedAt > ABSOLUTE_MAX_SEC) {
        return {};
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
