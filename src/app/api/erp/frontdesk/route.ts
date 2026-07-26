import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { addDays, daysBetween, istDate } from '@/lib/erp/dates';
import { parseSlabs, roomGstRate, round2 } from '@/lib/erp/gst';
import {
  ensureFolioForBooking, folioTotals, postMissingRoomNights, postPayment,
  syncGatewayPaymentsToFolio, type PayMode,
} from '@/lib/erp/folio';
import { getBusinessDate } from '@/lib/erp/bootstrap';
import { getErpSettings, setErpSetting } from '@/lib/erp/settings';
import { nextDocNo } from '@/lib/erp/numbering';
import { getAvailability, toDateOnly } from '@/lib/availability';
import { randomBytes } from 'crypto';
import type { StaffSession } from '@/lib/erp/auth';

export const dynamic = 'force-dynamic';

const ACTIVE = ['pending', 'confirmed', 'checked_in'];

/** GET — everything the front desk wall needs: tape chart, movements, stats. */
export async function GET(request: NextRequest) {
  const auth = await erpGuard('frontdesk');
  if (auth.denied) return auth.denied;

  const params = request.nextUrl.searchParams;
  const businessDate = await getBusinessDate();
  const from = params.get('from') || addDays(businessDate, -1);
  const days = Math.min(31, Math.max(7, Number(params.get('days')) || 14));
  const to = addDays(from, days);

  const [units, bookings] = await Promise.all([
    db.roomUnit.findMany({
      where: { isActive: true },
      include: { room: { select: { id: true, name: true, type: true, basePrice: true, maxGuests: true } } },
      orderBy: [{ sortOrder: 'asc' }, { unitNumber: 'asc' }],
    }),
    db.booking.findMany({
      where: {
        status: { in: [...ACTIVE, 'checked_out'] },
        checkIn: { lt: new Date(`${to}T00:00:00Z`) },
        checkOut: { gt: new Date(`${addDays(from, -1)}T00:00:00Z`) },
      },
      orderBy: { checkIn: 'asc' },
    }),
  ]);

  const inHouse = bookings.filter((b) => b.status === 'checked_in');
  const folios = await db.folio.findMany({
    where: { bookingId: { in: inHouse.map((b) => b.id) } },
    include: { lines: true },
  });
  const balanceByBooking = new Map<string, number>();
  for (const folio of folios) {
    if (folio.bookingId) balanceByBooking.set(folio.bookingId, folioTotals(folio.lines).balance);
  }

  const shaped = bookings.map((b) => ({
    id: b.id,
    bookingRef: b.bookingRef,
    guestName: b.guestName,
    guestPhone: b.guestPhone,
    roomId: b.roomId,
    roomType: b.roomType,
    unitId: b.unitId,
    checkIn: istDate(b.checkIn),
    checkOut: istDate(b.checkOut),
    nights: b.nights,
    adults: b.adults,
    children: b.children,
    status: b.status,
    paymentStatus: b.paymentStatus,
    totalAmount: b.totalAmount,
    amountPaid: b.amountPaid,
    source: b.source,
    balance: balanceByBooking.get(b.id) ?? null,
  }));

  const arrivals = shaped.filter((b) => ['pending', 'confirmed'].includes(b.status) && b.checkIn <= businessDate);
  const departures = shaped.filter((b) => b.status === 'checked_in' && b.checkOut <= businessDate);
  const occupied = shaped.filter((b) => b.status === 'checked_in').length;

  return NextResponse.json({
    businessDate,
    today: istDate(),
    auditLagDays: Math.max(0, daysBetween(businessDate, istDate())),
    from,
    days,
    units: units.map((u) => ({
      id: u.id,
      unitNumber: u.unitNumber,
      hkStatus: u.hkStatus,
      roomId: u.roomId,
      roomName: u.room.name,
      roomType: u.room.type,
      basePrice: u.room.basePrice,
      maxGuests: u.room.maxGuests,
    })),
    bookings: shaped,
    arrivals,
    departures,
    stats: {
      totalUnits: units.length,
      occupied,
      occupancyPct: units.length ? Math.round((occupied / units.length) * 100) : 0,
      arrivalsDue: arrivals.length,
      departuresDue: departures.length,
    },
  });
}

