import { createHmac, timingSafeEqual } from 'crypto';
import { toMinorUnits } from '@/lib/pricing';

/**
 * Razorpay integration over the plain REST API — no SDK, so there is nothing
 * extra to install and the standalone Docker image stays small.
 *
 * Flow: create an order server-side → open Checkout in the browser with the
 * order id → verify the returned signature server-side → mark the booking paid.
 * The webhook is the safety net for guests who close the tab mid-payment.
 */

const API_BASE = 'https://api.razorpay.com/v1';

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

function authHeader({ keyId, keySecret }: RazorpayCredentials): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export async function createRazorpayOrder(
  credentials: RazorpayCredentials,
  params: { amount: number; currency: string; receipt: string; notes?: Record<string, string> },
): Promise<RazorpayOrder> {
  const response = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(credentials),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: toMinorUnits(params.amount),
      currency: params.currency,
      receipt: params.receipt.slice(0, 40),
      notes: params.notes ?? {},
      payment_capture: 1,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { error?: { description?: string } })?.error?.description ??
      `Razorpay order creation failed (HTTP ${response.status})`;
    throw new Error(message);
  }
  return payload as RazorpayOrder;
}

export async function fetchRazorpayPayment(
  credentials: RazorpayCredentials,
  paymentId: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authHeader(credentials) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Could not fetch Razorpay payment ${paymentId}`);
  return payload as Record<string, unknown>;
}

function hmacHex(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Checkout hand-back: signature = HMAC_SHA256(order_id + "|" + payment_id). */
export function verifyPaymentSignature(
  keySecret: string,
  params: { orderId: string; paymentId: string; signature: string },
): boolean {
  if (!keySecret || !params.orderId || !params.paymentId || !params.signature) return false;
  return constantTimeEqual(hmacHex(keySecret, `${params.orderId}|${params.paymentId}`), params.signature);
}

/** Webhook: signature = HMAC_SHA256(raw request body) using the webhook secret. */
export function verifyWebhookSignature(webhookSecret: string, rawBody: string, signature: string): boolean {
  if (!webhookSecret || !signature) return false;
  return constantTimeEqual(hmacHex(webhookSecret, rawBody), signature);
}
