import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siteOrigin } from '@/lib/payments';
import { parseIciciResponse } from '@/lib/payments/icici';
import { failPayment, settlePayment } from '@/lib/payments/settle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Return URL for the ICICI Eazypay hosted page.
 *
 * Eazypay may hand control back with either a GET query string or a form POST,
 * so both verbs are handled. The guest is then redirected to a friendly status
 * page rather than being left on a bare JSON response.
 */
async function handle(request: NextRequest, params: Record<string, string>) {
  const origin = siteOrigin(request);
  const response = parseIciciResponse(params);

  const statusUrl = (state: string, ref?: string) => {
    const url = new URL('/booking/status', origin);
    url.searchParams.set('state', state);
    if (ref) url.searchParams.set('ref', ref);
    return url.toString();
  };

  if (!response.referenceNo) {
    return NextResponse.redirect(statusUrl('unknown'), { status: 303 });
  }

  const payment = await db.payment.findFirst({
    where: { referenceNo: response.referenceNo, gateway: 'icici' },
    orderBy: { createdAt: 'desc' },
    include: { booking: true, order: true },
  });

  if (!payment) {
    console.warn('ICICI callback for unknown reference:', response.referenceNo);
    return NextResponse.redirect(statusUrl('unknown'), { status: 303 });
  }

  const reference = payment.booking?.bookingRef ?? payment.order?.orderRef ?? '';

  if (!response.succeeded) {
    await failPayment(payment.id, `ICICI response code ${response.responseCode || 'unknown'}`, params);
    return NextResponse.redirect(statusUrl('failed', reference), { status: 303 });
  }

  // Guard against a tampered return URL reporting a smaller amount as success.
  if (response.totalAmount > 0 && Math.abs(response.totalAmount - payment.amount) > 0.5) {
    await failPayment(payment.id, `Amount mismatch: expected ${payment.amount}, gateway reported ${response.totalAmount}`, params);
    return NextResponse.redirect(statusUrl('mismatch', reference), { status: 303 });
  }

  await settlePayment(payment.id, {
    gatewayPaymentId: response.uniqueRefNumber,
    method: response.paymentMode || 'icici',
    rawPayload: params,
  });

  return NextResponse.redirect(statusUrl('paid', reference), { status: 303 });
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return handle(request, params);
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  let params: Record<string, string> = {};

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    params = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  } else {
    params = Object.fromEntries(new URL(request.url).searchParams.entries());
  }
  return handle(request, params);
}
