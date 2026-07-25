import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings, settingNumber } from '@/lib/settings';
import { computePrice, nightsBetween } from '@/lib/pricing';
import { getAvailability, validateStayDates } from '@/lib/availability';

export const dynamic = 'force-dynamic';

/**
 * GET /api/availability?checkIn=&checkOut=&adults=&children=
 *
 * Returns every active room with its remaining inventory and a full price
 * quote for the requested stay — the same numbers the booking endpoint will
 * charge, so the guest never sees a price that changes at the last step.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get('checkIn') || '';
    const checkOut = searchParams.get('checkOut') || '';
    const adults = Math.max(1, Number.parseInt(searchParams.get('adults') || '1', 10) || 1);
    const children = Math.max(0, Number.parseInt(searchParams.get('children') || '0', 10) || 0);

    const settings = await getSettings();
    const rooms = await db.room.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { floor: true },
    });

    if (!checkIn || !checkOut) {
      // No dates yet: still return the rooms so the page can render rates.
      return NextResponse.json({
        checkIn,
        checkOut,
        nights: 0,
        datesValid: false,
        rooms: rooms.map((room) => ({ ...room, available: room.quantity, isAvailable: true, quote: null })),
      });
    }

    const dateError = validateStayDates(checkIn, checkOut, {
      minNights: settingNumber(settings, 'minNights', 1),
      maxNights: settingNumber(settings, 'maxNights', 30),
      maxAdvanceDays: settingNumber(settings, 'maxAdvanceDays', 365),
    });
    if (dateError) {
      return NextResponse.json({ checkIn, checkOut, nights: 0, datesValid: false, error: dateError, rooms: [] });
    }

    const nights = nightsBetween(checkIn, checkOut);
    const availability = await getAvailability(checkIn, checkOut);
    const taxPercent = settingNumber(settings, 'taxPercent', 0);
    const serviceFeePercent = settingNumber(settings, 'serviceFeePercent', 0);

    const payload = rooms.map((room) => {
      const info = availability.get(room.id);
      const quote = computePrice({
        basePrice: room.basePrice,
        nights,
        adults,
        children,
        maxGuests: room.maxGuests,
        extraGuestFee: room.extraGuestFee,
        taxPercent,
        serviceFeePercent,
      });
      const fitsGuests = adults + children <= room.maxGuests || room.extraGuestFee > 0;
      return {
        ...room,
        available: info?.available ?? 0,
        isAvailable: (info?.isAvailable ?? false) && fitsGuests,
        fitsGuests,
        quote,
      };
    });

    return NextResponse.json({ checkIn, checkOut, nights, datesValid: true, rooms: payload });
  } catch (error) {
    console.error('Availability lookup failed:', error);
    return NextResponse.json({ error: 'Could not check availability' }, { status: 500 });
  }
}
