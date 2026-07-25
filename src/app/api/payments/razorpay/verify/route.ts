import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { razorpayCredentials } from '@/lib/payments';
import { verifyPaymentSignature } from '@/lib/payments/razorpay';
import { failPayment, settlePayment } from '@/lib/payments/settle';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/razorpay/verify
 * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Called by the browser the moment Checkout succeeds. The signature is an
 * HMAC of the order and payment ids keyed with the account secret, so a
 * forged success callback cannot mark a booking paid.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orderId = String(body.razorpay_order_id || '');
    const gatewayPaymentId = String(body.razorpay_payment_id || '');
    const signature = String(body.razorpay_signature || '');

    if (!orderId || !gatewayPaymentId || !signature) {
      return NextResponse.json({ error: 'Incomplete payment response.' }, { status: 400 });
    }

    const payment = await db.payment.findFirst({
      where: { gatewayOrderId: orderId, gateway: 'razorpay' },
      orderBy: { createdAt: 'desc' },

    });
    if (!payment) return NextResponse.json({ error: 'Unknown payment order.' }, { status: 404 });

    const settings = await getSettings();
    const { keySecret } = razorpayCredentials(settings);
    const valid = verifyPaymentSignature(keySecret, { orderId, paymentId: gatewayPaymentId, signature });

    if (!valid) {
      await failPayment(payment.id, 'Signature verification failed', body);
      return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 });
    }

    const result = await settlePayment(payment.id, {
      gatewayPaymentId,
      signature,
      method: 'razorpay',
      rawPayload: body,
    });

    // Report the updated state of whichever record this paid for.
    const record = payment.bookingId
      ? await db.booking.findUnique({ where: { id: payment.bookingId } })
      : payment.orderId
        ? await db.foodOrder.findUnique({ where: { id: payment.orderId } })
        : null;

    return NextResponse.json({
      success: true,
      alreadyApplied: !result.applied,
      reference: result.reference,
      bookingRef: result.reference,
      status: record?.status,
      paymentStatus: record?.paymentStatus,
      amountPaid: record?.amountPaid,
    });
  } catch (error) {
    console.error('Razorpay verification failed:', error);
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 });
  }
}
