import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { nextDocNo } from '@/lib/erp/numbering';
import { addDays, istDate } from '@/lib/erp/dates';

export const dynamic = 'force-dynamic';

/** GET — assets (with AMC/warranty alerts) and work-order tickets. */
export async function GET() {
  const auth = await erpGuard('maintenance');
  if (auth.denied) return auth.denied;
  const [assets, tickets] = await Promise.all([
    db.asset.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] }),
    db.maintenanceTicket.findMany({
      include: { asset: { select: { name: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    }),
  ]);
  const soon = addDays(istDate(), 30);
  return NextResponse.json({
    assets,
    tickets,
    expiringAmc: assets.filter((a) => a.status !== 'retired' && ((a.amcExpiry && a.amcExpiry <= soon) || (a.warrantyExpiry && a.warrantyExpiry <= soon))),
  });
}

/** POST — { action: "asset_save" | "ticket_create" | "ticket_update", ... } */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('maintenance');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const str = (k: string, max = 120) => (body[k] !== undefined && body[k] !== null && body[k] !== '' ? String(body[k]).slice(0, max) : null);

  try {
    if (action === 'asset_save') {
      const name = String(body.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'Asset name is required' }, { status: 400 });
      const data = {
        name: name.slice(0, 120),
        category: String(body.category ?? 'general').slice(0, 30),
        location: str('location', 80),
        serialNo: str('serialNo', 60),
        purchaseDate: str('purchaseDate', 10),
        purchaseCost: Math.max(0, Number(body.purchaseCost) || 0),
        amcVendor: str('amcVendor', 100),
        amcExpiry: str('amcExpiry', 10),
        warrantyExpiry: str('warrantyExpiry', 10),
        status: ['working', 'attention', 'down', 'retired'].includes(String(body.status)) ? String(body.status) : 'working',
        notes: str('notes', 400),
      };
      if (body.id) {
        await db.asset.update({ where: { id: String(body.id) }, data });
        return NextResponse.json({ ok: true });
      }
      const asset = await db.asset.create({ data });
      return NextResponse.json({ ok: true, asset });
    }

    if (action === 'ticket_create') {
      const title = String(body.title ?? '').trim();
      if (!title) return NextResponse.json({ error: 'What needs fixing?' }, { status: 400 });
      const ticket = await db.maintenanceTicket.create({
        data: {
          ticketNo: await nextDocNo('MT'),
          title: title.slice(0, 150),
          details: str('details', 500),
          location: str('location', 80),
          assetId: body.assetId ? String(body.assetId) : null,
          category: String(body.category ?? 'general').slice(0, 30),
          priority: ['low', 'normal', 'high', 'urgent'].includes(String(body.priority)) ? String(body.priority) : 'normal',
          reportedBy: session.username,
          assignedTo: str('assignedTo', 80),
        },
      });
      await logAudit(session, 'maintenance.ticket_create', {
        entity: 'MaintenanceTicket', entityId: ticket.id,
        summary: `${ticket.ticketNo}: ${title}${ticket.location ? ` @ ${ticket.location}` : ''}`,
      });
      return NextResponse.json({ ok: true, ticket });
    }

    if (action === 'ticket_update') {
      const ticket = await db.maintenanceTicket.findUnique({ where: { id: String(body.ticketId ?? '') } });
      if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      const status = body.status !== undefined ? String(body.status) : ticket.status;
      if (!['open', 'in_progress', 'on_hold', 'resolved', 'closed'].includes(status)) {
        return NextResponse.json({ error: 'Bad status' }, { status: 400 });
      }
      await db.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          status,
          assignedTo: body.assignedTo !== undefined ? str('assignedTo', 80) : ticket.assignedTo,
          cost: body.cost !== undefined ? Math.max(0, Number(body.cost) || 0) : ticket.cost,
          details: body.details !== undefined ? str('details', 500) : ticket.details,
          resolvedAt: ['resolved', 'closed'].includes(status) && !ticket.resolvedAt ? new Date() : ticket.resolvedAt,
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('maintenance action failed', action, error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
