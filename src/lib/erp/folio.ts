import { db } from '@/lib/db';
import { istDate } from '@/lib/erp/dates';
import {
  amountInWordsINR, parseSlabs, roomGstRate, round2, splitGst,
} from '@/lib/erp/gst';
import { nextDocNo } from '@/lib/erp/numbering';
import { erpNumber, type ErpSettings } from '@/lib/erp/settings';
import type { Booking, Folio, FolioLine } from '@prisma/client';

/**
 * The folio is the single running bill for a stay. Charges and payments are
 * both lines (payments negative), so the balance is one SUM and can never
 * disagree with the detail.
 */

export type ChargeType =
  | 'room' | 'fnb' | 'banquet' | 'laundry' | 'minibar' | 'spa' | 'transport' | 'misc' | 'discount';

export function gstRateForType(type: ChargeType, unitAmount: number, settings: ErpSettings): number {
  switch (type) {
    case 'room':
      return roomGstRate(unitAmount, parseSlabs(settings.erpRoomGstSlabs));
    case 'fnb':
      return erpNumber(settings, 'erpFnbGstRate', 5);
    case 'banquet':
      return erpNumber(settings, 'erpBanquetGstRate', 5);
    case 'laundry':
      return erpNumber(settings, 'erpLaundryGstRate', 18);
    case 'minibar':
      return erpNumber(settings, 'erpMinibarGstRate', 18);
    case 'discount':
      return 0;
    default:
      return erpNumber(settings, 'erpMiscGstRate', 18);
  }
}

export function sacForType(type: ChargeType, settings: ErpSettings): string {
  switch (type) {
    case 'room': return settings.erpSacRoom || '996311';
    case 'fnb': case 'minibar': return settings.erpSacFnb || '996331';
    case 'banquet': return settings.erpSacBanquet || '996334';
    case 'laundry': return settings.erpSacLaundry || '999712';
    default: return settings.erpSacMisc || '999799';
  }
}

export async function ensureFolioForBooking(booking: Booking, byUsername: string): Promise<Folio> {
  const existing = await db.folio.findUnique({ where: { bookingId: booking.id } });
  if (existing) return existing;
  const folioNo = await nextDocNo('FOL');
  return db.folio.create({
    data: {
      folioNo,
      bookingId: booking.id,
      guestName: booking.guestName,
      notes: `Opened by ${byUsername}`,
    },
  });
}

export interface PostChargeInput {
  type: ChargeType;
  description: string;
  qty?: number;
  unitAmount: number;
  date?: string;
  reference?: string;
  gstRateOverride?: number;
}

/** Post one charge line with GST computed by type (rooms use the tariff slabs). */
export async function postCharge(
  folioId: string,
  input: PostChargeInput,
  settings: ErpSettings,
  byUsername: string,
): Promise<FolioLine> {
  const qty = Math.max(0.01, input.qty ?? 1);
  const isDiscount = input.type === 'discount';
  const unitAmount = isDiscount
    ? -Math.abs(input.unitAmount)
    : round2(Math.max(0, input.unitAmount));
  const taxable = round2(unitAmount * qty);
  const rate = input.gstRateOverride ?? gstRateForType(input.type, Math.abs(unitAmount), settings);
  const split = splitGst(Math.abs(taxable), rate);
  const sign = taxable < 0 ? -1 : 1;

  return db.folioLine.create({
    data: {
      folioId,
      date: input.date ?? istDate(),
      type: input.type,
      description: input.description.slice(0, 200),
      reference: input.reference ?? null,
      hsnSac: sacForType(input.type, settings),
      qty,
      unitAmount,
      amount: taxable,
      gstRate: rate,
      cgst: sign * split.cgst,
      sgst: sign * split.sgst,
      igst: 0,
      total: sign * split.total,
      postedBy: byUsername,
    },
  });
}

export type PayMode = 'cash' | 'upi' | 'card' | 'bank' | 'cheque' | 'gateway';

