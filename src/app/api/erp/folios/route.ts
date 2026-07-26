import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { getErpSettings } from '@/lib/erp/settings';
import {
  folioTotals, issueInvoiceForFolio, postCharge, postPayment,
  type ChargeType, type PayMode,
} from '@/lib/erp/folio';
import { istDate } from '@/lib/erp/dates';

export const dynamic = 'force-dynamic';

const CHARGE_TYPES: ChargeType[] = ['room', 'fnb', 'banquet', 'laundry', 'minibar', 'spa', 'transport', 'misc', 'discount'];

/**
 * GET ?id=…            — one folio with lines, totals and invoices.
 * GET ?status=open     — folio register.
 */
export async function GET(request: NextRequest) {
  const auth = await erpGuard('frontdesk');
  if (auth.denied) return auth.denied;
  const params = request.nextUrl.searchParams;
  const id = params.get('id');

  if (id) {
    const folio = await db.folio.findUnique({
      where: { id },
      include: {
        lines: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
        invoices: { orderBy: { issuedAt: 'desc' } },
        booking: { include: { unit: true, regCard: true } },
        banquet: true,
      },
    });
    if (!folio) return NextResponse.json({ error: 'Folio not found' }, { status: 404 });
    return NextResponse.json({ folio, totals: folioTotals(folio.lines) });
  }

  const status = params.get('status') || undefined;
  const folios = await db.folio.findMany({
    where: status ? { status } : undefined,
    include: {
      lines: true,
      booking: { select: { bookingRef: true, guestPhone: true, status: true, unit: { select: { unitNumber: true } } } },
    },
    orderBy: { openedAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({
    folios: folios.map((f) => ({
      id: f.id,
      folioNo: f.folioNo,
      guestName: f.guestName,
      status: f.status,
      openedAt: f.openedAt,
      closedAt: f.closedAt,
      bookingRef: f.booking?.bookingRef ?? null,
      unitNumber: f.booking?.unit?.unitNumber ?? null,
      bookingStatus: f.booking?.status ?? null,
      totals: folioTotals(f.lines),
    })),
  });
}

/**
 * POST — { action: "charge" | "payment" | "refund" | "void_line" | "invoice" | "settle" | "reopen", ... }
 */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('frontdesk');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  const folio = await db.folio.findUnique({
    where: { id: String(body.folioId ?? '') },
    include: { lines: true },
  });
  if (!folio) return NextResponse.json({ error: 'Folio not found' }, { status: 404 });

  try {
    if (action === 'charge') {
      if (folio.status !== 'open') return NextResponse.json({ error: 'Folio is closed' }, { status: 400 });
      const type = String(body.type ?? 'misc') as ChargeType;
      if (!CHARGE_TYPES.includes(type)) return NextResponse.json({ error: 'Bad charge type' }, { status: 400 });
      const description = String(body.description ?? '').trim();
      if (!description) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
      const unitAmount = Number(body.unitAmount);
      if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
      }
      const settings = await getErpSettings();
      const line = await postCharge(folio.id, {
        type,
        description,
        qty: Math.max(0.01, Number(body.qty) || 1),
        unitAmount,
        date: body.date ? String(body.date) : istDate(),
        reference: body.reference ? String(body.reference) : undefined,
        gstRateOverride: body.gstRate !== undefined && body.gstRate !== '' ? Number(body.gstRate) : undefined,
      }, settings, session.username);
      await logAudit(session, 'folio.charge', {
        entity: 'Folio', entityId: folio.id,
        summary: `${folio.folioNo}: ${type} charge "${description}" ₹${line.total.toFixed(2)}`,
      });
      return NextResponse.json({ ok: true, line });
    }

    if (action === 'payment' || action === 'refund') {
      if (folio.status !== 'open') return NextResponse.json({ error: 'Folio is closed' }, { status: 400 });
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
      }
      const line = await postPayment(folio, {
        amount,
        mode: String(body.mode ?? 'cash') as PayMode,
        reference: body.reference ? String(body.reference) : undefined,
        isRefund: action === 'refund',
      }, session.username);
      await logAudit(session, `folio.${action}`, {
        entity: 'Folio', entityId: folio.id,
        summary: `${folio.folioNo}: ${action} ₹${Math.abs(line.total).toFixed(2)} (${body.mode ?? 'cash'})`,
      });
      return NextResponse.json({ ok: true, line });
    }

    if (action === 'void_line') {
      const line = await db.folioLine.findUnique({ where: { id: String(body.lineId ?? '') } });
      if (!line || line.folioId !== folio.id) return NextResponse.json({ error: 'Line not found' }, { status: 404 });
      if (line.isVoid) return NextResponse.json({ error: 'Line is already void' }, { status: 400 });
      if (line.type === 'payment' || line.type === 'refund') {
        return NextResponse.json({ error: 'Payments cannot be voided — record a refund instead' }, { status: 400 });
      }
      const reason = String(body.reason ?? '').trim();
      if (!reason) return NextResponse.json({ error: 'A void reason is required' }, { status: 400 });
      await db.folioLine.update({ where: { id: line.id }, data: { isVoid: true, voidReason: reason.slice(0, 200) } });
      await logAudit(session, 'folio.void_line', {
        entity: 'Folio', entityId: folio.id,
        summary: `${folio.folioNo}: voided "${line.description}" (₹${line.total.toFixed(2)}) — ${reason}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'invoice') {
      const result = await issueInvoiceForFolio(folio, {
        name: body.buyerName ? String(body.buyerName) : undefined,
        gstin: body.buyerGstin ? String(body.buyerGstin).toUpperCase() : undefined,
        address: body.buyerAddress ? String(body.buyerAddress) : undefined,
        placeOfSupply: body.placeOfSupply ? String(body.placeOfSupply) : undefined,
      }, session.username);
      await logAudit(session, 'folio.invoice', {
        entity: 'TaxInvoice', entityId: result.id,
        summary: `Invoice ${result.invoiceNo} issued for ${folio.folioNo}`,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'settle') {
      const totals = folioTotals(folio.lines);
      if (Math.abs(totals.balance) > 0.5 && !body.force) {
        return NextResponse.json({ error: `Balance is ₹${totals.balance.toFixed(2)} — collect or refund first`, needsForce: true }, { status: 409 });
      }
      await db.folio.update({ where: { id: folio.id }, data: { status: 'settled', closedAt: new Date() } });
      await logAudit(session, 'folio.settle', {
        entity: 'Folio', entityId: folio.id, summary: `${folio.folioNo} settled`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'reopen') {
      await db.folio.update({ where: { id: folio.id }, data: { status: 'open', closedAt: null } });
      await logAudit(session, 'folio.reopen', {
        entity: 'Folio', entityId: folio.id, summary: `${folio.folioNo} reopened`,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('folio action failed', action, error);
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
