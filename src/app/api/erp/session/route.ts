import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminPassword, safeEqual } from '@/lib/auth';
import {
  STAFF_COOKIE, STAFF_SESSION_MAX_AGE, createStaffToken, getStaffSession,
  hashPassword, staffCookieOptions, verifyPassword,
} from '@/lib/erp/auth';
import { ensureErpReady } from '@/lib/erp/bootstrap';
import { logAudit } from '@/lib/erp/audit';

export const dynamic = 'force-dynamic';

/**
 * GET — session status. `needsSetup` is true until the first administrator
 * account exists, which drives the one-time setup screen.
 */
export async function GET() {
  await ensureErpReady();
  const [session, staffCount] = await Promise.all([
    getStaffSession(),
    db.staffUser.count(),
  ]);
  if (!session) {
    return NextResponse.json({ authenticated: false, needsSetup: staffCount === 0 });
  }
  const user = await db.staffUser.findUnique({ where: { id: session.uid } });
  if (!user || !user.isActive) {
    return NextResponse.json({ authenticated: false, needsSetup: staffCount === 0 });
  }
  return NextResponse.json({
    authenticated: true,
    needsSetup: false,
    user: {
      username: session.username,
      name: session.name,
      role: session.role,
      modules: session.modules,
      mustChangePassword: user.mustChangePassword,
    },
  });
}

/**
 * POST — sign in, or perform first-run setup.
 *
 * { action: "login", username, password }
 * { action: "setup", adminPassword, username, password, name }
 *   Setup only works while no staff users exist and is authorised with the
 *   website's ADMIN_PASSWORD, so a fresh ERP cannot be claimed by a stranger.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? 'login');

  if (action === 'setup') {
    const count = await db.staffUser.count();
    if (count > 0) {
      return NextResponse.json({ error: 'Setup is already complete.' }, { status: 400 });
    }
    const supplied = String(body.adminPassword ?? '');
    if (!supplied || !safeEqual(supplied, adminPassword())) {
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ error: 'The admin password is incorrect.' }, { status: 401 });
    }
    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const name = String(body.name ?? '').trim() || 'Administrator';
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return NextResponse.json({ error: 'Username: 3–32 chars, letters/numbers/._- only.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    const user = await db.staffUser.create({
      data: { username, name, role: 'ADMIN', passwordHash: hashPassword(password) },
    });
    await logAudit({ username, uid: user.id }, 'session.setup', {
      entity: 'StaffUser', entityId: user.id, summary: `First administrator "${username}" created`,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(STAFF_COOKIE, createStaffToken(user), staffCookieOptions(STAFF_SESSION_MAX_AGE));
    return response;
  }

  const username = String(body.username ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const user = username
    ? await db.staffUser.findUnique({ where: { username } })
    : null;
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  await db.staffUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({ username: user.username, uid: user.id }, 'session.login', {
    summary: `${user.name} signed in`,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_COOKIE, createStaffToken(user), staffCookieOptions(STAFF_SESSION_MAX_AGE));
  return response;
}

/** PATCH — change own password. { currentPassword, newPassword } */
export async function PATCH(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const user = await db.staffUser.findUnique({ where: { id: session.uid } });
  if (!user || !verifyPassword(String(body.currentPassword ?? ''), user.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
  }
  const newPassword = String(body.newPassword ?? '');
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }
  await db.staffUser.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
  });
  await logAudit(session, 'session.password_change', { summary: `${user.username} changed their password` });
  return NextResponse.json({ ok: true });
}

/** DELETE — sign out. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_COOKIE, '', staffCookieOptions(0));
  return response;
}
