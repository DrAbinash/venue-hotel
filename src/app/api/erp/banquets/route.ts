import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { nextDocNo } from '@/lib/erp/numbering';
import { istDate } from '@/lib/erp/dates';
import { amountInWordsINR, round2, splitGst } from '@/lib/erp/gst';
import { getErpSettings, erpNumber } from '@/lib/erp/settings';

export const dynamic = 'force-dynamic';

const EVENT_STATUSES = ['enquiry', 'tentative', 'confirmed', 'completed', 'cancelled'];
const BLOCKING = ['tentative', 'confirmed'];

function computeEventTotal(b: {
  pax: number; ratePerPlate: number; hallRent: number; decorationAmount: number;
  otherCharges: number; discountAmount: number; gstRate: number;
}, miscRate: number): number {
  const catering = round2(b.pax * b.ratePerPlate + b.decorationAmount + b.otherCharges - b.discountAmount);
  const cateringTax = splitGst(Math.max(0, catering), b.gstRate).tax;
  const rentTax = splitGst(b.hallRent, miscRate).tax;
  return round2(Math.max(0, catering) + cateringTax + b.hallRent + rentTax);
}

/** GET — halls and the events diary. */
export async function GET() {
  const auth = await erpGuard('banquets');
  if (auth.denied) return auth.denied;
  const [halls, bookings] = await Promise.all([
    db.banquetHall.findMany({ orderBy: { name: 'asc' } }),
    db.banquetBooking.findMany({
      include: { hall: { select: { name: true } } },
      orderBy: { eventDate: 'desc' },
      take: 200,
    }),
  ]);
  return NextResponse.json({ halls, bookings });
}

