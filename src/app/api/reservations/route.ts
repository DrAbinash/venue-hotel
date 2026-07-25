import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getSettings, settingBool, settingNumber } from '@/lib/settings';
import { healMissingTables, isMissingTableError } from '@/lib/ensure-schema';

export const dynamic = 'force-dynamic';

const RESERVATION_STATUSES = ['requested', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];

async function uniqueReservationRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ref = `T${randomBytes(3).toString('hex').toUpperCase()}`;
    const clash = await db.tableReservation.findUnique({ where: { reservationRef: ref } });
    if (!clash) return ref;
  }
  return `T${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** GET /api/reservations — the reservation book. Admin only. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const date = searchParams.get('date');

  const query = () =>
    db.tableReservation.findMany({
      where: {
        ...(status && status !== 'all' ? { status } : {}),
        ...(date ? { date } : {}),
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 300,
    });

  try {
    return NextResponse.json(await query());
  } catch (error) {
    if (isMissingTableError(error) && (await healMissingTables())) {
      return NextResponse.json(await query());
    }
    throw error;
  }
}

/**
 * POST /api/reservations — a guest requests a table.
 *
 * The request lands as `requested`; the host confirms it from the admin
 * panel. Nothing here blocks double-booking — table inventory is the
 * restaurant's call, not the website's.
 */
export async function POST(request: NextRequest) {
  try {
    const settings = await getSettings();
    if (!settingBool(settings, 'restaurantEnabled') || !settingBool(settings, 'tableReservationsEnabled')) {
      return NextResponse.json({ error: 'Online table reservations are currently closed.' }, { status: 503 });
    }

    const body = await request.json();

    const guestName = String(body.guestName ?? '').trim();
    const guestPhone = String(body.guestPhone ?? '').trim();
    if (guestName.length < 2) return NextResponse.json({ error: 'Please tell us a name for the reservation.' }, { status: 400 });
    if (guestPhone.replace(/\D/g, '').length < 7) {
      return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
    }

    const date = String(body.date ?? '').trim();
    const time = String(body.time ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Please pick a date.' }, { status: 400 });
    if (!/^\d{2}:\d{2}$/.test(time)) return NextResponse.json({ error: 'Please pick a time.' }, { status: 400 });

    // Today's earlier slots and past dates are gone; tomorrow is fine.
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) return NextResponse.json({ error: 'That date has already passed.' }, { status: 400 });

    const partyMax = Math.max(1, settingNumber(settings, 'reservationPartyMax', 12));
    const partySize = Math.round(Number(body.partySize) || 2);
    if (partySize < 1) return NextResponse.json({ error: 'How many guests should we expect?' }, { status: 400 });
    if (partySize > partyMax) {
      return NextResponse.json(
        { error: `For parties larger than ${partyMax}, please call us on ${settings.phone || 'the restaurant line'}.` },
        { status: 400 },
      );
    }

    const reservation = await db.tableReservation.create({
      data: {
        reservationRef: await uniqueReservationRef(),
        guestName,
        guestPhone,
        guestEmail: body.guestEmail ? String(body.guestEmail).trim().toLowerCase() : null,
        partySize,
        date,
        time,
        occasion: body.occasion ? String(body.occasion).slice(0, 60) : null,
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
        status: 'requested',
      },
    });

    return NextResponse.json(
      {
        reservationRef: reservation.reservationRef,
        date: reservation.date,
        time: reservation.time,
        partySize: reservation.partySize,
        status: reservation.status,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isMissingTableError(error) && (await healMissingTables())) {
      return NextResponse.json({ error: 'We were just setting the table — please try again.' }, { status: 503 });
    }
    console.error('Reservation failed:', error);
    return NextResponse.json({ error: 'Could not place the reservation.' }, { status: 400 });
  }
}

/** PUT — host desk status changes and notes. Admin only. */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { id, createdAt, updatedAt, ...data } = body as Record<string, unknown> & { id: string };
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    if (data.status !== undefined && !RESERVATION_STATUSES.includes(String(data.status))) {
      return NextResponse.json({ error: 'Unknown reservation status.' }, { status: 400 });
    }

    const updated = await db.tableReservation.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.tableReservation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