/** POST — front-desk operations, dispatched on `action`. */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('frontdesk');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    switch (action) {
      case 'walkin': return await walkin(body, session);
      case 'assign_unit': return await assignUnit(body, session);
      case 'checkin': return await checkin(body, session);
      case 'checkout': return await checkout(body, session);
      case 'room_move': return await roomMove(body, session);
      case 'cancel': return await cancelBooking(body, session);
      case 'no_show': return await markNoShow(body, session);
      case 'night_audit': return await nightAudit(session, Boolean(body.force));
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('frontdesk action failed', action, error);
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ---------------------------------------------------------------------------

function generateRef(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let ref = '';
  for (let i = 0; i < 8; i += 1) ref += alphabet[bytes[i] % alphabet.length];
  return `${ref.slice(0, 4)}-${ref.slice(4)}`;
}

async function uniqueRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ref = generateRef();
    if (!(await db.booking.findUnique({ where: { bookingRef: ref } }))) return ref;
  }
  return `${generateRef()}-${Date.now().toString(36).toUpperCase().slice(-3)}`;
}

/** Walk-in guest: create the reservation at the desk, optionally check in at once. */
async function walkin(body: Record<string, unknown>, session: StaffSession) {
  const roomId = String(body.roomId ?? '');
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room || !room.isActive) return NextResponse.json({ error: 'Pick a valid room type' }, { status: 400 });

  const guestName = String(body.guestName ?? '').trim();
  const guestPhone = String(body.guestPhone ?? '').trim();
  if (guestName.length < 2) return NextResponse.json({ error: 'Guest name is required' }, { status: 400 });
  if (guestPhone.length < 7) return NextResponse.json({ error: 'Guest phone is required' }, { status: 400 });

  const businessDate = await getBusinessDate();
  const checkIn = String(body.checkIn ?? businessDate);
  const checkOut = String(body.checkOut ?? addDays(checkIn, 1));
  const nights = daysBetween(checkIn, checkOut);
  if (nights < 1) return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 });
  if (checkIn < businessDate) return NextResponse.json({ error: 'Check-in cannot be before the business date' }, { status: 400 });

  const availability = await getAvailability(checkIn, checkOut, { roomIds: [roomId] });
  if (!availability.get(roomId)?.isAvailable) {
    return NextResponse.json({ error: `${room.name} is sold out for those dates` }, { status: 409 });
  }

  const adults = Math.max(1, Math.min(10, Number(body.adults) || 1));
  const children = Math.max(0, Math.min(10, Number(body.children) || 0));
  const nightlyRate = round2(Math.max(0, Number(body.nightlyRate) || room.basePrice));
  const discountAmount = round2(Math.max(0, Number(body.discountAmount) || 0));

  const extraGuests = Math.max(0, adults + children - Math.max(1, room.maxGuests));
  const roomTotal = round2(nightlyRate * nights);
  const extraGuestTotal = round2(extraGuests * room.extraGuestFee * nights);
  const net = Math.max(0, roomTotal + extraGuestTotal - Math.min(discountAmount, roomTotal + extraGuestTotal));

  const settings = await getErpSettings();
  const slabs = parseSlabs(settings.erpRoomGstSlabs);
  const gstRate = roomGstRate(net / nights, slabs);
  const taxAmount = round2((net * gstRate) / 100);
  const totalAmount = round2(net + taxAmount);

  const booking = await db.booking.create({
    data: {
      bookingRef: await uniqueRef(),
      roomId,
      guestName,
      guestEmail: body.guestEmail ? String(body.guestEmail).trim().toLowerCase() : 'walkin@frontdesk.local',
      guestPhone,
      guestCountry: body.guestCountry ? String(body.guestCountry) : 'India',
      checkIn: toDateOnly(checkIn),
      checkOut: toDateOnly(checkOut),
      nights,
      adults,
      children,
      roomType: room.name,
      roomTotal,
      extraGuestTotal,
      feeAmount: 0,
      taxAmount,
      discountAmount,
      totalAmount,
      status: 'confirmed',
      source: 'walkin',
      internalNotes: body.notes ? String(body.notes).slice(0, 500) : null,
    },
  });

  await logAudit(session, 'frontdesk.walkin', {
    entity: 'Booking', entityId: booking.id,
    summary: `Walk-in ${booking.bookingRef} — ${guestName}, ${room.name}, ${checkIn} → ${checkOut}`,
  });

  if (body.checkinNow && body.unitId) {
    const result = await checkin(
      { bookingId: booking.id, unitId: body.unitId, force: body.force, regCard: body.regCard ?? {} },
      session,
    );
    // The reservation exists either way. If allocation failed, hand the
    // reference back so the desk can retry with another room rather than
    // creating a duplicate booking.
    const payload = await result.clone().json().catch(() => ({}));
    return NextResponse.json(
      { ...payload, bookingId: booking.id, bookingRef: booking.bookingRef },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true, bookingId: booking.id, bookingRef: booking.bookingRef });
}

