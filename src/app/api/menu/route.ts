import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminRequest, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const asJson = (value: unknown, fallback: string) => {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return fallback;
  return JSON.stringify(value);
};

const asNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * GET /api/menu — the full menu, grouped by category.
 *
 * Guests see only what is on and in stock; admins see everything so they can
 * switch a sold-out dish back on.
 */
export async function GET() {
  try {
    const admin = await isAdminRequest();
    const categories = await db.menuCategory.findMany({
      where: admin ? undefined : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: admin ? undefined : { isAvailable: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Menu fetch error:', error);
    return NextResponse.json({ error: 'Failed to load the menu' }, { status: 500 });
  }
}

/** POST — create a category (`kind: 'category'`) or a dish (default). */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();

    if (body.kind === 'category') {
      if (!body.name) return NextResponse.json({ error: 'A category name is required.' }, { status: 400 });
      const category = await db.menuCategory.create({
        data: {
          name: String(body.name),
          description: body.description || null,
          imageUrl: body.imageUrl || null,
          icon: body.icon || 'utensils',
          isActive: body.isActive ?? true,
          sortOrder: Math.round(asNumber(body.sortOrder, 0)),
        },
      });
      return NextResponse.json(category, { status: 201 });
    }

    if (!body.name || !body.categoryId) {
      return NextResponse.json({ error: 'A dish name and category are required.' }, { status: 400 });
    }

    const item = await db.menuItem.create({
      data: {
        categoryId: String(body.categoryId),
        name: String(body.name),
        description: String(body.description ?? ''),
        imageUrl: body.imageUrl || null,
        basePrice: asNumber(body.basePrice, 0),
        sizes: asJson(body.sizes, '[]'),
        addons: asJson(body.addons, '[]'),
        isVeg: body.isVeg ?? true,
        spiceLevel: Math.round(asNumber(body.spiceLevel, 0)),
        calories: body.calories ? Math.round(asNumber(body.calories, 0)) : null,
        prepMinutes: Math.round(asNumber(body.prepMinutes, 15)),
        isAvailable: body.isAvailable ?? true,
        isBestseller: body.isBestseller ?? false,
        sortOrder: Math.round(asNumber(body.sortOrder, 0)),
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { id, kind, items, category, createdAt, updatedAt, ...data } = body as Record<string, unknown> & {
      id: string;
      kind?: string;
    };
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    if (kind === 'category') {
      if (data.sortOrder !== undefined) data.sortOrder = Math.round(asNumber(data.sortOrder, 0));
      const updated = await db.menuCategory.update({ where: { id }, data });
      return NextResponse.json(updated);
    }

    if (data.sizes !== undefined) data.sizes = asJson(data.sizes, '[]');
    if (data.addons !== undefined) data.addons = asJson(data.addons, '[]');
    if (data.basePrice !== undefined) data.basePrice = asNumber(data.basePrice, 0);
    if (data.spiceLevel !== undefined) data.spiceLevel = Math.round(asNumber(data.spiceLevel, 0));
    if (data.prepMinutes !== undefined) data.prepMinutes = Math.round(asNumber(data.prepMinutes, 15));
    if (data.sortOrder !== undefined) data.sortOrder = Math.round(asNumber(data.sortOrder, 0));
    if (data.calories !== undefined) data.calories = data.calories ? Math.round(asNumber(data.calories, 0)) : null;

    const updated = await db.menuItem.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE /api/menu?id=...&kind=category|item */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const kind = searchParams.get('kind') ?? 'item';
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    if (kind === 'category') {
      // Deleting a category takes its dishes with it, so say what will go.
      const itemCount = await db.menuItem.count({ where: { categoryId: id } });
      await db.menuCategory.delete({ where: { id } });
      return NextResponse.json({ success: true, removedItems: itemCount });
    }

    await db.menuItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
