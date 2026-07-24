import { db } from '@/lib/db';
import { getSettings, settingBool } from '@/lib/settings';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Apply a successful payment to whatever it was for — a room reservation or a
 * restaurant order.
 *
 * Idempotent by design: the webhook, the browser hand-back and a manual admin
 * entry can all report the same payment, and the balance must only move once.
 * A payment row already marked `paid` is a no-op.
 */
export async function settlePayment(paymentId: string, details: {
  gatewayPaymentId?: string;
  signature?: string;
  method?: string;
  rawPayload?: unknown;
}): Promise<{ applied: boolean; reference: string }> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true, order: true },
  });
  if (!payment) throw new Error('Payment not found');

  const reference = payment.booking?.bookingRef ?? payment.order?.orderRef ?? '';
  if (payment.status === 'paid') return { applied: false, reference };

  const settings = await getSettings();
  const autoConfirm = settingBool(settings, 'autoConfirmOnPayment');

  const markPaid = db.payment.update({
    where: { id: payment.id },
    data: {
      status: 'paid',
      paymentId: details.gatewayPaymentId ?? payment.paymentId,
      signature: details.signature ?? payment.signature,
      method: details.method ?? payment.method,
      rawPayload: details.rawPayload ? JSON.stringify(details.rawPayload).slice(0, 8000) : payment.rawPayload,
    },
  });

  if (payment.booking) {
    const booking = payment.booking;
    const amountPaid = round2(booking.amountPaid + payment.amount);
    const fullyPaid = amountPaid + 0.01 >= booking.totalAmount;

    await db.$transaction([
      markPaid,
      db.booking.update({
        where: { id: booking.id },
        data: {
          amountPaid,
          paymentStatus: fullyPaid ? 'paid' : 'partial',
          paymentMethod: payment.gateway,
          status: autoConfirm && booking.status === 'pending' ? 'confirmed' : booking.status,
        },
      }),
    ]);
    return { applied: true, reference: booking.bookingRef };
  }

  if (payment.order) {
    const order = payment.order;
    const amountPaid = round2(order.amountPaid + payment.amount);
    const fullyPaid = amountPaid + 0.01 >= order.totalAmount;

    await db.$transaction([
      markPaid,
      db.foodOrder.update({
        where: { id: order.id },
        data: {
          amountPaid,
          paymentStatus: fullyPaid ? 'paid' : 'partial',
          paymentMethod: payment.gateway,
          status: autoConfirm && order.status === 'placed' ? 'accepted' : order.status,
        },
      }),
    ]);
    return { applied: true, reference: order.orderRef };
  }

  // An orphaned payment still gets marked paid so it shows in the ledger.
  await markPaid;
  return { applied: true, reference };
}

/** Record a failed or abandoned attempt without touching any balance. */
export async function failPayment(paymentId: string, message: string, rawPayload?: unknown): Promise<void> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === 'paid') return;

  await db.payment.update({
    where: { id: paymentId },
    data: {
      status: 'failed',
      errorMessage: message.slice(0, 500),
      rawPayload: rawPayload ? JSON.stringify(rawPayload).slice(0, 8000) : payment.rawPayload,
    },
  });
}
