import { db } from '@/lib/db';

/** Bookings in these states still occupy inventory. */
export const BLOCKING_STATUSES = ['pending', 'confirmed', 'checked_in'];

/** Normalise a date-only string to midnight UTC so comparisons are stable. */
export function toDateOnly(value: string | Date): Date {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface AvailabilityResult {
  roomId: string;
  quantity: number;
  booked: number;
  available: number;
  isAvailable: boolean;
}

/**
 * How many units of each room are still sellable for a date range.
 *
 * Two stays overlap when one starts before the other ends and ends after the
 * other starts — a same-day checkout/checkin pair is not an overlap.
 */
export async function getAvailability(
  checkIn: string | Date,
  checkOut: string | Date,
  options: { roomIds?: string[]; excludeBookingId?: string } = {},
): Promise<Map<string, AvailabilityResult>> {
  const start = toDateOnly(checkIn);
  const end = toDateOnly(checkOut);

  const rooms = await db.room.findMany({
    where: {
      isActive: true,
      ...(options.roomIds?.length ? { id: { in: options.roomIds } } : {}),
    },
    select: { id: true, quantity: true },
  });

  const overlapping = await db.booking.findMany({
    where: {
      status: { in: BLOCKING_STATUSES },
      roomId: { in: rooms.map((r) => r.id) },
      checkIn: { lt: end },
      checkOut: { gt: start },
      ...(options.excludeBookingId ? { id: { not: options.excludeBookingId } } : {}),
    },
    select: { roomId: true },
  });

  const bookedByRoom = new Map<string, number>();
  for (const booking of overlapping) {
    if (!booking.roomId) continue;
    bookedByRoom.set(booking.roomId, (bookedByRoom.get(booking.roomId) ?? 0) + 1);
  }

  const result = new Map<string, AvailabilityResult>();
  for (const room of rooms) {
    const quantity = Math.max(1, room.quantity);
    const booked = bookedByRoom.get(room.id) ?? 0;
    const available = Math.max(0, quantity - booked);
    result.set(room.id, { roomId: room.id, quantity, booked, available, isAvailable: available > 0 });
  }
  return result;
}

export async function isRoomAvailable(
  roomId: string,
  checkIn: string | Date,
  checkOut: string | Date,
  excludeBookingId?: string,
): Promise<boolean> {
  const availability = await getAvailability(checkIn, checkOut, { roomIds: [roomId], excludeBookingId });
  return availability.get(roomId)?.isAvailable ?? false;
}

/** Human-readable validation of a requested date range against booking rules. */
export function validateStayDates(
  checkIn: string,
  checkOut: string,
  rules: { minNights: number; maxNights: number; maxAdvanceDays: number },
): string | null {
  const start = toDateOnly(checkIn);
  const end = toDateOnly(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Please provide valid check-in and check-out dates.';

  const today = toDateOnly(new Date());
  if (start < today) return 'Check-in cannot be in the past.';
  if (end <= start) return 'Check-out must be after check-in.';

  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (nights < rules.minNights) return `A minimum stay of ${rules.minNights} night(s) is required.`;
  if (nights > rules.maxNights) return `Stays are limited to ${rules.maxNights} nights. Please contact us for longer stays.`;

  const horizon = new Date(today.getTime() + rules.maxAdvanceDays * 86_400_000);
  if (start > horizon) return `Bookings open ${rules.maxAdvanceDays} days in advance.`;

  return null;
}
