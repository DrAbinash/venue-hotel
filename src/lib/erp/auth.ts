import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { effectiveModules, type ErpModule } from '@/lib/erp/perms';

export const STAFF_COOKIE = 'venue_staff';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // one hotel shift, with margin

/**
 * Session signing secret. ERP_SESSION_SECRET (or the admin secret) keeps
 * staff logged in across restarts; otherwise a per-process secret is used.
 */
const SECRET =
  (process.env.ERP_SESSION_SECRET && process.env.ERP_SESSION_SECRET.length >= 16
    ? process.env.ERP_SESSION_SECRET
    : undefined) ||
  (process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 16
    ? `erp:${process.env.ADMIN_SESSION_SECRET}`
    : randomBytes(32).toString('hex'));

// ---------------------------------------------------------------------------
//  Passwords — scrypt with per-user salt, no external dependency.
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `s2:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 's2') return false;
  const [, salt, hash] = parts;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---------------------------------------------------------------------------
//  Sessions — signed, self-contained tokens in an HTTP-only cookie.
// ---------------------------------------------------------------------------

export interface StaffSession {
  uid: string;
  username: string;
  name: string;
  role: string;
  modules: string[];
  exp: number;
}

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createStaffToken(user: {
  id: string; username: string; name: string; role: string; permissions: string;
}): string {
  let extras: string[] = [];
  try { extras = JSON.parse(user.permissions || '[]'); } catch { extras = []; }
  const session: StaffSession = {
    uid: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    modules: effectiveModules(user.role, extras),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyStaffToken(token: string | undefined): StaffSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as StaffSession;
    if (!session.uid || !Number.isFinite(session.exp) || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const store = await cookies();
  return verifyStaffToken(store.get(STAFF_COOKIE)?.value);
}

/**
 * Guard for ERP route handlers. Confirms the signed-in user still exists and
 * is active, then checks module access.
 *
 *   const auth = await requireErp('frontdesk');
 *   if (auth.denied) return auth.denied;
 *   // auth.session is safe to use
 */
export async function requireErp(
  module?: ErpModule,
): Promise<{ session: StaffSession; denied?: undefined } | { session?: undefined; denied: NextResponse }> {
  const session = await getStaffSession();
  if (!session) {
    return { denied: NextResponse.json({ error: 'Staff sign-in required' }, { status: 401 }) };
  }
  const user = await db.staffUser.findUnique({ where: { id: session.uid } });
  if (!user || !user.isActive) {
    return { denied: NextResponse.json({ error: 'Account disabled' }, { status: 401 }) };
  }
  if (module && !session.modules.includes(module)) {
    return { denied: NextResponse.json({ error: `No access to ${module}` }, { status: 403 }) };
  }
  return { session };
}

export function staffCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Same LAN-first posture as the admin panel: Secure is opt-in.
    secure: process.env.SECURE_COOKIES === 'true',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export const STAFF_SESSION_MAX_AGE = SESSION_TTL_MS / 1000;