/**
 * POST — { action: "hall_save" | "booking_save" | "booking_status" |
 *          "booking_payment" | "booking_invoice", ... }
 */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('banquets');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'hall_save') {
      const name = String(body.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'Hall name is required' }, { status: 400 });
      const data = {
        name: name.slice(0, 80),
        capacitySeating: Math.max(0, Number(body.capacitySeating) || 0),
        capacityFloating: Math.max(0, Number(body.capacityFloating) || 0),
        area: body.area ? String(body.area).slice(0, 40) : null,
        baseRent: Math.max(0, Number(body.baseRent) || 0),
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      };
      if (body.id) {
        await db.banquetHall.update({ where: { id: String(body.id) }, data });
        return NextResponse.json({ ok: true });
      }
      const hall = await db.banquetHall.create({ data });
      return NextResponse.json({ ok: true, hall });
    }

    if (action === 'booking_save') {
      const hall = await db.banquetHall.findUnique({ where: { id: String(body.hallId ?? '') } });
      if (!hall) return NextResponse.json({ error: 'Pick a hall' }, { status: 400 });
      const eventDate = String(body.eventDate ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return NextResponse.json({ error: 'Bad event date' }, { status: 400 });
      const customerName = String(body.customerName ?? '').trim();
      const customerPhone = String(body.customerPhone ?? '').trim();
      if (!customerName || customerPhone.length < 7) {
        return NextResponse.json({ error: 'Customer name and phone are required' }, { status: 400 });
      }

      const existingId = body.id ? String(body.id) : null;
      const status = EVENT_STATUSES.includes(String(body.status)) ? String(body.status) : 'enquiry';
      if (BLOCKING.includes(status)) {
        const clash = await db.banquetBooking.findFirst({
          where: {
            hallId: hall.id, eventDate, status: { in: BLOCKING },
            ...(existingId ? { id: { not: existingId } } : {}),
          },
        });
        if (clash && !body.force) {
          return NextResponse.json({
            error: `${hall.name} already has "${clash.eventType}" for ${clash.customerName} on ${eventDate} (${clash.status}). Confirm to double-book.`,
            needsForce: true,
          }, { status: 409 });
        }
      }

      const settings = await getErpSettings();
      const fields = {
        hallId: hall.id,
        eventDate,
        startTime: String(body.startTime ?? '18:00').slice(0, 5),
        endTime: String(body.endTime ?? '23:00').slice(0, 5),
        eventType: String(body.eventType ?? 'wedding').slice(0, 30),
        customerName: customerName.slice(0, 100),
        customerPhone: customerPhone.slice(0, 20),
        customerEmail: body.customerEmail ? String(body.customerEmail).slice(0, 120) : null,
        customerGstin: body.customerGstin ? String(body.customerGstin).toUpperCase().slice(0, 15) : null,
        customerAddress: body.customerAddress ? String(body.customerAddress).slice(0, 300) : null,
        pax: Math.max(1, Number(body.pax) || 100),
        ratePerPlate: Math.max(0, Number(body.ratePerPlate) || 0),
        hallRent: Math.max(0, Number(body.hallRent) || 0),
        decorationAmount: Math.max(0, Number(body.decorationAmount) || 0),
        otherCharges: Math.max(0, Number(body.otherCharges) || 0),
        discountAmount: Math.max(0, Number(body.discountAmount) || 0),
        gstRate: body.gstRate !== undefined && body.gstRate !== '' ? Math.max(0, Number(body.gstRate)) : erpNumber(settings, 'erpBanquetGstRate', 5),
        menuNotes: body.menuNotes ? String(body.menuNotes).slice(0, 1000) : null,
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
        status,
      };
      const totalAmount = computeEventTotal(fields, erpNumber(settings, 'erpMiscGstRate', 18));

      if (existingId) {
        await db.banquetBooking.update({ where: { id: existingId }, data: { ...fields, totalAmount } });
        return NextResponse.json({ ok: true });
      }
      const booking = await db.banquetBooking.create({
        data: { ...fields, totalAmount, eventRef: await nextDocNo('EVT'), createdBy: session.username },
      });
      await logAudit(session, 'banquets.create', {
        entity: 'BanquetBooking', entityId: booking.id,
        summary: `${booking.eventRef}: ${booking.eventType} for ${customerName}, ${hall.name} on ${eventDate} (₹${totalAmount.toFixed(2)})`,
      });
      return NextResponse.json({ ok: true, booking });
    }

    const booking = await db.banquetBooking.findUnique({ where: { id: String(body.id ?? '') }, include: { hall: true } });
    if (!booking) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    if (action === 'booking_status') {
      const status = String(body.status ?? '');
      if (!EVENT_STATUSES.includes(status)) return NextResponse.json({ error: 'Bad status' }, { status: 400 });
      await db.banquetBooking.update({ where: { id: booking.id }, data: { status } });
      await logAudit(session, 'banquets.status', {
        entity: 'BanquetBooking', entityId: booking.id, summary: `${booking.eventRef} → ${status}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'booking_payment') {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
      let payments: { date: string; amount: number; mode: string; ref: string | null }[] = [];
      try { payments = JSON.parse(booking.payments || '[]'); } catch { payments = []; }
      payments.push({
        date: istDate(),
        amount: round2(amount),
        mode: String(body.mode ?? 'cash').slice(0, 15),
        ref: body.reference ? String(body.reference).slice(0, 60) : null,
      });
      const advancePaid = round2(payments.reduce((s, p) => s + p.amount, 0));
      await db.banquetBooking.update({
        where: { id: booking.id },
        data: { payments: JSON.stringify(payments), advancePaid },
      });
      await logAudit(session, 'banquets.payment', {
        entity: 'BanquetBooking', entityId: booking.id,
        summary: `${booking.eventRef}: received ₹${round2(amount).toFixed(2)} (${body.mode ?? 'cash'})`,
      });
      return NextResponse.json({ ok: true, advancePaid });
    }

    if (action === 'booking_invoice') {
      const settings = await getErpSettings();
      const miscRate = erpNumber(settings, 'erpMiscGstRate', 18);
      const lines: Record<string, unknown>[] = [];
      let taxable = 0, cgst = 0, sgst = 0;

      const push = (description: string, hsnSac: string, qty: number, rate: number, amount: number, gstRate: number) => {
        if (Math.abs(amount) < 0.01) return;
        const split = splitGst(Math.abs(amount), gstRate);
        const sign = amount < 0 ? -1 : 1;
        lines.push({
          description, hsnSac, qty, rate,
          taxable: round2(sign * split.taxable), gstRate,
          cgst: round2(sign * split.cgst), sgst: round2(sign * split.sgst), igst: 0,
          total: round2(sign * split.total),
        });
        taxable = round2(taxable + sign * split.taxable);
        cgst = round2(cgst + sign * split.cgst);
        sgst = round2(sgst + sign * split.sgst);
      };

      push(`${booking.eventType} — catering (${booking.pax} pax @ ₹${booking.ratePerPlate})`, settings.erpSacBanquet || '996334', booking.pax, booking.ratePerPlate, round2(booking.pax * booking.ratePerPlate), booking.gstRate);
      push(`Hall rent — ${booking.hall.name}`, settings.erpSacMisc || '997212', 1, booking.hallRent, booking.hallRent, miscRate);
      push('Decoration', settings.erpSacBanquet || '996334', 1, booking.decorationAmount, booking.decorationAmount, booking.gstRate);
      push('Other charges', settings.erpSacBanquet || '996334', 1, booking.otherCharges, booking.otherCharges, booking.gstRate);
      push('Discount', settings.erpSacBanquet || '996334', 1, -booking.discountAmount, -booking.discountAmount, booking.gstRate);
      if (!lines.length) return NextResponse.json({ error: 'Nothing to invoice' }, { status: 400 });

      const raw = round2(taxable + cgst + sgst);
      const total = Math.round(raw);
      const invoice = await db.taxInvoice.create({
        data: {
          invoiceNo: await nextDocNo('INV'),
          fy: `20${fyPart(istDate())}`,
          source: 'banquet',
          buyerName: booking.customerName,
          buyerGstin: booking.customerGstin,
          buyerAddress: booking.customerAddress,
          lines: JSON.stringify(lines),
          taxable, cgst, sgst, igst: 0,
          roundOff: round2(total - raw),
          total,
          amountInWords: amountInWordsINR(total),
          issuedBy: session.username,
        },
      });
      await logAudit(session, 'banquets.invoice', {
        entity: 'TaxInvoice', entityId: invoice.id,
        summary: `Invoice ${invoice.invoiceNo} issued for ${booking.eventRef} (₹${total.toFixed(2)})`,
      });
      return NextResponse.json({ ok: true, invoiceId: invoice.id, invoiceNo: invoice.invoiceNo });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('banquets action failed', action, error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

function fyPart(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`.slice(2);
}
