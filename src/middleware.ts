/**
 * Next.js Middleware
 * Protects dashboard routes — redirects to /login if no session
 */

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/health',
  '/_next',
  '/favicon',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for Supabase session cookie (sb-*-auth-token)
  const cookies = req.cookies;
  const hasSession = Array.from(cookies.getAll()).some(
    (c) => c.name.includes('auth-token') || c.name.includes('sb-') && c.name.includes('-auth')
  );

  // Redirect to login if no session
  if (!hasSession) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
};