/**
 * Record money received against a folio. Also mirrors into the sitewide
 * Payment ledger and the booking's paid figures, so the website's
 * "my booking" page and the admin panel agree with the front desk.
 */
export async function postPayment(
  folio: Folio,
  input: { amount: number; mode: PayMode; reference?: string; date?: string; isRefund?: boolean },
  byUsername: string,
): Promise<FolioLine> {
  const amount = round2(Math.abs(input.amount));
  if (amount <= 0) throw new Error('Payment amount must be positive');
  const sign = input.isRefund ? 1 : -1;

  const line = await db.folioLine.create({
    data: {
      folioId: folio.id,
      date: input.date ?? istDate(),
      type: input.isRefund ? 'refund' : 'payment',
      description: input.isRefund
        ? `Refund (${input.mode})`
        : `Payment received (${input.mode})`,
      reference: input.reference ?? null,
      qty: 1,
      unitAmount: sign * amount,
      amount: sign * amount,
      gstRate: 0,
      total: sign * amount,
      payMode: input.mode,
      postedBy: byUsername,
    },
  });

  if (folio.bookingId) {
    await db.payment.create({
      data: {
        bookingId: folio.bookingId,
        gateway: 'erp',
        mode: 'live',
        referenceNo: input.reference || line.id,
        amount,
        status: input.isRefund ? 'refunded' : 'paid',
        method: input.mode,
        rawPayload: JSON.stringify({ folioId: folio.id, folioLineId: line.id, by: byUsername }),
      },
    });
    const booking = await db.booking.findUnique({ where: { id: folio.bookingId } });
    if (booking) {
      const paid = round2(booking.amountPaid + (input.isRefund ? -amount : amount));
      await db.booking.update({
        where: { id: booking.id },
        data: {
          amountPaid: paid,
          paymentStatus: paid <= 0 ? 'unpaid' : paid + 0.01 >= booking.totalAmount ? 'paid' : 'partial',
        },
      });
    }
  }

  return line;
}

export interface FolioTotals {
  charges: number;
  tax: number;
  chargesWithTax: number;
  payments: number;
  refunds: number;
  balance: number;
}

export function folioTotals(lines: FolioLine[]): FolioTotals {
  let charges = 0, tax = 0, chargesWithTax = 0, payments = 0, refunds = 0, balance = 0;
  for (const line of lines) {
    if (line.isVoid) continue;
    balance = round2(balance + line.total);
    if (line.type === 'payment') payments = round2(payments + Math.abs(line.total));
    else if (line.type === 'refund') refunds = round2(refunds + line.total);
    else {
      charges = round2(charges + line.amount);
      tax = round2(tax + line.cgst + line.sgst + line.igst);
      chargesWithTax = round2(chargesWithTax + line.total);
    }
  }
  return { charges, tax, chargesWithTax, payments, refunds, balance };
}

/**
 * Post the nightly room charge for every stay date not posted yet, up to
 * (and excluding) `untilDate`. Taxable value per night is the booking's net
 * room revenue divided across nights; GST comes from the tariff slabs.
 */
export async function postMissingRoomNights(
  booking: Booking,
  folio: Folio,
  untilDate: string,
  settings: ErpSettings,
  byUsername: string,
): Promise<number> {
  const checkIn = istDate(booking.checkIn);
  const checkOut = istDate(booking.checkOut);
  const nights = Math.max(1, booking.nights);
  const perNight = round2(
    Math.max(0, booking.roomTotal + booking.extraGuestTotal + booking.feeAmount - booking.discountAmount) / nights,
  );

  const existing = await db.folioLine.findMany({
    where: { folioId: folio.id, type: 'room', isVoid: false },
    select: { date: true },
  });
  const posted = new Set(existing.map((l) => l.date));

  let count = 0;
  for (let d = checkIn; d < checkOut && d < untilDate; d = nextDay(d)) {
    if (posted.has(d)) continue;
    await postCharge(
      folio.id,
      {
        type: 'room',
        description: `Room charge — ${booking.roomType}${booking.unitId ? '' : ''} (${d})`,
        qty: 1,
        unitAmount: perNight,
        date: d,
        reference: booking.bookingRef,
      },
      settings,
      byUsername,
    );
    count += 1;
  }
  return count;
}

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Pull website / gateway payments (Razorpay, Eazypay, admin-recorded) into
 * the folio as payment lines. Idempotent: each Payment row lands once, keyed
 * by its id in the line reference.
 */
