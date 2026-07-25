import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const rooms = await db.room.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { floor: true },
    });
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Rooms fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const amenities = typeof body.amenities === 'string' ? body.amenities : JSON.stringify(body.amenities || []);
    const images = typeof body.images === 'string' ? body.images : JSON.stringify(body.images || []);
    const room = await db.room.create({
      data: {
        name: body.name,
        roomNumber: body.roomNumber,
        floorId: body.floorId,
        type: body.type || 'Standard',
        basePrice: parseFloat(body.basePrice),
        maxGuests: body.maxGuests || 2,
        bedType: body.bedType || null,
        size: body.size || null,
        description: body.description,
        amenities,
        images,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder || 0,
      },
      include: { floor: true },
    });
    return NextResponse.json(room, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, floor, ...data } = body;
    if (data.amenities && typeof data.amenities !== 'string') {
      data.amenities = JSON.stringify(data.amenities);
    }
    if (data.images && typeof data.images !== 'string') {
      data.images = JSON.stringify(data.images);
    }
    const room = await db.room.update({
      where: { id },
      data,
      include: { floor: true },
    });
    return NextResponse.json(room);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.room.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}