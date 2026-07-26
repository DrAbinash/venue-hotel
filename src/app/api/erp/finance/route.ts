import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { nextDocNo } from '@/lib/erp/numbering';
import { addDays, istDate } from '@/lib/erp/dates';
import { round2 } from '@/lib/erp/gst';

export const dynamic = 'force-dynamic';

/**
 * GET — the money picture for a date range (default: this month so far):
 * invoices, expenses, collections by mode, GST outward summary.
 *
 * CSV exports (?export=…&from&to):
 *   invoices  — tax invoice register
 *   gstr1     — outward supplies grouped for GSTR-1 filing
 *   police    — Form-F style guest register from reg cards
 *   formc     — foreign guests (Form C / FRRO)
 */
export async function GET(request: NextRequest) {
  const auth = await erpGuard('finance');
  if (auth.denied) return auth.denied;
  const params = request.nextUrl.searchParams;
  const today = istDate();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') ?? '') ? params.get('from')! : `${today.slice(0, 7)}-01`;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') ?? '') ? params.get('to')! : today;
  const exportKind = params.get('export');

  if (exportKind) return exportCsv(exportKind, from, to);

  const fromDt = new Date(`${from}T00:00:00Z`);
  const toDt = new Date(`${addDays(to, 1)}T00:00:00Z`);

  const [invoices, expenses, payments, orders, roomLines] = await Promise.all([
    db.taxInvoice.findMany({
      where: { issuedAt: { gte: fromDt, lt: toDt } },
      orderBy: { issuedAt: 'desc' },
    }),
    db.expense.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    db.payment.findMany({
      where: { status: 'paid', createdAt: { gte: fromDt, lt: toDt } },
    }),
    db.foodOrder.findMany({
      where: { createdAt: { gte: fromDt, lt: toDt }, status: { not: 'cancelled' } },
      select: { totalAmount: true, taxAmount: true, paymentMethod: true },
    }),
    db.folioLine.findMany({
      where: { type: 'room', isVoid: false, date: { gte: from, lte: to } },
      select: { amount: true, cgst: true, sgst: true, total: true },
    }),
  ]);

  const collections: Record<string, number> = {};
  for (const p of payments) {
    const mode = p.gateway === 'erp' ? (p.method ?? 'cash') : p.gateway;
    collections[mode] = round2((collections[mode] ?? 0) + p.amount);
  }
  const expenseTotal = round2(expenses.reduce((s, e) => s + e.amount, 0));
  const collected = round2(Object.values(collections).reduce((s, v) => s + v, 0));

  const gstByRate = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const inv of invoices) {
    if (inv.status === 'cancelled') continue;
    try {
      for (const line of JSON.parse(inv.lines) as { gstRate: number; taxable: number; cgst: number; sgst: number; igst: number }[]) {
        const bucket = gstByRate.get(line.gstRate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        bucket.taxable = round2(bucket.taxable + line.taxable);
        bucket.cgst = round2(bucket.cgst + line.cgst);
        bucket.sgst = round2(bucket.sgst + line.sgst);
        bucket.igst = round2(bucket.igst + line.igst);
        gstByRate.set(line.gstRate, bucket);
      }
    } catch { /* ignore malformed snapshot */ }
  }

  return NextResponse.json({
    from, to,
    invoices,
    expenses,
    summary: {
      roomRevenue: round2(roomLines.reduce((s, l) => s + l.amount, 0)),
      roomTax: round2(roomLines.reduce((s, l) => s + l.cgst + l.sgst, 0)),
      fnbSales: round2(orders.reduce((s, o) => s + o.totalAmount, 0)),
      fnbTax: round2(orders.reduce((s, o) => s + o.taxAmount, 0)),
      invoiceTotal: round2(invoices.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0)),
      collections,
      collected,
      expenseTotal,
      netCash: round2(collected - expenseTotal),
    },
    gstSummary: [...gstByRate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, v]) => ({ rate, ...v, tax: round2(v.cgst + v.sgst + v.igst) })),
  });
}