async function unitConflict(unitId: string, checkIn: Date, checkOut: Date, excludeBookingId?: string) {
  return db.booking.findFirst({
    where: {
      unitId,
      status: { in: ACTIVE },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });
}

/**
 * Whoever is physically in the room right now.
 *
 * Dates alone are not enough: an overstaying guest is still in the room after
 * their checkout date has passed, and the date ranges would no longer overlap.
 * Nothing may be moved into an occupied room until that guest is checked out
 * or moved elsewhere, so this is deliberately not force-able.
 */
async function currentOccupant(unitId: string, excludeBookingId?: string) {
  return db.booking.findFirst({
    where: {
      unitId,
      status: 'checked_in',
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });
}

/** Allocate a physical room without checking in (pre-assignment). */
async function assignUnit(body: Record<string, unknown>, session: StaffSession) {
  const booking = await db.booking.findUnique({ where: { id: String(body.bookingId ?? '') } });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  const unit = await db.roomUnit.findUnique({ where: { id: String(body.unitId ?? '') }, include: { room: true } });
  if (!unit || !unit.isActive) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (booking.roomId && unit.roomId !== booking.roomId && !body.force) {
    return NextResponse.json({ error: `${unit.unitNumber} is a ${unit.room.name}, not the booked type. Confirm to override.`, needsForce: true }, { status: 409 });
  }
  const clash = await unitConflict(unit.id, booking.checkIn, booking.checkOut, booking.id);
  if (clash) return NextResponse.json({ error: `${unit.unitNumber} is taken by ${clash.bookingRef} for those dates` }, { status: 409 });

  await db.booking.update({ where: { id: booking.id }, data: { unitId: unit.id } });
  await logAudit(session, 'frontdesk.assign', {
    entity: 'Booking', entityId: booking.id, summary: `${booking.bookingRef} assigned to room ${unit.unitNumber}`,
  });
  return NextResponse.json({ ok: true });
}

/** Check-in: allocate the room, capture the registration card, open the folio. */
async function checkin(body: Record<string, unknown>, session: StaffSession) {
  const booking = await db.booking.findUnique({ where: { id: String(body.bookingId ?? '') } });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (!['pending', 'confirmed'].includes(booking.status)) {
    return NextResponse.json({ error: `Cannot check in a ${booking.status} booking` }, { status: 400 });
  }

  const unitId = String(body.unitId ?? booking.unitId ?? '');
  if (!unitId) return NextResponse.json({ error: 'Pick a room to allocate' }, { status: 400 });
  const unit = await db.roomUnit.findUnique({ where: { id: unitId }, include: { room: true } });
  if (!unit || !unit.isActive) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (booking.roomId && unit.roomId !== booking.roomId && !body.force) {
    return NextResponse.json({ error: `${unit.unitNumber} is a ${unit.room.name}, not the booked type. Confirm to override.`, needsForce: true }, { status: 409 });
  }
  if (['out_of_order', 'out_of_service'].includes(unit.hkStatus)) {
    return NextResponse.json({ error: `${unit.unitNumber} is ${unit.hkStatus.replace(/_/g, ' ')}` }, { status: 409 });
  }
  const clash = await unitConflict(unit.id, booking.checkIn, booking.checkOut, booking.id);
  if (clash) return NextResponse.json({ error: `${unit.unitNumber} is taken by ${clash.bookingRef}` }, { status: 409 });
  const occupant = await currentOccupant(unit.id, booking.id);
  if (occupant) {
    return NextResponse.json({
      error: `${unit.unitNumber} still has ${occupant.guestName} (${occupant.bookingRef}) in house. Check them out or move them first.`,
    }, { status: 409 });
  }
  if (unit.hkStatus === 'dirty' && !body.force) {
    return NextResponse.json({ error: `${unit.unitNumber} has not been cleaned yet. Confirm to check in anyway.`, needsForce: true }, { status: 409 });
  }

  const reg = (body.regCard ?? {}) as Record<string, unknown>;
  const isForeigner = Boolean(reg.isForeigner);
  const str = (key: string, max = 120) => (reg[key] ? String(reg[key]).slice(0, max) : null);

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'checked_in', unitId: unit.id },
    });
    await tx.regCard.upsert({
      where: { bookingId: booking.id },
      update: {},
      create: {
        bookingId: booking.id,
        guestName: booking.guestName,
        nationality: str('nationality') ?? (isForeigner ? '' : 'Indian'),
        idType: String(reg.idType ?? (isForeigner ? 'passport' : 'aadhaar')),
        idNumber: str('idNumber', 40) ?? '',
        address: str('address', 300),
        city: str('city'),
        state: str('state'),
        pincode: str('pincode', 10),
        arrivalFrom: str('arrivalFrom'),
        nextDestination: str('nextDestination'),
        purposeOfVisit: str('purposeOfVisit', 60) ?? 'Leisure',
        vehicleNo: str('vehicleNo', 20),
        companions: JSON.stringify(Array.isArray(reg.companions) ? reg.companions.slice(0, 6) : []),
        isForeigner,
        passportNo: str('passportNo', 20),
        passportIssuePlace: str('passportIssuePlace'),
        passportIssueDate: str('passportIssueDate', 10),
        passportExpiry: str('passportExpiry', 10),
        visaNo: str('visaNo', 20),
        visaType: str('visaType', 20),
        visaIssueDate: str('visaIssueDate', 10),
        visaExpiry: str('visaExpiry', 10),
        arrivedFromCountry: str('arrivedFromCountry', 60),
        arrivalDateInIndia: str('arrivalDateInIndia', 10),
        checkedInBy: session.username,
      },
    });
  });

  const fresh = await db.booking.findUnique({ where: { id: booking.id } });
  const folio = await ensureFolioForBooking(fresh!, session.username);
  await syncGatewayPaymentsToFolio(fresh!, folio, session.username);

  await logAudit(session, 'frontdesk.checkin', {
    entity: 'Booking', entityId: booking.id,
    summary: `${booking.bookingRef} checked in — ${booking.guestName} → room ${unit.unitNumber}${isForeigner ? ' (foreign national, Form C due)' : ''}`,
  });
  return NextResponse.json({ ok: true, folioId: folio.id, formCDue: isForeigner });
}

