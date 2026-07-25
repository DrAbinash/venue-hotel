/**
 * Isomorphic pricing. The browser uses this to preview a quote and the API
 * uses the very same function to compute what is actually charged, so the
 * number a guest sees can never drift from the number that is stored.
 */

export interface PriceInput {
  basePrice: number;
  nights: number;
  adults: number;
  children: number;
  maxGuests: number;
  extraGuestFee: number;
  taxPercent: number;
  serviceFeePercent: number;
  discountAmount?: number;
}

export interface PriceBreakdown {
  nights: number;
  roomTotal: number;
  extraGuestTotal: number;
  feeAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computePrice(input: PriceInput): PriceBreakdown {
  const nights = Math.max(0, Math.floor(input.nights));
  const roomTotal = round2(Math.max(0, input.basePrice) * nights);

  const guests = Math.max(1, input.adults) + Math.max(0, input.children);
  const extraGuests = Math.max(0, guests - Math.max(1, input.maxGuests));
  const extraGuestTotal = round2(extraGuests * Math.max(0, input.extraGuestFee) * nights);

  const discountAmount = round2(Math.min(Math.max(0, input.discountAmount ?? 0), roomTotal + extraGuestTotal));
  const net = Math.max(0, roomTotal + extraGuestTotal - discountAmount);

  const feeAmount = round2((net * Math.max(0, input.serviceFeePercent)) / 100);
  const taxAmount = round2(((net + feeAmount) * Math.max(0, input.taxPercent)) / 100);
  const totalAmount = round2(net + feeAmount + taxAmount);

  return { nights, roomTotal, extraGuestTotal, feeAmount, taxAmount, discountAmount, totalAmount };
}

/** Whole nights between two dates, floored at zero. */
export function nightsBetween(checkIn: string | Date, checkOut: string | Date): number {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.max(0, Math.round(ms / 86_400_000));
}

export interface MoneyFormat {
  currency?: string;
  currencySymbol?: string;
  currencyLocale?: string;
}

/** Format an amount using the currency configured in the admin panel. */
export function formatMoney(amount: number, settings: MoneyFormat = {}): string {
  const locale = settings.currencyLocale || 'en-IN';
  const currency = settings.currency || 'INR';
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    const symbol = settings.currencySymbol || '';
    return `${symbol}${value.toLocaleString(locale)}`;
  }
}

/** Gateways work in the smallest currency unit (paise for INR). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
