import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { nextDocNo, nextSeq } from '@/lib/erp/numbering';
import { round2 } from '@/lib/erp/gst';

export const dynamic = 'force-dynamic';

/** GET — items, suppliers, purchase orders and the recent stock ledger. */
export async function GET(request: NextRequest) {
  const auth = await erpGuard('inventory');
  if (auth.denied) return auth.denied;
  const itemId = request.nextUrl.searchParams.get('ledgerItem');

  const [items, suppliers, purchaseOrders, ledger] = await Promise.all([
    db.inventoryItem.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    db.supplier.findMany({ orderBy: { name: 'asc' } }),
    db.purchaseOrder.findMany({
      include: { supplier: { select: { name: true } }, lines: { include: { item: { select: { name: true, unit: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.stockLedger.findMany({
      where: itemId ? { itemId } : undefined,
      include: { item: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 150,
    }),
  ]);

  return NextResponse.json({
    items,
    suppliers,
    purchaseOrders,
    ledger,
    lowStock: items.filter((i) => i.isActive && i.reorderLevel > 0 && i.currentStock <= i.reorderLevel),
  });
}

/**
 * POST — { action: "item_save" | "supplier_save" | "po_create" | "po_status" |
 *          "grn" | "issue" | "adjust", ... }
 */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('inventory');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'item_save') {
      const name = String(body.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
      const data = {
        name: name.slice(0, 120),
        category: String(body.category ?? 'general').slice(0, 30),
        unit: String(body.unit ?? 'pcs').slice(0, 15),
        hsn: body.hsn ? String(body.hsn).slice(0, 12) : null,
        gstRate: Math.max(0, Number(body.gstRate) || 0),
        reorderLevel: Math.max(0, Number(body.reorderLevel) || 0),
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      };
      if (body.id) {
        await db.inventoryItem.update({ where: { id: String(body.id) }, data });
        return NextResponse.json({ ok: true });
      }
      const item = await db.inventoryItem.create({
        data: { ...data, code: `ITM-${String(await nextSeq('ITEM')).padStart(4, '0')}` },
      });
      const opening = Math.max(0, Number(body.openingStock) || 0);
      if (opening > 0) {
        await applyStockMove(item.id, 'opening', opening, Math.max(0, Number(body.openingCost) || 0), 'Opening stock', null, session.username);
      }
      return NextResponse.json({ ok: true, item });
    }

    if (action === 'supplier_save') {
      const name = String(body.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
      const data = {
        name: name.slice(0, 120),
        contactPerson: body.contactPerson ? String(body.contactPerson).slice(0, 80) : null,
        phone: body.phone ? String(body.phone).slice(0, 20) : null,
        email: body.email ? String(body.email).slice(0, 120) : null,
        address: body.address ? String(body.address).slice(0, 300) : null,
        gstin: body.gstin ? String(body.gstin).toUpperCase().slice(0, 15) : null,
        state: body.state ? String(body.state).slice(0, 40) : null,
        paymentTermDays: Math.max(0, Math.min(365, Number(body.paymentTermDays) || 0)),
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        notes: body.notes ? String(body.notes).slice(0, 300) : null,
      };
      if (body.id) {
        await db.supplier.update({ where: { id: String(body.id) }, data });
        return NextResponse.json({ ok: true });
      }
      const supplier = await db.supplier.create({ data });
      return NextResponse.json({ ok: true, supplier });
    }

    if (action === 'po_create') {
      const supplier = await db.supplier.findUnique({ where: { id: String(body.supplierId ?? '') } });
      if (!supplier) return NextResponse.json({ error: 'Pick a supplier' }, { status: 400 });
      const rawLines = Array.isArray(body.lines) ? body.lines : [];
      if (!rawLines.length) return NextResponse.json({ error: 'Add at least one line' }, { status: 400 });

      let subtotal = 0;
      let taxTotal = 0;
      const lines: { itemId: string; qty: number; unitCost: number; gstRate: number; lineTotal: number }[] = [];
      for (const raw of rawLines) {
        const item = await db.inventoryItem.findUnique({ where: { id: String(raw.itemId ?? '') } });
        if (!item) return NextResponse.json({ error: 'Unknown item on a line' }, { status: 400 });
        const qty = Number(raw.qty);
        const unitCost = Number(raw.unitCost);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
          return NextResponse.json({ error: `Bad quantity or cost for ${item.name}` }, { status: 400 });
        }
        const gstRate = raw.gstRate !== undefined && raw.gstRate !== '' ? Math.max(0, Number(raw.gstRate)) : item.gstRate;
        const base = round2(qty * unitCost);
        const tax = round2((base * gstRate) / 100);
        subtotal = round2(subtotal + base);
        taxTotal = round2(taxTotal + tax);
        lines.push({ itemId: item.id, qty, unitCost, gstRate, lineTotal: round2(base + tax) });
      }

      const po = await db.purchaseOrder.create({
        data: {
          poNo: await nextDocNo('PO'),
          supplierId: supplier.id,
          status: 'ordered',
          expectedDate: body.expectedDate ? String(body.expectedDate).slice(0, 10) : null,
          notes: body.notes ? String(body.notes).slice(0, 300) : null,
          subtotal,
          taxTotal,
          total: round2(subtotal + taxTotal),
          createdBy: session.username,
          lines: { create: lines },
        },
      });
      await logAudit(session, 'inventory.po_create', {
        entity: 'PurchaseOrder', entityId: po.id,
        summary: `${po.poNo} raised on ${supplier.name} for ₹${po.total.toFixed(2)}`,
      });
      return NextResponse.json({ ok: true, po });
    }

    if (action === 'po_status') {
      const po = await db.purchaseOrder.findUnique({ where: { id: String(body.poId ?? '') } });
      if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
      const status = String(body.status ?? '');
      if (!['cancelled', 'ordered'].includes(status) || ['received', 'partial'].includes(po.status)) {
        return NextResponse.json({ error: 'Only open POs can be cancelled' }, { status: 400 });
      }
      await db.purchaseOrder.update({ where: { id: po.id }, data: { status } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'grn') {
      const po = await db.purchaseOrder.findUnique({
        where: { id: String(body.poId ?? '') },
        include: { lines: { include: { item: true } }, supplier: true },
      });
      if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
      if (['cancelled', 'received'].includes(po.status)) {
        return NextResponse.json({ error: `PO is ${po.status}` }, { status: 400 });
      }
      const receipts = Array.isArray(body.receipts) ? body.receipts : [];
      const grnNo = await nextDocNo('GRN');
      let receivedAny = false;

      for (const receipt of receipts) {
        const line = po.lines.find((l) => l.id === String(receipt.lineId ?? ''));
        if (!line) continue;
        const pendingQty = round2(line.qty - line.receivedQty);
        const qty = Math.min(pendingQty, Math.max(0, Number(receipt.qty) || 0));
        if (qty <= 0) continue;
        const unitCost = receipt.unitCost !== undefined && receipt.unitCost !== ''
          ? Math.max(0, Number(receipt.unitCost)) : line.unitCost;

        await db.purchaseOrderLine.update({
          where: { id: line.id },
          data: { receivedQty: round2(line.receivedQty + qty), unitCost },
        });
        await applyStockMove(line.itemId, 'grn', qty, unitCost, `${grnNo} / ${po.poNo} — ${po.supplier.name}`, null, session.username);
        receivedAny = true;
      }
      if (!receivedAny) return NextResponse.json({ error: 'Nothing to receive' }, { status: 400 });

      const fresh = await db.purchaseOrder.findUnique({ where: { id: po.id }, include: { lines: true } });
      const fullyReceived = fresh!.lines.every((l) => l.receivedQty + 0.0001 >= l.qty);
      await db.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: fullyReceived ? 'received' : 'partial',
          invoiceNo: body.invoiceNo ? String(body.invoiceNo).slice(0, 40) : po.invoiceNo,
          invoiceDate: body.invoiceDate ? String(body.invoiceDate).slice(0, 10) : po.invoiceDate,
        },
      });
      await logAudit(session, 'inventory.grn', {
        entity: 'PurchaseOrder', entityId: po.id,
        summary: `${grnNo}: goods received against ${po.poNo}${fullyReceived ? ' (complete)' : ' (partial)'}`,
      });
      return NextResponse.json({ ok: true, grnNo, status: fullyReceived ? 'received' : 'partial' });
    }

    if (action === 'issue') {
      const item = await db.inventoryItem.findUnique({ where: { id: String(body.itemId ?? '') } });
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      const qty = Number(body.qty);
      if (!Number.isFinite(qty) || qty <= 0) return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 });
      if (qty > item.currentStock) {
        return NextResponse.json({ error: `Only ${item.currentStock} ${item.unit} in stock` }, { status: 409 });
      }
      const department = String(body.department ?? 'general').slice(0, 40);
      await applyStockMove(item.id, 'issue', -qty, item.avgCost, null, department, session.username, body.notes ? String(body.notes).slice(0, 200) : undefined);
      await logAudit(session, 'inventory.issue', {
        entity: 'InventoryItem', entityId: item.id,
        summary: `Issued ${qty} ${item.unit} of ${item.name} to ${department}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'adjust') {
      const item = await db.inventoryItem.findUnique({ where: { id: String(body.itemId ?? '') } });
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      const newQty = Number(body.newQty);
      if (!Number.isFinite(newQty) || newQty < 0) return NextResponse.json({ error: 'Bad quantity' }, { status: 400 });
      const delta = round2(newQty - item.currentStock);
      if (delta === 0) return NextResponse.json({ ok: true });
      await applyStockMove(item.id, 'adjustment', delta, item.avgCost, null, null, session.username, String(body.notes ?? 'Physical count').slice(0, 200));
      await logAudit(session, 'inventory.adjust', {
        entity: 'InventoryItem', entityId: item.id,
        summary: `${item.name} stock adjusted ${delta > 0 ? '+' : ''}${delta} ${item.unit} (count)`,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('inventory action failed', action, error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

/** Write the ledger row and the item's cached balance in one transaction. */
async function applyStockMove(
  itemId: string,
  type: 'grn' | 'issue' | 'adjustment' | 'return' | 'opening',
  qty: number,
  unitCost: number,
  reference: string | null,
  department: string | null,
  createdBy: string,
  notes?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    const newStock = round2(item.currentStock + qty);
    // Receipts blend into a moving-average cost; issues leave cost untouched.
    let avgCost = item.avgCost;
    if (qty > 0 && (type === 'grn' || type === 'opening') && unitCost > 0) {
      const totalValue = item.currentStock * item.avgCost + qty * unitCost;
      avgCost = newStock > 0 ? round2(totalValue / newStock) : unitCost;
    }
    await tx.inventoryItem.update({
      where: { id: itemId },
      data: {
        currentStock: newStock,
        avgCost,
        lastCost: qty > 0 && unitCost > 0 ? unitCost : item.lastCost,
      },
    });
    await tx.stockLedger.create({
      data: {
        itemId, type, qty, unitCost, reference, department,
        notes: notes ?? null, balanceAfter: newStock, createdBy,
      },
    });
  });
}
