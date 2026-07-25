import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const ADMIN_COOKIE = 'venue_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Session signing secret. Set ADMIN_SESSION_SECRET in production — without it
 * a random secret is generated per process, which simply means everyone is
 * logged out whenever the server restarts.
 */
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 16
    ? process.env.ADMIN_SESSION_SECRET
    : randomBytes(32).toString('hex');

/** The admin password. Change it with ADMIN_PASSWORD. */
export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'venue-admin';
}

export function usingDefaultPassword(): boolean {
  return !process.env.ADMIN_PASSWORD;
}

function sign(payload: string): string {
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `admin.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [subject, expiresRaw, signature] = parts;
  if (subject !== 'admin') return false;
  const expiresAt = Number.parseInt(expiresRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(signature, sign(`${subject}.${expiresRaw}`));
}

export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

/**
 * Guard for admin-only route handlers.
 *
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdminRequest()) return null;
  return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Opt-in: this app is commonly served over plain HTTP on a LAN (Synology),
    // where a Secure cookie would silently never be sent back.
    secure: process.env.SECURE_COOKIES === 'true',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export const SESSION_MAX_AGE = SESSION_TTL_MS / 1000;