/** POST — { action: "expense_save" | "expense_delete" | "invoice_cancel", ... } */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('finance');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'expense_save') {
      const payee = String(body.payee ?? '').trim();
      const amount = Number(body.amount);
      if (!payee) return NextResponse.json({ error: 'Payee is required' }, { status: 400 });
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
      const data = {
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? String(body.date) : istDate(),
        category: String(body.category ?? 'other').slice(0, 30),
        payee: payee.slice(0, 120),
        description: body.description ? String(body.description).slice(0, 300) : null,
        amount: round2(amount),
        gstAmount: Math.max(0, round2(Number(body.gstAmount) || 0)),
        tdsAmount: Math.max(0, round2(Number(body.tdsAmount) || 0)),
        mode: ['cash', 'upi', 'bank', 'card', 'cheque'].includes(String(body.mode)) ? String(body.mode) : 'cash',
        reference: body.reference ? String(body.reference).slice(0, 60) : null,
        supplierGstin: body.supplierGstin ? String(body.supplierGstin).toUpperCase().slice(0, 15) : null,
        billNo: body.billNo ? String(body.billNo).slice(0, 40) : null,
        department: body.department ? String(body.department).slice(0, 30) : null,
      };
      if (body.id) {
        await db.expense.update({ where: { id: String(body.id) }, data });
        return NextResponse.json({ ok: true });
      }
      const expense = await db.expense.create({
        data: { ...data, voucherNo: await nextDocNo('EXP'), createdBy: session.username },
      });
      await logAudit(session, 'finance.expense', {
        entity: 'Expense', entityId: expense.id,
        summary: `${expense.voucherNo}: ₹${expense.amount.toFixed(2)} to ${payee} (${expense.category})`,
      });
      return NextResponse.json({ ok: true, expense });
    }

    if (action === 'expense_delete') {
      const expense = await db.expense.findUnique({ where: { id: String(body.id ?? '') } });
      if (!expense) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
      await db.expense.delete({ where: { id: expense.id } });
      await logAudit(session, 'finance.expense_delete', {
        entity: 'Expense', entityId: expense.id,
        summary: `${expense.voucherNo} deleted (₹${expense.amount.toFixed(2)} to ${expense.payee})`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'invoice_cancel') {
      const invoice = await db.taxInvoice.findUnique({ where: { id: String(body.id ?? '') } });
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      if (invoice.status === 'cancelled') return NextResponse.json({ error: 'Already cancelled' }, { status: 400 });
      const reason = String(body.reason ?? '').trim();
      if (!reason) return NextResponse.json({ error: 'A cancellation reason is required' }, { status: 400 });
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: { status: 'cancelled', cancelReason: reason.slice(0, 300) },
      });
      await logAudit(session, 'finance.invoice_cancel', {
        entity: 'TaxInvoice', entityId: invoice.id,
        summary: `Invoice ${invoice.invoiceNo} cancelled — ${reason}`,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('finance action failed', action, error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
//  CSV exports
// ---------------------------------------------------------------------------

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvResponse(filename: string, header: string[], rows: unknown[][]): NextResponse {
  const body = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
  return new NextResponse(`﻿${body}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

async function exportCsv(kind: string, from: string, to: string): Promise<NextResponse> {
  const fromDt = new Date(`${from}T00:00:00Z`);
  const toDt = new Date(`${addDays(to, 1)}T00:00:00Z`);

  if (kind === 'invoices') {
    const invoices = await db.taxInvoice.findMany({
      where: { issuedAt: { gte: fromDt, lt: toDt } },
      orderBy: { issuedAt: 'asc' },
    });
    return csvResponse(`invoice-register-${from}-to-${to}.csv`,
      ['Invoice No', 'Date', 'Buyer', 'Buyer GSTIN', 'Source', 'Taxable', 'CGST', 'SGST', 'IGST', 'Round Off', 'Total', 'Status'],
      invoices.map((i) => [
        i.invoiceNo, istDate(i.issuedAt), i.buyerName, i.buyerGstin ?? '', i.source,
        i.taxable, i.cgst, i.sgst, i.igst, i.roundOff, i.total, i.status,
      ]));
  }

  if (kind === 'gstr1') {
    const invoices = await db.taxInvoice.findMany({
      where: { issuedAt: { gte: fromDt, lt: toDt }, status: 'issued' },
      orderBy: { issuedAt: 'asc' },
    });
    const rows: unknown[][] = [];
    for (const inv of invoices) {
      try {
        const byRate = new Map<string, { taxable: number; cgst: number; sgst: number; igst: number; hsn: string }>();
        for (const line of JSON.parse(inv.lines) as { gstRate: number; taxable: number; cgst: number; sgst: number; igst: number; hsnSac: string }[]) {
          const key = `${line.gstRate}|${line.hsnSac}`;
          const bucket = byRate.get(key) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, hsn: line.hsnSac };
          bucket.taxable = round2(bucket.taxable + line.taxable);
          bucket.cgst = round2(bucket.cgst + line.cgst);
          bucket.sgst = round2(bucket.sgst + line.sgst);
          bucket.igst = round2(bucket.igst + line.igst);
          byRate.set(key, bucket);
        }
        for (const [key, v] of byRate) {
          rows.push([
            inv.invoiceNo, istDate(inv.issuedAt),
            inv.buyerGstin ? 'B2B' : 'B2C',
            inv.buyerName, inv.buyerGstin ?? '',
            v.hsn, key.split('|')[0], v.taxable, v.cgst, v.sgst, v.igst,
            round2(v.taxable + v.cgst + v.sgst + v.igst),
          ]);
        }
      } catch { /* skip malformed */ }
    }
    return csvResponse(`gstr1-outward-${from}-to-${to}.csv`,
      ['Invoice No', 'Date', 'Type', 'Buyer', 'Buyer GSTIN', 'HSN/SAC', 'Rate %', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
      rows);
  }

  if (kind === 'police') {
    const cards = await db.regCard.findMany({
      where: { checkedInAt: { gte: fromDt, lt: toDt } },
      include: { booking: { include: { unit: true } } },
      orderBy: { checkedInAt: 'asc' },
    });
    return csvResponse(`guest-register-${from}-to-${to}.csv`,
      ['Sl', 'Guest Name', 'Nationality', 'ID Type', 'ID Number', 'Address', 'City', 'State', 'Arrival From', 'Next Destination', 'Purpose', 'Room', 'Check-in', 'Check-out', 'Adults', 'Children', 'Phone'],
      cards.map((c, i) => [
        i + 1, c.guestName, c.nationality, c.idType.replace(/_/g, ' '), c.idNumber,
        c.address ?? '', c.city ?? '', c.state ?? '', c.arrivalFrom ?? '', c.nextDestination ?? '',
        c.purposeOfVisit, c.booking.unit?.unitNumber ?? '', istDate(c.booking.checkIn), istDate(c.booking.checkOut),
        c.booking.adults, c.booking.children, c.booking.guestPhone,
      ]));
  }

  if (kind === 'formc') {
    const cards = await db.regCard.findMany({
      where: { isForeigner: true, checkedInAt: { gte: fromDt, lt: toDt } },
      include: { booking: { include: { unit: true } } },
      orderBy: { checkedInAt: 'asc' },
    });
    return csvResponse(`form-c-foreign-guests-${from}-to-${to}.csv`,
      ['Sl', 'Guest Name', 'Nationality', 'Passport No', 'Passport Issued At', 'Passport Issue Date', 'Passport Expiry', 'Visa No', 'Visa Type', 'Visa Expiry', 'Arrived From (Country)', 'Date of Arrival in India', 'Room', 'Check-in', 'Check-out', 'Purpose', 'FRRO Ref'],
      cards.map((c, i) => [
        i + 1, c.guestName, c.nationality, c.passportNo ?? '', c.passportIssuePlace ?? '', c.passportIssueDate ?? '',
        c.passportExpiry ?? '', c.visaNo ?? '', c.visaType ?? '', c.visaExpiry ?? '',
        c.arrivedFromCountry ?? '', c.arrivalDateInIndia ?? '', c.booking.unit?.unitNumber ?? '',
        istDate(c.booking.checkIn), istDate(c.booking.checkOut), c.purposeOfVisit, c.formCRef ?? '',
      ]));
  }

  if (kind === 'expenses') {
    const expenses = await db.expense.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    return csvResponse(`expenses-${from}-to-${to}.csv`,
      ['Voucher', 'Date', 'Category', 'Payee', 'Description', 'Amount', 'GST', 'TDS', 'Mode', 'Bill No', 'Supplier GSTIN', 'Department'],
      expenses.map((e) => [
        e.voucherNo, e.date, e.category, e.payee, e.description ?? '', e.amount,
        e.gstAmount, e.tdsAmount, e.mode, e.billNo ?? '', e.supplierGstin ?? '', e.department ?? '',
      ]));
  }

  return NextResponse.json({ error: 'Unknown export' }, { status: 400 });
}
