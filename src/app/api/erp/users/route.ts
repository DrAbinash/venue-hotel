import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/erp/auth';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { ERP_MODULES, ERP_ROLES } from '@/lib/erp/perms';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await erpGuard('users');
  if (auth.denied) return auth.denied;
  const users = await db.staffUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, username: true, name: true, email: true, phone: true, role: true,
      permissions: true, isActive: true, lastLoginAt: true, createdAt: true,
    },
  });
  return NextResponse.json({ users });
}

/**
 * POST — { action: "create" | "update" | "reset_password" | "toggle", ... }
 */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('users');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'create') {
      const username = String(body.username ?? '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return NextResponse.json({ error: 'Username: 3–32 chars, letters/numbers/._- only.' }, { status: 400 });
      }
      const password = String(body.password ?? '');
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
      }
      const clash = await db.staffUser.findUnique({ where: { username } });
      if (clash) return NextResponse.json({ error: 'That username is taken.' }, { status: 409 });
      const user = await db.staffUser.create({
        data: {
          username,
          name: String(body.name ?? username).slice(0, 80),
          email: body.email ? String(body.email).slice(0, 120) : null,
          phone: body.phone ? String(body.phone).slice(0, 20) : null,
          role: cleanRole(body.role),
          permissions: cleanPermissions(body.permissions),
          passwordHash: hashPassword(password),
          mustChangePassword: Boolean(body.mustChangePassword ?? true),
        },
      });
      await logAudit(session, 'users.create', {
        entity: 'StaffUser', entityId: user.id, summary: `Staff user "${username}" created (${user.role})`,
      });
      return NextResponse.json({ ok: true, id: user.id });
    }

    const id = String(body.id ?? '');
    const user = id ? await db.staffUser.findUnique({ where: { id } }) : null;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (action === 'update') {
      await db.staffUser.update({
        where: { id },
        data: {
          name: String(body.name ?? user.name).slice(0, 80),
          email: body.email !== undefined ? String(body.email ?? '').slice(0, 120) || null : user.email,
          phone: body.phone !== undefined ? String(body.phone ?? '').slice(0, 20) || null : user.phone,
          role: body.role !== undefined ? cleanRole(body.role) : user.role,
          permissions: body.permissions !== undefined ? cleanPermissions(body.permissions) : user.permissions,
        },
      });
      await logAudit(session, 'users.update', {
        entity: 'StaffUser', entityId: id, summary: `Staff user "${user.username}" updated`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'reset_password') {
      const password = String(body.password ?? '');
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
      }
      await db.staffUser.update({
        where: { id },
        data: { passwordHash: hashPassword(password), mustChangePassword: true },
      });
      await logAudit(session, 'users.reset_password', {
        entity: 'StaffUser', entityId: id, summary: `Password reset for "${user.username}"`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'toggle') {
      if (user.id === session.uid) {
        return NextResponse.json({ error: 'You cannot disable your own account.' }, { status: 400 });
      }
      const updated = await db.staffUser.update({
        where: { id },
        data: { isActive: !user.isActive },
      });
      await logAudit(session, 'users.toggle', {
        entity: 'StaffUser', entityId: id,
        summary: `Staff user "${user.username}" ${updated.isActive ? 'enabled' : 'disabled'}`,
      });
      return NextResponse.json({ ok: true, isActive: updated.isActive });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('users route failed', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

function cleanRole(raw: unknown): string {
  const role = String(raw ?? 'FRONTDESK').toUpperCase();
  return (ERP_ROLES as readonly string[]).includes(role) ? role : 'FRONTDESK';
}

function cleanPermissions(raw: unknown): string {
  if (!Array.isArray(raw)) return '[]';
  const clean = raw.map(String).filter((m) => (ERP_MODULES as readonly string[]).includes(m));
  return JSON.stringify([...new Set(clean)]);
}
