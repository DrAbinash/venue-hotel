/**
 * Restaurant menu maths, shared between the browser and the order API so a
 * cart total previewed on a phone is exactly what the server charges.
 */

export interface MenuSize {
  label: string;
  priceDelta: number;
}

export interface MenuAddon {
  label: string;
  price: number;
}

export type OrderType = 'dine_in' | 'room_service' | 'takeaway' | 'delivery' | 'cloud_kitchen';

/**
 * The first four types belong to the in-house restaurant and are gated by
 * `restaurantEnabled` plus their own switch. `cloud_kitchen` is a delivery-only
 * channel with its own fees and hours, and stays available even when the
 * restaurant itself is closed to online orders.
 */
export const ORDER_TYPES: { id: OrderType; label: string; settingKey: string; hint: string }[] = [
  { id: 'dine_in', label: 'Dine In', settingKey: 'orderDineInEnabled', hint: 'Served to your table' },
  { id: 'room_service', label: 'Room Service', settingKey: 'orderRoomServiceEnabled', hint: 'Brought to your room' },
  { id: 'takeaway', label: 'Takeaway', settingKey: 'orderTakeawayEnabled', hint: 'Collect at the counter' },
  { id: 'delivery', label: 'Delivery', settingKey: 'orderDeliveryEnabled', hint: 'To your address' },
  { id: 'cloud_kitchen', label: 'Cloud Kitchen', settingKey: 'cloudKitchenEnabled', hint: 'Delivered from our cloud kitchen' },
];

export interface CartLine {
  /** Stable key: item + size + chosen add-ons, so variants stack separately. */
  key: string;
  menuItemId: string;
  name: string;
  imageUrl?: string | null;
  size: string | null;
  unitPrice: number;
  quantity: number;
  addons: MenuAddon[];
  notes?: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal(line: Pick<CartLine, 'unitPrice' | 'quantity' | 'addons'>): number {
  const addonTotal = line.addons.reduce((sum, addon) => sum + (Number(addon.price) || 0), 0);
  return round2((line.unitPrice + addonTotal) * line.quantity);
}

export function cartKey(menuItemId: string, size: string | null, addons: MenuAddon[]): string {
  const addonPart = addons.map((a) => a.label).sort().join('+');
  return `${menuItemId}|${size ?? ''}|${addonPart}`;
}

export interface OrderChargeRules {
  taxPercent: number;
  packagingFee: number;
  deliveryFee: number;
  roomServiceFee: number;
  /** Cloud kitchen fees; fall back to the restaurant fees when unset. */
  cloudKitchenPackagingFee?: number;
  cloudKitchenDeliveryFee?: number;
}

export interface OrderTotals {
  subtotal: number;
  packagingFee: number;
  deliveryFee: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

/** Fees depend on how the food is getting to the customer. */
export function computeOrderTotals(
  lines: Pick<CartLine, 'unitPrice' | 'quantity' | 'addons'>[],
  orderType: OrderType,
  rules: OrderChargeRules,
  discountAmount = 0,
): OrderTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));

  const cloudPackaging = rules.cloudKitchenPackagingFee ?? rules.packagingFee;
  const cloudDelivery = rules.cloudKitchenDeliveryFee ?? rules.deliveryFee;

  const packagingFee =
    orderType === 'takeaway' || orderType === 'delivery'
      ? round2(Math.max(0, rules.packagingFee))
      : orderType === 'cloud_kitchen'
        ? round2(Math.max(0, cloudPackaging))
        : 0;
  const deliveryFee =
    orderType === 'delivery'
      ? round2(Math.max(0, rules.deliveryFee))
      : orderType === 'cloud_kitchen'
        ? round2(Math.max(0, cloudDelivery))
        : 0;
  const serviceFee = orderType === 'room_service' ? round2(Math.max(0, rules.roomServiceFee)) : 0;

  const discount = round2(Math.min(Math.max(0, discountAmount), subtotal));
  const net = Math.max(0, subtotal - discount + packagingFee + deliveryFee + serviceFee);
  const taxAmount = round2((net * Math.max(0, rules.taxPercent)) / 100);

  return {
    subtotal,
    // The room-service charge rides along with packaging so the schema stays small.
    packagingFee: round2(packagingFee + serviceFee),
    deliveryFee,
    taxAmount,
    discountAmount: discount,
    totalAmount: round2(net + taxAmount),
  };
}

/** Parse a JSON column into typed options, tolerating hand-edited values. */
export function parseOptions<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** The lowest price an item can be ordered at, used for "from ₹x" labels. */
export function startingPrice(basePrice: number, sizes: MenuSize[]): number {
  if (!sizes.length) return basePrice;
  return basePrice + Math.min(...sizes.map((size) => Number(size.priceDelta) || 0));
}
