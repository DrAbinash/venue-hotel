import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bookings/lookup?ref=XXXX-XXXX&email=guest@example.com
 *
 * Lets a guest retrieve their own reservation. Both the reference and the
 * email must match, and only the fields a guest needs are returned — internal
 * notes and payment payloads stay in the admin panel.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ref = (searchParams.get('ref') || '').trim().toUpperCase();
    const email = (searchParams.get('email') || '').trim().toLowerCase();

    if (!ref || !email) {
      return NextResponse.json({ error: 'Booking reference and email are both required.' }, { status: 400 });
    }

    const booking = await db.booking.findUnique({
      where: { bookingRef: ref },
      include: { room: true, payments: { orderBy: { createdAt: 'desc' } } },
    });

    if (!booking || booking.guestEmail.toLowerCase() !== email) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return NextResponse.json({ error: 'No booking matches that reference and email.' }, { status: 404 });
    }

    return NextResponse.json({
      bookingRef: booking.bookingRef,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      adults: booking.adults,
      children: booking.children,
      roomType: booking.roomType,
      roomName: booking.room?.name ?? booking.roomType,
      currency: booking.currency,
      roomTotal: booking.roomTotal,
      feeAmount: booking.feeAmount,
      taxAmount: booking.taxAmount,
      totalAmount: booking.totalAmount,
      amountPaid: booking.amountPaid,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      specialRequests: booking.specialRequests,
      createdAt: booking.createdAt,
      payments: booking.payments.map((payment) => ({
        gateway: payment.gateway,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
      })),
    });
  } catch (error) {
    console.error('Booking lookup failed:', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
