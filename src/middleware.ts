import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/login');

  if (!isLoggedIn && !isAuthPage) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico)$).*)'],
};
