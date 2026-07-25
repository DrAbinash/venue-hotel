import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/lookup?ref=F1A2B3&phone=9876543210
 *
 * Order tracking for the guest: matched on reference plus the last digits of
 * the phone number used to place it.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ref = (searchParams.get('ref') || '').trim().toUpperCase();
    const phone = (searchParams.get('phone') || '').replace(/\D/g, '');

    if (!ref || phone.length < 4) {
      return NextResponse.json({ error: 'Order reference and phone number are required.' }, { status: 400 });
    }

    const order = await db.foodOrder.findUnique({ where: { orderRef: ref }, include: { items: true } });
    const storedDigits = (order?.customerPhone ?? '').replace(/\D/g, '');

    if (!order || !storedDigits.endsWith(phone.slice(-4))) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return NextResponse.json({ error: 'No order matches those details.' }, { status: 404 });
    }

    return NextResponse.json({
      orderRef: order.orderRef,
      orderType: order.orderType,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotal: order.subtotal,
      packagingFee: order.packagingFee,
      deliveryFee: order.deliveryFee,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      amountPaid: order.amountPaid,
      tableNumber: order.tableNumber,
      roomNumber: order.roomNumber,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        name: item.name,
        size: item.size,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
    });
  } catch (error) {
    console.error('Order lookup failed:', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
