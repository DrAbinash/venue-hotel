import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { settlePayment } from '@/lib/payments/settle';

export const dynamic = 'force-dynamic';

/** GET /api/payments — the transaction ledger for the admin panel. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const gateway = searchParams.get('gateway');

  const payments = await db.payment.findMany({
    where: {
      ...(status && status !== 'all' ? { status } : {}),
      ...(gateway && gateway !== 'all' ? { gateway } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      booking: { select: { bookingRef: true, guestName: true, guestEmail: true, totalAmount: true } },
      order: { select: { orderRef: true, customerName: true, totalAmount: true } },
    },
  });
  return NextResponse.json(payments);
}

/**
 * POST /api/payments — record money taken outside the gateways
 * (cash at the desk, a bank transfer that has cleared, a card machine).
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const bookingId = body.bookingId ? String(body.bookingId) : null;
    const orderId = body.orderId ? String(body.orderId) : null;
    const amount = Number.parseFloat(body.amount);

    if (!bookingId && !orderId) {
      return NextResponse.json({ error: 'A booking or an order is required.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a positive amount.' }, { status: 400 });
    }

    const currency = bookingId
      ? (await db.booking.findUnique({ where: { id: bookingId } }))?.currency
      : (await db.foodOrder.findUnique({ where: { id: orderId! } }))?.currency;
    if (!currency) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });

    const payment = await db.payment.create({
      data: {
        bookingId,
        orderId,
        gateway: 'manual',
        amount,
        currency,
        status: 'created',
        method: String(body.method || 'cash'),
        rawPayload: body.note ? JSON.stringify({ note: String(body.note).slice(0, 500) }) : null,
      },
    });

    await settlePayment(payment.id, { method: String(body.method || 'cash') });

    const updated = bookingId
      ? await db.booking.findUnique({
          where: { id: bookingId },
          include: { payments: { orderBy: { createdAt: 'desc' } }, room: true },
        })
      : await db.foodOrder.findUnique({
          where: { id: orderId! },
          include: { payments: { orderBy: { createdAt: 'desc' } }, items: true },
        });
    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PUT — mark a payment refunded, failed or cancelled. */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const id = String(body.id || '');
    const status = String(body.status || '');
    if (!id || !['refunded', 'failed', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Provide an id and a status of refunded, failed or cancelled.' }, { status: 400 });
    }

    const payment = await db.payment.findUnique({ where: { id }, include: { booking: true, order: true } });
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });

    // Reverse a previously applied payment so the balance stays honest.
    if (payment.status === 'paid') {
      const paymentStatusFor = (amountPaid: number) =>
        amountPaid <= 0 ? (status === 'refunded' ? 'refunded' : 'unpaid') : 'partial';

      if (payment.booking) {
        const amountPaid = Math.max(0, payment.booking.amountPaid - payment.amount);
        await db.booking.update({
          where: { id: payment.booking.id },
          data: { amountPaid, paymentStatus: paymentStatusFor(amountPaid) },
        });
      } else if (payment.order) {
        const amountPaid = Math.max(0, payment.order.amountPaid - payment.amount);
        await db.foodOrder.update({
          where: { id: payment.order.id },
          data: { amountPaid, paymentStatus: paymentStatusFor(amountPaid) },
        });
      }
    }

    const updated = await db.payment.update({
      where: { id },
      data: { status, errorMessage: body.note ? String(body.note).slice(0, 500) : payment.errorMessage },
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
