import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getSettings, settingNumber } from '@/lib/settings';
import { computePrice, nightsBetween } from '@/lib/pricing';
import { getAvailability, toDateOnly, validateStayDates } from '@/lib/availability';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function generateRef(): string {
  // Ambiguous characters removed so refs can be read out over the phone.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let ref = '';
  for (let i = 0; i < 8; i += 1) ref += alphabet[bytes[i] % alphabet.length];
  return `${ref.slice(0, 4)}-${ref.slice(4)}`;
}

async function uniqueRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ref = generateRef();
    const clash = await db.booking.findUnique({ where: { bookingRef: ref } });
    if (!clash) return ref;
  }
  return `${generateRef()}-${Date.now().toString(36).toUpperCase().slice(-3)}`;
}

/**
 * GET /api/bookings — admin only.
 *
 * Reservations carry guest names, emails and phone numbers, so this list is
 * never public. Guests look up their own booking via /api/bookings/lookup.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('q')?.trim();

    const bookings = await db.booking.findMany({
      where: {
        ...(status && status !== 'all' ? { status } : {}),
        ...(search
          ? {
              OR: [
                { bookingRef: { contains: search } },
                { guestName: { contains: search } },
                { guestEmail: { contains: search } },
                { guestPhone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { room: { include: { floor: true } }, payments: { orderBy: { createdAt: 'desc' } } },
    });
    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Bookings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

/**
 * POST /api/bookings — create a reservation.
 *
 * The client's price is ignored entirely: the room rate, taxes and fees are
 * re-read from the database and recomputed here, and availability is checked
 * before anything is written.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = await getSettings();

    const guestName = String(body.guestName ?? '').trim();
    const guestEmail = String(body.guestEmail ?? '').trim().toLowerCase();
    const guestPhone = String(body.guestPhone ?? '').trim();

    if (guestName.length < 2) return NextResponse.json({ error: 'Please enter the guest name.' }, { status: 400 });
    if (!EMAIL_RE.test(guestEmail)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    if (guestPhone.replace(/\D/g, '').length < 7) return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });

    const dateError = validateStayDates(body.checkIn, body.checkOut, {
      minNights: settingNumber(settings, 'minNights', 1),
      maxNights: settingNumber(settings, 'maxNights', 30),
      maxAdvanceDays: settingNumber(settings, 'maxAdvanceDays', 365),
    });
    if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });

    if (!body.roomId) return NextResponse.json({ error: 'Please choose a room.' }, { status: 400 });
    const room = await db.room.findUnique({ where: { id: String(body.roomId) } });
    if (!room || !room.isActive) return NextResponse.json({ error: 'That room is no longer available.' }, { status: 404 });

    const adults = Math.max(1, Math.min(Number.parseInt(body.adults, 10) || 1, settingNumber(settings, 'maxAdults', 6)));
    const children = Math.max(0, Math.min(Number.parseInt(body.children, 10) || 0, settingNumber(settings, 'maxChildren', 4)));

    const availability = await getAvailability(body.checkIn, body.checkOut, { roomIds: [room.id] });
    if (!availability.get(room.id)?.isAvailable) {
      return NextResponse.json(
        { error: 'Those dates were just taken for this room. Please pick different dates or another room.' },
        { status: 409 },
      );
    }

    const nights = nightsBetween(body.checkIn, body.checkOut);
    const price = computePrice({
      basePrice: room.basePrice,
      nights,
      adults,
      children,
      maxGuests: room.maxGuests,
      extraGuestFee: room.extraGuestFee,
      taxPercent: settingNumber(settings, 'taxPercent', 0),
      serviceFeePercent: settingNumber(settings, 'serviceFeePercent', 0),
    });

    const booking = await db.booking.create({
      data: {
        bookingRef: await uniqueRef(),
        roomId: room.id,
        guestName,
        guestEmail,
        guestPhone,
        guestCountry: body.guestCountry ? String(body.guestCountry) : null,
        checkIn: toDateOnly(body.checkIn),
        checkOut: toDateOnly(body.checkOut),
        nights: price.nights,
        adults,
        children,
        roomType: room.type,
        currency: settings.currency || 'INR',
        roomTotal: price.roomTotal,
        extraGuestTotal: price.extraGuestTotal,
        feeAmount: price.feeAmount,
        taxAmount: price.taxAmount,
        discountAmount: price.discountAmount,
        totalAmount: price.totalAmount,
        status: 'pending',
        paymentStatus: 'unpaid',
        source: 'website',
        specialRequests: body.specialRequests ? String(body.specialRequests).slice(0, 2000) : null,
      },
      include: { room: true },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Booking creation failed:', error);
    const message = error instanceof Error ? error.message : 'Could not create the booking.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PUT — admin edits (status changes, notes, manual payment records). */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { id, room, payments, ...data } = body as Record<string, unknown> & { id: string };
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await db.booking.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    if (data.checkIn) data.checkIn = toDateOnly(String(data.checkIn));
    if (data.checkOut) data.checkOut = toDateOnly(String(data.checkOut));

    // Moving a booking must not double-book the room.
    const nextRoomId = (data.roomId as string) ?? existing.roomId;
    const movingDates = Boolean(data.checkIn || data.checkOut || data.roomId);
    if (movingDates && nextRoomId) {
      const checkIn = (data.checkIn as Date) ?? existing.checkIn;
      const checkOut = (data.checkOut as Date) ?? existing.checkOut;
      const availability = await getAvailability(checkIn, checkOut, {
        roomIds: [nextRoomId],
        excludeBookingId: id,
      });
      if (!availability.get(nextRoomId)?.isAvailable) {
        return NextResponse.json({ error: 'That room is already booked for those dates.' }, { status: 409 });
      }
    }

    if (data.status === 'cancelled' && existing.status !== 'cancelled') {
      data.cancelledAt = new Date();
    }

    const booking = await db.booking.update({
      where: { id },
      data,
      include: { room: true, payments: { orderBy: { createdAt: 'desc' } } },
    });
    return NextResponse.json(booking);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE — admin only. Cancelling is usually preferable to deleting. */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.booking.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