export async function syncGatewayPaymentsToFolio(
  booking: Booking,
  folio: Folio,
  byUsername: string,
): Promise<number> {
  const paid = await db.payment.findMany({
    where: { bookingId: booking.id, status: 'paid', NOT: { gateway: 'erp' } },
  });
  if (!paid.length) return 0;
  const existing = await db.folioLine.findMany({
    where: { folioId: folio.id, type: 'payment' },
    select: { reference: true },
  });
  const seen = new Set(existing.map((l) => l.reference));
  let count = 0;
  for (const payment of paid) {
    const ref = `pay:${payment.id}`;
    if (seen.has(ref)) continue;
    await db.folioLine.create({
      data: {
        folioId: folio.id,
        date: istDate(payment.createdAt),
        type: 'payment',
        description: `Online payment (${payment.gateway})`,
        reference: ref,
        qty: 1,
        unitAmount: -payment.amount,
        amount: -payment.amount,
        gstRate: 0,
        total: -payment.amount,
        payMode: 'gateway',
        postedBy: byUsername,
      },
    });
    count += 1;
  }
  return count;
}

export interface InvoiceLineSnapshot {
  description: string;
  hsnSac: string;
  qty: number;
  rate: number;
  taxable: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

/** Issue a GST tax invoice from the folio's un-voided charge lines. */
export async function issueInvoiceForFolio(
  folio: Folio & { lines: FolioLine[] },
  buyer: { name?: string; gstin?: string; address?: string; placeOfSupply?: string },
  byUsername: string,
): Promise<{ id: string; invoiceNo: string }> {
  const chargeLines = folio.lines.filter(
    (l) => !l.isVoid && l.type !== 'payment' && l.type !== 'refund',
  );
  if (!chargeLines.length) throw new Error('Nothing to invoice on this folio');

  const snapshots: InvoiceLineSnapshot[] = chargeLines.map((l) => ({
    description: l.description,
    hsnSac: l.hsnSac ?? '',
    qty: l.qty,
    rate: l.unitAmount,
    taxable: l.amount,
    gstRate: l.gstRate,
    cgst: l.cgst,
    sgst: l.sgst,
    igst: l.igst,
    total: l.total,
  }));

  const taxable = round2(snapshots.reduce((s, l) => s + l.taxable, 0));
  const cgst = round2(snapshots.reduce((s, l) => s + l.cgst, 0));
  const sgst = round2(snapshots.reduce((s, l) => s + l.sgst, 0));
  const igst = round2(snapshots.reduce((s, l) => s + l.igst, 0));
  const raw = round2(taxable + cgst + sgst + igst);
  const total = Math.round(raw);
  const roundOff = round2(total - raw);

  const invoiceNo = await nextDocNo('INV');
  const invoice = await db.taxInvoice.create({
    data: {
      invoiceNo,
      fy: `20${invoiceNo.split('/')[1]}`,
      folioId: folio.id,
      source: folio.banquetId ? 'banquet' : 'folio',
      buyerName: buyer.name || folio.guestName,
      buyerGstin: buyer.gstin || null,
      buyerAddress: buyer.address || null,
      placeOfSupply: buyer.placeOfSupply || null,
      lines: JSON.stringify(snapshots),
      taxable,
      cgst,
      sgst,
      igst,
      roundOff,
      total,
      amountInWords: amountInWordsINR(total),
      issuedBy: byUsername,
      issuedAt: new Date(),
    },
  });
  return { id: invoice.id, invoiceNo: invoice.invoiceNo };
}