/** Check-out: post pending nights, verify the balance, close everything down. */
async function checkout(body: Record<string, unknown>, session: StaffSession) {
  const booking = await db.booking.findUnique({ where: { id: String(body.bookingId ?? '') } });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status !== 'checked_in') {
    return NextResponse.json({ error: 'Only in-house guests can be checked out' }, { status: 400 });
  }

  const settings = await getErpSettings();
  const folio = await ensureFolioForBooking(booking, session.username);
  await syncGatewayPaymentsToFolio(booking, folio, session.username);
  await postMissingRoomNights(booking, folio, istDate(booking.checkOut), settings, session.username);

  // Optional settlement in the same breath: { payment: { amount, mode, reference } }
  const payment = body.payment as { amount?: number; mode?: string; reference?: string } | undefined;
  if (payment && Number(payment.amount) > 0) {
    await postPayment(folio, {
      amount: Number(payment.amount),
      mode: (payment.mode ?? 'cash') as PayMode,
      reference: payment.reference ? String(payment.reference) : undefined,
    }, session.username);
  }

  const lines = await db.folioLine.findMany({ where: { folioId: folio.id } });
  const totals = folioTotals(lines);
  if (Math.abs(totals.balance) > 0.5 && !body.allowCredit) {
    return NextResponse.json({
      error: totals.balance > 0
        ? `Folio has a pending balance of ₹${totals.balance.toFixed(2)}. Collect it or allow credit.`
        : `Folio is over-collected by ₹${Math.abs(totals.balance).toFixed(2)}. Record a refund first.`,
      balance: totals.balance,
      needsSettlement: true,
    }, { status: 409 });
  }

  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { status: 'checked_out' } });
    await tx.folio.update({
      where: { id: folio.id },
      data: {
        status: 'settled',
        closedAt: new Date(),
        notes: body.allowCredit && Math.abs(totals.balance) > 0.5
          ? `Checked out on credit, balance ₹${totals.balance.toFixed(2)} — ${String(body.creditNote ?? '')}`.slice(0, 300)
          : folio.notes,
      },
    });
    if (booking.unitId) {
      await tx.roomUnit.update({ where: { id: booking.unitId }, data: { hkStatus: 'dirty' } });
      await tx.hkTask.create({
        data: {
          unitId: booking.unitId,
          type: 'cleaning',
          priority: 'high',
          notes: `Departure clean — ${booking.guestName} checked out`,
          createdBy: session.username,
        },
      });
    }
  });

  await updateGuestProfile(booking.guestEmail, booking.guestName, booking.guestPhone);

  await logAudit(session, 'frontdesk.checkout', {
    entity: 'Booking', entityId: booking.id,
    summary: `${booking.bookingRef} checked out — ${booking.guestName}, balance ₹${totals.balance.toFixed(2)}`,
  });
  return NextResponse.json({ ok: true, balance: totals.balance, folioId: folio.id });
}

