import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { getErpSettings, erpNumber } from '@/lib/erp/settings';
import { ensureFolioForBooking, postCharge } from '@/lib/erp/folio';
import { round2 } from '@/lib/erp/gst';
import type { Booking } from '@prisma/client';

export const dynamic = 'force-dynamic';

const OPEN_STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'served'];
const FLOW: Record<string, string[]> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'completed'],
  served: ['completed'],
};

/** GET — service board: live orders, tables, and in-house guests for room posting. */
export async function GET() {
  const auth = await erpGuard('pos');
  if (auth.denied) return auth.denied;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [orders, inHouse, settings] = await Promise.all([
    db.foodOrder.findMany({
      where: {
        OR: [
          { status: { in: OPEN_STATUSES } },
          { status: 'completed', paymentStatus: { in: ['unpaid', 'partial'] } },
          { createdAt: { gte: dayAgo }, status: { not: 'cancelled' } },
        ],
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.booking.findMany({
      where: { status: 'checked_in' },
      select: {
        id: true, bookingRef: true, guestName: true,
        unit: { select: { unitNumber: true } },
      },
    }),
    getErpSettings(),
  ]);

  return NextResponse.json({
    orders,
    inHouse: inHouse.map((b) => ({
      id: b.id, bookingRef: b.bookingRef, guestName: b.guestName,
      unitNumber: b.unit?.unitNumber ?? null,
    })),
    tableCount: erpNumber(settings, 'erpPosTableCount', 12),
  });
}

/**
 * POST — { action: "update_status" | "record_payment" | "post_to_room", ... }
 * (Order creation goes through the same /api/orders engine the website uses,
 * so pricing, sizes and add-ons stay server-authoritative in one place.)
 */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('pos');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  const order = await db.foodOrder.findUnique({
    where: { id: String(body.orderId ?? '') },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  try {
    if (action === 'update_status') {
      const next = String(body.status ?? '');
      const allowed = FLOW[order.status] ?? [];
      if (!allowed.includes(next)) {
        return NextResponse.json({ error: `Cannot move a ${order.status} order to ${next}` }, { status: 400 });
      }
      await db.foodOrder.update({ where: { id: order.id }, data: { status: next } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'record_payment') {
      const amount = round2(Number(body.amount) || Math.max(0, order.totalAmount - order.amountPaid));
      if (amount <= 0) return NextResponse.json({ error: 'Nothing left to collect on this order' }, { status: 400 });
      const mode = String(body.mode ?? 'cash');
      await db.payment.create({
        data: {
          orderId: order.id,
          gateway: 'erp',
          mode: 'live',
          referenceNo: body.reference ? String(body.reference).slice(0, 80) : null,
          amount,
          status: 'paid',
          method: mode,
          rawPayload: JSON.stringify({ by: session.username }),
        },
      });
      const paid = round2(order.amountPaid + amount);
      await db.foodOrder.update({
        where: { id: order.id },
        data: {
          amountPaid: paid,
          paymentStatus: paid + 0.01 >= order.totalAmount ? 'paid' : 'partial',
          paymentMethod: mode,
        },
      });
      await logAudit(session, 'pos.payment', {
        entity: 'FoodOrder', entityId: order.id,
        summary: `${order.orderRef}: collected ₹${amount.toFixed(2)} by ${mode}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'post_to_room') {
      if (order.paymentStatus === 'paid') {
        return NextResponse.json({ error: 'Order is already settled' }, { status: 400 });
      }
      // Find the in-house stay: explicit booking id, else the order's booking
      // ref, else match the room number to an occupied unit.
      let booking: Booking | null = null;
      if (body.bookingId) {
        booking = await db.booking.findUnique({ where: { id: String(body.bookingId) } });
      } else if (order.bookingRef) {
        booking = await db.booking.findUnique({ where: { bookingRef: order.bookingRef } });
      } else if (order.roomNumber) {
        const unit = await db.roomUnit.findUnique({ where: { unitNumber: order.roomNumber } });
        if (unit) {
          booking = await db.booking.findFirst({ where: { unitId: unit.id, status: 'checked_in' } });
        }
      }
      if (!booking || booking.status !== 'checked_in') {
        return NextResponse.json({ error: 'No in-house guest matches this order — pick the stay to bill' }, { status: 409 });
      }

      const folio = await ensureFolioForBooking(booking, session.username);
      const alreadyPosted = await db.folioLine.findFirst({
        where: { folioId: folio.id, reference: `order:${order.id}`, isVoid: false },
      });
      if (alreadyPosted) return NextResponse.json({ error: 'This order is already on the folio' }, { status: 409 });

      const settings = await getErpSettings();
      const outstanding = round2(order.totalAmount - order.amountPaid);
      // The order total already includes website tax; the folio line re-taxes
      // at the configured F&B GST rate, so post the pre-tax value.
      const preTax = order.totalAmount > 0
        ? round2(outstanding * ((order.totalAmount - order.taxAmount) / order.totalAmount))
        : 0;
      await postCharge(folio.id, {
        type: 'fnb',
        description: `Restaurant — ${order.orderRef} (${order.items.length} item${order.items.length === 1 ? '' : 's'})`,
        qty: 1,
        unitAmount: preTax,
        reference: `order:${order.id}`,
      }, settings, session.username);

      await db.foodOrder.update({
        where: { id: order.id },
        data: {
          amountPaid: order.totalAmount,
          paymentStatus: 'paid',
          paymentMethod: 'room_folio',
          bookingRef: booking.bookingRef,
          roomNumber: order.roomNumber,
        },
      });
      await logAudit(session, 'pos.post_to_room', {
        entity: 'FoodOrder', entityId: order.id,
        summary: `${order.orderRef} (₹${outstanding.toFixed(2)}) posted to ${booking.bookingRef} — ${booking.guestName}`,
      });
      return NextResponse.json({ ok: true, folioId: folio.id });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('pos action failed', action, error);
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
