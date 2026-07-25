import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE,
  adminPassword,
  createSessionToken,
  isAdminRequest,
  safeEqual,
  sessionCookieOptions,
  usingDefaultPassword,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET — is the current browser signed in to the admin panel? */
export async function GET() {
  return NextResponse.json({
    authenticated: await isAdminRequest(),
    usingDefaultPassword: usingDefaultPassword(),
  });
}

/** POST { password } — sign in. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const supplied = String(body.password ?? '');

  if (!supplied || !safeEqual(supplied, adminPassword())) {
    // Slow brute-force attempts down without holding a connection open for long.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true, usingDefaultPassword: usingDefaultPassword() });
  response.cookies.set(ADMIN_COOKIE, createSessionToken(), sessionCookieOptions(SESSION_MAX_AGE));
  return response;
}

/** DELETE — sign out. */
export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE, '', sessionCookieOptions(0));
  return response;
}
