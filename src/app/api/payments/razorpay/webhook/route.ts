import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { verifyWebhookSignature } from '@/lib/payments/razorpay';
import { failPayment, settlePayment } from '@/lib/payments/settle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/razorpay/webhook
 *
 * The safety net: if a guest closes the tab before the browser can call
 * /verify, Razorpay still tells us here that the money arrived. Point the
 * dashboard webhook at this URL with events `payment.captured` and
 * `payment.failed`, using the secret from Admin → Payments.
 */
export async function POST(request: NextRequest) {
  try {
    // The signature covers the exact bytes sent, so the body must be read raw.
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    const settings = await getSettings();
    const webhookSecret = settings.razorpayWebhookSecret || '';
    if (!webhookSecret) {
      console.warn('Razorpay webhook received but no webhook secret is configured.');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }
    if (!verifyWebhookSignature(webhookSecret, rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; method?: string; error_description?: string } } };
    };
    const entity = event.payload?.payment?.entity;
    const orderId = entity?.order_id;
    if (!orderId) return NextResponse.json({ received: true, ignored: 'no order id' });

    const payment = await db.payment.findFirst({
      where: { gatewayOrderId: orderId, gateway: 'razorpay' },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) return NextResponse.json({ received: true, ignored: 'unknown order' });

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      await settlePayment(payment.id, {
        gatewayPaymentId: entity?.id,
        method: entity?.method ?? 'razorpay',
        rawPayload: event,
      });
    } else if (event.event === 'payment.failed') {
      await failPayment(payment.id, entity?.error_description || 'Payment failed at gateway', event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
