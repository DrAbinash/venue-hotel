import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, isAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const asJsonString = (value: unknown, fallback: string) => {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return fallback;
  return JSON.stringify(value);
};

const asNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** GET — public. Admins additionally see rooms that are switched off. */
export async function GET() {
  try {
    const includeInactive = await isAdminRequest();
    const rooms = await db.room.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { basePrice: 'asc' }],
      include: { floor: true },
    });
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Rooms fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    if (!body.name || !body.roomNumber || !body.floorId) {
      return NextResponse.json({ error: 'Name, room number and floor are required.' }, { status: 400 });
    }

    const room = await db.room.create({
      data: {
        name: String(body.name),
        roomNumber: String(body.roomNumber),
        floorId: String(body.floorId),
        type: body.type || 'Standard',
        basePrice: asNumber(body.basePrice, 0),
        quantity: Math.max(1, Math.round(asNumber(body.quantity, 1))),
        maxGuests: Math.max(1, Math.round(asNumber(body.maxGuests, 2))),
        extraGuestFee: asNumber(body.extraGuestFee, 0),
        bedType: body.bedType || null,
        size: body.size || null,
        view: body.view || null,
        description: String(body.description ?? ''),
        amenities: asJsonString(body.amenities, '[]'),
        images: asJsonString(body.images, '[]'),
        isActive: body.isActive ?? true,
        isFeatured: body.isFeatured ?? false,
        sortOrder: Math.round(asNumber(body.sortOrder, 0)),
      },
      include: { floor: true },
    });
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const friendly = message.includes('Unique constraint')
      ? 'That room number is already in use.'
      : message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { id, floor, bookings, createdAt, updatedAt, ...data } = body as Record<string, unknown> & { id: string };
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    if (data.amenities !== undefined) data.amenities = asJsonString(data.amenities, '[]');
    if (data.images !== undefined) data.images = asJsonString(data.images, '[]');
    if (data.basePrice !== undefined) data.basePrice = asNumber(data.basePrice, 0);
    if (data.extraGuestFee !== undefined) data.extraGuestFee = asNumber(data.extraGuestFee, 0);
    if (data.quantity !== undefined) data.quantity = Math.max(1, Math.round(asNumber(data.quantity, 1)));
    if (data.maxGuests !== undefined) data.maxGuests = Math.max(1, Math.round(asNumber(data.maxGuests, 2)));
    if (data.sortOrder !== undefined) data.sortOrder = Math.round(asNumber(data.sortOrder, 0));

    const room = await db.room.update({ where: { id }, data, include: { floor: true } });
    return NextResponse.json(room);
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

    // Keep the history: a room with reservations is retired, not erased.
    const bookingCount = await db.booking.count({ where: { roomId: id } });
    if (bookingCount > 0) {
      await db.room.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({
        success: true,
        deactivated: true,
        message: `This room has ${bookingCount} reservation(s), so it was hidden from the website instead of deleted.`,
      });
    }

    await db.room.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
