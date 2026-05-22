import { authConfig } from '@/lib/auth.config';
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

function isSafeNextPath(p: string): boolean {
  if (!p.startsWith('/')) return false;
  if (p.startsWith('//') || p.startsWith('/\\')) return false;
  return true;
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/login');

  if (!isLoggedIn && !isAuthPage) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    const rawNext = req.nextUrl.pathname + (req.nextUrl.search || '');
    if (isSafeNextPath(rawNext)) loginUrl.searchParams.set('next', rawNext);
    return NextResponse.redirect(loginUrl);
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
