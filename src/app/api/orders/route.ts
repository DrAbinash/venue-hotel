import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getSettings, settingBool, settingNumber } from '@/lib/settings';
import {
  computeOrderTotals, lineTotal, parseOptions, type MenuAddon, type MenuSize, type OrderType,
} from '@/lib/menu';

export const dynamic = 'force-dynamic';

const VALID_TYPES: OrderType[] = ['dine_in', 'room_service', 'takeaway', 'delivery', 'cloud_kitchen'];
const TYPE_SETTING: Record<OrderType, string> = {
  dine_in: 'orderDineInEnabled',
  room_service: 'orderRoomServiceEnabled',
  takeaway: 'orderTakeawayEnabled',
  delivery: 'orderDeliveryEnabled',
  cloud_kitchen: 'cloudKitchenEnabled',
};

async function uniqueOrderRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ref = `F${randomBytes(3).toString('hex').toUpperCase()}`;
    const clash = await db.foodOrder.findUnique({ where: { orderRef: ref } });
    if (!clash) return ref;
  }
  return `F${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** GET /api/orders — the kitchen queue. Admin only. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const orders = await db.foodOrder.findMany({
    where: status && status !== 'all' ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { items: true, payments: { orderBy: { createdAt: 'desc' } } },
  });
  return NextResponse.json(orders);
}

/**
 * POST /api/orders — place a food order.
 *
 * Prices, sizes and add-ons are all re-resolved from the menu in the database.
 * The cart the browser sends is treated purely as a list of intentions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = await getSettings();

    const restaurantOpen = settingBool(settings, 'restaurantEnabled');
    const cloudKitchenOpen = settingBool(settings, 'cloudKitchenEnabled');
    if (!restaurantOpen && !cloudKitchenOpen) {
      return NextResponse.json({ error: 'Online ordering is currently closed.' }, { status: 503 });
    }

    const orderType = (String(body.orderType || 'dine_in') as OrderType);
    if (!VALID_TYPES.includes(orderType)) {
      return NextResponse.json({ error: 'Choose a valid order type.' }, { status: 400 });
    }
    // The cloud kitchen runs on its own switch; the restaurant types need the
    // restaurant open as well as their individual toggle.
    const channelOpen =
      orderType === 'cloud_kitchen'
        ? cloudKitchenOpen
        : restaurantOpen && settingBool(settings, TYPE_SETTING[orderType]);
    if (!channelOpen) {
      return NextResponse.json({ error: 'That order type is not available right now.' }, { status: 400 });
    }

    const customerName = String(body.customerName ?? '').trim();
    const customerPhone = String(body.customerPhone ?? '').trim();
    if (customerName.length < 2) return NextResponse.json({ error: 'Please enter a name for the order.' }, { status: 400 });
    if (customerPhone.replace(/\D/g, '').length < 7) {
      return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
    }

    if (orderType === 'dine_in' && !String(body.tableNumber ?? '').trim()) {
      return NextResponse.json({ error: 'Please enter your table number.' }, { status: 400 });
    }
    if (orderType === 'room_service' && !String(body.roomNumber ?? '').trim()) {
      return NextResponse.json({ error: 'Please enter your room number.' }, { status: 400 });
    }
    if (
      (orderType === 'delivery' || orderType === 'cloud_kitchen') &&
      String(body.deliveryAddress ?? '').trim().length < 10
    ) {
      return NextResponse.json({ error: 'Please enter a delivery address.' }, { status: 400 });
    }

    const cart = Array.isArray(body.items) ? body.items : [];
    if (!cart.length) return NextResponse.json({ error: 'Your order is empty.' }, { status: 400 });

    // ---- Re-price every line from the menu, ignoring client-sent prices. ----
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: cart.map((line: { menuItemId?: string }) => String(line.menuItemId ?? '')) } },
    });
    const byId = new Map(menuItems.map((item) => [item.id, item]));

    const lines: {
      menuItemId: string;
      name: string;
      size: string | null;
      unitPrice: number;
      quantity: number;
      addons: MenuAddon[];
      notes: string | null;
      lineTotal: number;
    }[] = [];

    for (const raw of cart) {
      const item = byId.get(String(raw.menuItemId ?? ''));
      if (!item) return NextResponse.json({ error: 'One of the dishes is no longer on the menu.' }, { status: 409 });
      if (!item.isAvailable) {
        return NextResponse.json({ error: `${item.name} has just sold out.` }, { status: 409 });
      }

      const quantity = Math.max(1, Math.min(Math.round(Number(raw.quantity) || 1), 50));

      const sizes = parseOptions<MenuSize>(item.sizes);
      let unitPrice = item.basePrice;
      let sizeLabel: string | null = null;
      if (sizes.length) {
        const chosen = sizes.find((size) => size.label === raw.size) ?? sizes[0];
        sizeLabel = chosen.label;
        unitPrice = item.basePrice + (Number(chosen.priceDelta) || 0);
      }

      // Only add-ons that actually exist on this dish are honoured.
      const available = parseOptions<MenuAddon>(item.addons);
      const requested: string[] = Array.isArray(raw.addons)
        ? raw.addons.map((addon: MenuAddon | string) => (typeof addon === 'string' ? addon : addon?.label)).filter(Boolean)
        : [];
      const addons = available.filter((addon) => requested.includes(addon.label));

      const line = { unitPrice, quantity, addons };
      lines.push({
        menuItemId: item.id,
        name: item.name,
        size: sizeLabel,
        unitPrice,
        quantity,
        addons,
        notes: raw.notes ? String(raw.notes).slice(0, 200) : null,
        lineTotal: lineTotal(line),
      });
    }

    const totals = computeOrderTotals(lines, orderType, {
      taxPercent: settingNumber(settings, 'foodTaxPercent', 0),
      packagingFee: settingNumber(settings, 'packagingFee', 0),
      deliveryFee: settingNumber(settings, 'deliveryFee', 0),
      roomServiceFee: settingNumber(settings, 'roomServiceFee', 0),
      cloudKitchenPackagingFee: settingNumber(settings, 'cloudKitchenPackagingFee', 0),
      cloudKitchenDeliveryFee: settingNumber(settings, 'cloudKitchenDeliveryFee', 0),
    });

    const minOrder =
      orderType === 'cloud_kitchen'
        ? settingNumber(settings, 'cloudKitchenMinOrder', settingNumber(settings, 'minOrderValue', 0))
        : settingNumber(settings, 'minOrderValue', 0);
    if (minOrder > 0 && totals.subtotal < minOrder) {
      return NextResponse.json(
        { error: `Orders start at ${settings.currencySymbol || ''}${minOrder}. Please add a little more.` },
        { status: 400 },
      );
    }

    // Charging to a room requires a reservation that is actually in-house.
    let bookingRef: string | null = null;
    if (body.bookingRef) {
      const ref = String(body.bookingRef).trim().toUpperCase();
      const booking = await db.booking.findUnique({ where: { bookingRef: ref } });
      if (!booking || !['confirmed', 'checked_in', 'pending'].includes(booking.status)) {
        return NextResponse.json({ error: 'We could not match that booking reference.' }, { status: 400 });
      }
      bookingRef = booking.bookingRef;
    }

    const order = await db.foodOrder.create({
      data: {
        orderRef: await uniqueOrderRef(),
        orderType,
        tableNumber: body.tableNumber ? String(body.tableNumber).slice(0, 20) : null,
        roomNumber: body.roomNumber ? String(body.roomNumber).slice(0, 20) : null,
        bookingRef,
        customerName,
        customerPhone,
        customerEmail: body.customerEmail ? String(body.customerEmail).trim().toLowerCase() : null,
        deliveryAddress: body.deliveryAddress ? String(body.deliveryAddress).slice(0, 500) : null,
        currency: settings.currency || 'INR',
        subtotal: totals.subtotal,
        packagingFee: totals.packagingFee,
        deliveryFee: totals.deliveryFee,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        totalAmount: totals.totalAmount,
        status: 'placed',
        paymentStatus: 'unpaid',
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
        items: {
          create: lines.map((line) => ({
            menuItemId: line.menuItemId,
            name: line.name,
            size: line.size,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            addons: JSON.stringify(line.addons),
            lineTotal: line.lineTotal,
            notes: line.notes,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Order creation failed:', error);
    const message = error instanceof Error ? error.message : 'Could not place the order.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PUT — kitchen status changes and notes. Admin only. */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { id, items, payments, createdAt, updatedAt, ...data } = body as Record<string, unknown> & { id: string };
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const order = await db.foodOrder.update({
      where: { id },
      data,
      include: { items: true, payments: { orderBy: { createdAt: 'desc' } } },
    });
    return NextResponse.json(order);
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
    await db.foodOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