async function roomMove(body: Record<string, unknown>, session: StaffSession) {
  const booking = await db.booking.findUnique({ where: { id: String(body.bookingId ?? '') } });
  if (!booking || booking.status !== 'checked_in') {
    return NextResponse.json({ error: 'Only in-house guests can be moved' }, { status: 400 });
  }
  const unit = await db.roomUnit.findUnique({ where: { id: String(body.unitId ?? '') } });
  if (!unit || !unit.isActive) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  const clash = await unitConflict(unit.id, booking.checkIn, booking.checkOut, booking.id);
  if (clash) return NextResponse.json({ error: `${unit.unitNumber} is taken by ${clash.bookingRef}` }, { status: 409 });
  const occupant = await currentOccupant(unit.id, booking.id);
  if (occupant) {
    return NextResponse.json({
      error: `${unit.unitNumber} still has ${occupant.guestName} (${occupant.bookingRef}) in house. Check them out or move them first.`,
    }, { status: 409 });
  }

  const oldUnitId = booking.unitId;
  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { unitId: unit.id } });
    if (oldUnitId) {
      await tx.roomUnit.update({ where: { id: oldUnitId }, data: { hkStatus: 'dirty' } });
      await tx.hkTask.create({
        data: {
          unitId: oldUnitId, type: 'cleaning', priority: 'high',
          notes: `Room move — ${booking.guestName} shifted to ${unit.unitNumber}`,
          createdBy: session.username,
        },
      });
    }
  });
  await logAudit(session, 'frontdesk.room_move', {
    entity: 'Booking', entityId: booking.id,
    summary: `${booking.bookingRef} moved to room ${unit.unitNumber}`,
  });
  return NextResponse.json({ ok: true });
}

async function cancelBooking(body: Record<string, unknown>, session: StaffSession) {
  const booking = await db.booking.findUnique({ where: { id: String(body.bookingId ?? '') } });
  if (!booking || !['pending', 'confirmed'].includes(booking.status)) {
    return NextResponse.json({ error: 'Only pending or confirmed bookings can be cancelled' }, { status: 400 });
  }
  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: String(body.reason ?? 'Cancelled at front desk').slice(0, 300),
    },
  });
  await logAudit(session, 'frontdesk.cancel', {
    entity: 'Booking', entityId: booking.id, summary: `${booking.bookingRef} cancelled — ${booking.guestName}`,
  });
  return NextResponse.json({ ok: true });
}

