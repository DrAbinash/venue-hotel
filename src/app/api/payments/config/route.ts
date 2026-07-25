import { NextResponse } from 'next/server';
import { loadPaymentConfig } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/config
 *
 * Everything the checkout UI needs to render payment options — enabled
 * gateways, currency and the publishable Razorpay key. Secrets are resolved
 * only inside the server-side payment routes and never appear here.
 */
export async function GET() {
  try {
    const { config } = await loadPaymentConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Payment config error:', error);
    return NextResponse.json({ error: 'Could not load payment configuration' }, { status: 500 });
  }
}
