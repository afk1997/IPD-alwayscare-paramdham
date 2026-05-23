import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const ALLOWED_ROLES = new Set(['STAFF', 'DOCTOR', 'ADMIN'] as const);

// Stay-logged-in policy: once a user signs in we keep the cookie alive
// for a full year and refresh `exp` on every request (`updateAge: 0`
// would freeze it; setting it equal to maxAge effectively re-issues).
// The hard security boundary is still the DB re-check in
// getCurrentUser — if an admin deactivates the user or changes their
// role, the very next request is rejected/downgraded immediately,
// regardless of how long the cookie has been alive.
const ONE_YEAR_SEC = 365 * 24 * 60 * 60;

export const authConfig = {
  session: { strategy: 'jwt', maxAge: ONE_YEAR_SEC, updateAge: ONE_YEAR_SEC },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async () => null,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const raw = (user as { role?: string }).role;
        token.role = raw && ALLOWED_ROLES.has(raw as 'STAFF' | 'DOCTOR' | 'ADMIN') ? raw : undefined;
      }
      // No absolute timeout. Sessions stay valid until the user signs
      // out or an admin deactivates them (getCurrentUser DB re-check).
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