async function markNoShow(body: Record<string, unknown>, session: StaffSession) {
  const booking = await db.booking.findUnique({ where: { id: String(body.bookingId ?? '') } });
  if (!booking || !['pending', 'confirmed'].includes(booking.status)) {
    return NextResponse.json({ error: 'Only pending or confirmed bookings can be marked no-show' }, { status: 400 });
  }
  await db.booking.update({ where: { id: booking.id }, data: { status: 'no_show' } });
  await logAudit(session, 'frontdesk.no_show', {
    entity: 'Booking', entityId: booking.id, summary: `${booking.bookingRef} marked no-show`,
  });
  return NextResponse.json({ ok: true });
}

/**
 * Night audit — closes the business date: posts the night's room charge to
 * every in-house folio, flags no-shows, then rolls the date forward.
 */
async function nightAudit(session: StaffSession, force = false) {
  const businessDate = await getBusinessDate();

  // The audit closes a day that has happened. Running it repeatedly would
  // roll the business date into the future and post room charges for nights
  // nobody has stayed yet, so stop once the books are level with the calendar.
  // (An audit run late in the evening is fine: the business date still equals
  // today, and closing it moves the property on to tomorrow.)
  if (businessDate > istDate() && !force) {
    return NextResponse.json({
      error: `The business date (${businessDate}) is already ahead of today (${istDate()}). The audit for that day runs once it has ended.`,
      businessDate,
      needsForce: true,
    }, { status: 409 });
  }

  const settings = await getErpSettings();
  const until = addDays(businessDate, 1);

  const inHouse = await db.booking.findMany({ where: { status: 'checked_in' } });
  let roomCharges = 0;
  let postedNights = 0;
  for (const booking of inHouse) {
    const folio = await ensureFolioForBooking(booking, session.username);
    await syncGatewayPaymentsToFolio(booking, folio, session.username);
    const posted = await postMissingRoomNights(booking, folio, until, settings, session.username);
    postedNights += posted;
  }
  const roomLines = await db.folioLine.findMany({
    where: { type: 'room', date: businessDate, isVoid: false },
  });
  roomCharges = round2(roomLines.reduce((s, l) => s + l.total, 0));

  const due = await db.booking.findMany({
    where: { status: { in: ['pending', 'confirmed'] }, checkIn: { lt: new Date(`${until}T00:00:00Z`) } },
  });
  for (const booking of due) {
    await db.booking.update({ where: { id: booking.id }, data: { status: 'no_show' } });
  }

  const overstays = inHouse.filter((b) => istDate(b.checkOut) <= businessDate).length;

  await db.nightAuditRun.upsert({
    where: { businessDate },
    update: { roomsOccupied: inHouse.length, roomCharges, noShows: due.length, runBy: session.username },
    create: {
      businessDate,
      roomsOccupied: inHouse.length,
      roomCharges,
      noShows: due.length,
      notes: overstays ? `${overstays} overstay(s) still in house` : null,
      runBy: session.username,
    },
  });
  await setErpSetting('erpBusinessDate', until);

  await logAudit(session, 'frontdesk.night_audit', {
    entity: 'NightAuditRun', entityId: businessDate,
    summary: `Night audit for ${businessDate}: ${inHouse.length} in house, ${postedNights} night(s) posted, ${due.length} no-show(s)`,
  });
  return NextResponse.json({
    ok: true,
    closedDate: businessDate,
    newBusinessDate: until,
    roomsOccupied: inHouse.length,
    postedNights,
    roomCharges,
    noShows: due.length,
    overstays,
  });
}

/** Keep the CRM in step with every completed stay. */
async function updateGuestProfile(email: string, name: string, phone: string) {
  const key = (email && !email.endsWith('@frontdesk.local') ? email : phone || email).toLowerCase();
  if (!key) return;
  const stays = await db.booking.count({
    where: { guestEmail: email, status: 'checked_out' },
  });
  const spend = await db.booking.aggregate({
    where: { guestEmail: email, status: 'checked_out' },
    _sum: { amountPaid: true },
  });
  await db.guestProfile.upsert({
    where: { profileKey: key },
    update: {
      name, phone, email,
      totalStays: stays,
      totalSpend: round2(spend._sum.amountPaid ?? 0),
      lastStay: new Date(),
    },
    create: {
      profileKey: key, name, phone, email,
      totalStays: stays,
      totalSpend: round2(spend._sum.amountPaid ?? 0),
      lastStay: new Date(),
    },
  });
}
