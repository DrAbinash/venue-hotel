import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';

export const dynamic = 'force-dynamic';

const HK_STATUSES = ['clean', 'dirty', 'inspected', 'out_of_order', 'out_of_service'];
const TASK_STATUSES = ['open', 'in_progress', 'done', 'verified'];

/** GET — the housekeeping board: rooms with live occupancy, tasks, lost & found. */
export async function GET() {
  const auth = await erpGuard('housekeeping');
  if (auth.denied) return auth.denied;

  const [units, inHouse, tasks, lostFound] = await Promise.all([
    db.roomUnit.findMany({
      include: { room: { select: { name: true, type: true } } },
      orderBy: [{ sortOrder: 'asc' }, { unitNumber: 'asc' }],
    }),
    db.booking.findMany({
      where: { status: 'checked_in' },
      select: { unitId: true, guestName: true, checkOut: true, bookingRef: true },
    }),
    db.hkTask.findMany({
      where: { status: { in: ['open', 'in_progress', 'done'] } },
      include: { unit: { select: { unitNumber: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 200,
    }),
    db.lostFound.findMany({ orderBy: { foundOn: 'desc' }, take: 100 }),
  ]);

  const occupant = new Map(inHouse.filter((b) => b.unitId).map((b) => [b.unitId as string, b]));
  return NextResponse.json({
    units: units.map((u) => ({
      id: u.id,
      unitNumber: u.unitNumber,
      roomName: u.room.name,
      hkStatus: u.hkStatus,
      hkNotes: u.hkNotes,
      isActive: u.isActive,
      occupied: occupant.has(u.id),
      guestName: occupant.get(u.id)?.guestName ?? null,
      bookingRef: occupant.get(u.id)?.bookingRef ?? null,
    })),
    tasks,
    lostFound,
  });
}

/**
 * POST — { action: "set_status" | "rename_unit" | "task_create" | "task_update" | "lf_create" | "lf_update", ... }
 */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('housekeeping');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'set_status') {
      const unit = await db.roomUnit.findUnique({ where: { id: String(body.unitId ?? '') } });
      if (!unit) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      const hkStatus = String(body.hkStatus ?? '');
      if (!HK_STATUSES.includes(hkStatus)) return NextResponse.json({ error: 'Bad status' }, { status: 400 });
      await db.roomUnit.update({
        where: { id: unit.id },
        data: { hkStatus, hkNotes: body.notes !== undefined ? String(body.notes ?? '').slice(0, 300) || null : unit.hkNotes },
      });
      await logAudit(session, 'housekeeping.status', {
        entity: 'RoomUnit', entityId: unit.id, summary: `Room ${unit.unitNumber} → ${hkStatus.replace(/_/g, ' ')}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'rename_unit') {
      const unit = await db.roomUnit.findUnique({ where: { id: String(body.unitId ?? '') } });
      if (!unit) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      const unitNumber = String(body.unitNumber ?? '').trim().slice(0, 20);
      if (!unitNumber) return NextResponse.json({ error: 'Room number required' }, { status: 400 });
      const clash = await db.roomUnit.findUnique({ where: { unitNumber } });
      if (clash && clash.id !== unit.id) return NextResponse.json({ error: 'That room number exists' }, { status: 409 });
      await db.roomUnit.update({
        where: { id: unit.id },
        data: { unitNumber, isActive: body.isActive !== undefined ? Boolean(body.isActive) : unit.isActive },
      });
      await logAudit(session, 'housekeeping.rename', {
        entity: 'RoomUnit', entityId: unit.id, summary: `Room ${unit.unitNumber} renamed to ${unitNumber}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'task_create') {
      const task = await db.hkTask.create({
        data: {
          unitId: body.unitId ? String(body.unitId) : null,
          area: body.area ? String(body.area).slice(0, 80) : null,
          type: String(body.type ?? 'cleaning').slice(0, 20),
          notes: body.notes ? String(body.notes).slice(0, 300) : null,
          assignedTo: body.assignedTo ? String(body.assignedTo).slice(0, 80) : null,
          priority: ['low', 'normal', 'high', 'urgent'].includes(String(body.priority)) ? String(body.priority) : 'normal',
          createdBy: session.username,
        },
      });
      return NextResponse.json({ ok: true, task });
    }

    if (action === 'task_update') {
      const task = await db.hkTask.findUnique({ where: { id: String(body.taskId ?? '') } });
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      const status = body.status !== undefined ? String(body.status) : task.status;
      if (!TASK_STATUSES.includes(status)) return NextResponse.json({ error: 'Bad status' }, { status: 400 });
      const updated = await db.hkTask.update({
        where: { id: task.id },
        data: {
          status,
          assignedTo: body.assignedTo !== undefined ? String(body.assignedTo ?? '').slice(0, 80) || null : task.assignedTo,
          notes: body.notes !== undefined ? String(body.notes ?? '').slice(0, 300) || null : task.notes,
          completedAt: ['done', 'verified'].includes(status) && !task.completedAt ? new Date() : task.completedAt,
        },
      });
      // A verified clean flips the room's status in one step.
      if (status === 'verified' && task.unitId && ['cleaning', 'deep_clean', 'turndown'].includes(task.type)) {
        await db.roomUnit.update({ where: { id: task.unitId }, data: { hkStatus: 'inspected' } });
      }
      return NextResponse.json({ ok: true, task: updated });
    }

    if (action === 'lf_create') {
      const item = String(body.item ?? '').trim();
      if (!item) return NextResponse.json({ error: 'Item description required' }, { status: 400 });
      const entry = await db.lostFound.create({
        data: {
          item: item.slice(0, 120),
          description: body.description ? String(body.description).slice(0, 300) : null,
          foundAt: body.foundAt ? String(body.foundAt).slice(0, 80) : null,
          foundBy: body.foundBy ? String(body.foundBy).slice(0, 80) : session.username,
          guestName: body.guestName ? String(body.guestName).slice(0, 80) : null,
          guestContact: body.guestContact ? String(body.guestContact).slice(0, 60) : null,
        },
      });
      await logAudit(session, 'housekeeping.lost_found', {
        entity: 'LostFound', entityId: entry.id, summary: `Lost & found logged: ${item}`,
      });
      return NextResponse.json({ ok: true, entry });
    }

    if (action === 'lf_update') {
      const entry = await db.lostFound.findUnique({ where: { id: String(body.id ?? '') } });
      if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      const status = String(body.status ?? entry.status);
      await db.lostFound.update({
        where: { id: entry.id },
        data: {
          status: ['stored', 'returned', 'disposed'].includes(status) ? status : entry.status,
          guestName: body.guestName !== undefined ? String(body.guestName ?? '').slice(0, 80) || null : entry.guestName,
          guestContact: body.guestContact !== undefined ? String(body.guestContact ?? '').slice(0, 60) || null : entry.guestContact,
          notes: body.notes !== undefined ? String(body.notes ?? '').slice(0, 300) || null : entry.notes,
          returnedOn: status === 'returned' && !entry.returnedOn ? new Date() : entry.returnedOn,
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('housekeeping action failed', action, error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
