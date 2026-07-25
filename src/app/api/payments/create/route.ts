import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings, settingBool, settingNumber } from '@/lib/settings';
import { iciciConfig, razorpayCredentials, resolvePaymentConfig, siteOrigin, type GatewayId } from '@/lib/payments';
import { createRazorpayOrder } from '@/lib/payments/razorpay';
import { buildIciciRedirectUrl, buildReferenceNo } from '@/lib/payments/icici';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** What is being paid for: a room reservation or a restaurant order. */
interface Payable {
  kind: 'booking' | 'order';
  id: string;
  reference: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description: string;
  cancelled: boolean;
}

async function loadPayable(body: {
  bookingRef?: string;
  orderRef?: string;
}): Promise<Payable | null> {
  const bookingRef = String(body.bookingRef || '').trim().toUpperCase();
  if (bookingRef) {
    const booking = await db.booking.findUnique({ where: { bookingRef } });
    if (!booking) return null;
    return {
      kind: 'booking',
      id: booking.id,
      reference: booking.bookingRef,
      currency: booking.currency,
      totalAmount: booking.totalAmount,
      amountPaid: booking.amountPaid,
      customerName: booking.guestName,
      customerEmail: booking.guestEmail,
      customerPhone: booking.guestPhone,
      description: `${booking.roomType} · ${booking.nights} night(s) · ${booking.bookingRef}`,
      cancelled: booking.status === 'cancelled',
    };
  }

  const orderRef = String(body.orderRef || '').trim().toUpperCase();
  if (orderRef) {
    const order = await db.foodOrder.findUnique({ where: { orderRef }, include: { items: true } });
    if (!order) return null;
    return {
      kind: 'order',
      id: order.id,
      reference: order.orderRef,
      currency: order.currency,
      totalAmount: order.totalAmount,
      amountPaid: order.amountPaid,
      customerName: order.customerName,
      customerEmail: order.customerEmail || '',
      customerPhone: order.customerPhone,
      description: `${order.items.length} item(s) · ${order.orderRef}`,
      cancelled: order.status === 'cancelled',
    };
  }

  return null;
}

/**
 * POST /api/payments/create
 * body: { bookingRef | orderRef, gateway, amountType?: 'full' | 'advance' }
 *
 * Starts a payment attempt. The amount is derived from the stored record,
 * never from the request, so a tampered client cannot pay one rupee for a
 * suite — or for dinner.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const gateway = String(body.gateway || '') as GatewayId;

    const payable = await loadPayable(body);
    if (!payable) return NextResponse.json({ error: 'Nothing found for that reference.' }, { status: 404 });
    if (payable.cancelled) return NextResponse.json({ error: 'This has been cancelled.' }, { status: 409 });

    const outstanding = round2(Math.max(0, payable.totalAmount - payable.amountPaid));
    if (outstanding <= 0) return NextResponse.json({ error: 'Nothing left to pay.' }, { status: 409 });

    const settings = await getSettings();
    const config = resolvePaymentConfig(settings);
    const method = config.methods.find((m) => m.id === gateway);
    if (!method) return NextResponse.json({ error: 'That payment method is not available.' }, { status: 400 });

    // Advance payment applies to stays only — a meal is settled in full.
    const wantsAdvance = body.amountType === 'advance' && config.allowPartialPayment && payable.kind === 'booking';
    const advance = round2((payable.totalAmount * settingNumber(settings, 'advancePercent', 25)) / 100);
    const amount = wantsAdvance ? Math.min(Math.max(advance, 1), outstanding) : outstanding;

    const link = payable.kind === 'booking' ? { bookingId: payable.id } : { orderId: payable.id };

    // ---- Offline methods: record the intent, settle in person. ----
    if (!method.online) {
      const payment = await db.payment.create({
        data: {
          ...link,
          gateway: 'manual',
          mode: config.mode,
          amount,
          currency: payable.currency,
          status: 'pending',
          method: gateway,
        },
      });

      const autoConfirm = settingBool(settings, 'autoConfirmOnPayment') && gateway === 'payAtHotel';
      if (payable.kind === 'booking') {
        await db.booking.update({
          where: { id: payable.id },
          data: { paymentMethod: gateway, ...(autoConfirm ? { status: 'confirmed' } : {}) },
        });
      } else {
        await db.foodOrder.update({
          where: { id: payable.id },
          data: { paymentMethod: gateway, ...(autoConfirm ? { status: 'accepted' } : {}) },
        });
      }

      return NextResponse.json({
        gateway,
        online: false,
        paymentId: payment.id,
        amount,
        currency: payable.currency,
        instructions: gateway === 'bankTransfer' ? config.bank : { note: config.payAtHotelNote },
      });
    }

    const origin = siteOrigin(request);

    // ---- Razorpay: create an order, hand the id to Checkout. ----
    if (gateway === 'razorpay') {
      const credentials = razorpayCredentials(settings);
      const order = await createRazorpayOrder(credentials, {
        amount,
        currency: payable.currency,
        receipt: payable.reference,
        notes: { reference: payable.reference, customer: payable.customerName },
      });

      await db.payment.create({
        data: {
          ...link,
          gateway: 'razorpay',
          mode: config.mode,
          gatewayOrderId: order.id,
          amount,
          currency: payable.currency,
          status: 'created',
        },
      });

      return NextResponse.json({
        gateway: 'razorpay',
        online: true,
        keyId: credentials.keyId,
        orderId: order.id,
        amount,
        amountMinor: order.amount,
        currency: payable.currency,
        themeColor: config.razorpayThemeColor,
        name: settings.hotelName || 'Hotel',
        description: payable.description,
        prefill: {
          name: payable.customerName,
          email: payable.customerEmail,
          contact: payable.customerPhone,
        },
      });
    }

    // ---- ICICI Eazypay: redirect to the bank-hosted page. ----
    if (gateway === 'icici') {
      const icici = iciciConfig(settings);
      const attempts = await db.payment.count({ where: { ...link, gateway: 'icici' } });
      const referenceNo = buildReferenceNo(icici.referencePrefix, payable.reference, attempts + 1);

      const payment = await db.payment.create({
        data: {
          ...link,
          gateway: 'icici',
          mode: config.mode,
          referenceNo,
          amount,
          currency: payable.currency,
          status: 'pending',
        },
      });

      const redirectUrl = buildIciciRedirectUrl(icici, {
        referenceNo,
        amount,
        guestName: payable.customerName,
        guestEmail: payable.customerEmail || 'guest@example.com',
        guestPhone: payable.customerPhone,
        returnUrl: `${origin}/api/payments/icici/callback`,
      });

      return NextResponse.json({
        gateway: 'icici',
        online: true,
        redirectUrl,
        referenceNo,
        paymentId: payment.id,
        amount,
        currency: payable.currency,
      });
    }

    return NextResponse.json({ error: 'Unsupported payment method.' }, { status: 400 });
  } catch (error) {
    console.error('Payment initiation failed:', error);
    const message = error instanceof Error ? error.message : 'Could not start the payment.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
