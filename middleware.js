import { NextResponse } from 'next/server';

const COOKIE_NAME = 'app_auth';
const COOKIE_OK = 'authenticated';

function isAuthenticated(value) {
  return value === COOKIE_OK;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // allow Next internals & auth APIs without check
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/_static') ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout'
  ) {
    return NextResponse.next();
  }

  // untuk semua API lain biarkan lewat (opsional bisa diproteksi)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const auth = request.cookies.get(COOKIE_NAME)?.value;
  const authed = isAuthenticated(auth);

  // sudah login tapi buka /login -> lempar ke dashboard
  if (pathname === '/login') {
    if (authed) return NextResponse.redirect(new URL('/dashboard', request.url));
    return NextResponse.next();
  }

  // root "/" -> arahkan sesuai auth
  if (pathname === '/') {
    if (authed) return NextResponse.redirect(new URL('/dashboard', request.url));
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // proteksi dashboard
  if (pathname.startsWith('/dashboard')) {
    if (!authed) return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
};
