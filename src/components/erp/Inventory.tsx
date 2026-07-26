'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { act, api, fmtDate, fmtDateTime, inr, notify, notifyError, titleCase, DEPARTMENTS } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, Field, PageHeader, Spinner, Td } from '@/components/erp/ui';

interface Item {
  id: string; code: string; name: string; category: string; unit: string; hsn: string | null;
  gstRate: number; currentStock: number; reorderLevel: number; avgCost: number; lastCost: number; isActive: boolean;
}
interface Supplier {
  id: string; name: string; contactPerson: string | null; phone: string | null; email: string | null;
  gstin: string | null; state: string | null; paymentTermDays: number; isActive: boolean;
}
interface PoLine { id: string; itemId: string; qty: number; receivedQty: number; unitCost: number; gstRate: number; lineTotal: number; item: { name: string; unit: string } }
interface Po {
  id: string; poNo: string; supplierId: string; status: string; orderDate: string; expectedDate: string | null;
  subtotal: number; taxTotal: number; total: number; invoiceNo: string | null; notes: string | null;
  supplier: { name: string }; lines: PoLine[];
}
interface LedgerRow {
  id: string; type: string; qty: number; unitCost: number; reference: string | null; department: string | null;
  balanceAfter: number; createdBy: string; createdAt: string; item: { name: string; unit: string };
}
interface Data { items: Item[]; suppliers: Supplier[]; purchaseOrders: Po[]; ledger: LedgerRow[]; lowStock: Item[] }

const ITEM_CATEGORIES = ['food', 'beverage', 'housekeeping', 'linen', 'engineering', 'stationery', 'minibar', 'general'];

export default function Inventory() {
  const [data, setData] = useState<Data | null>(null);
  const [itemEdit, setItemEdit] = useState<Partial<Item> | null>(null);
  const [supplierEdit, setSupplierEdit] = useState<Partial<Supplier> | null>(null);
  const [poOpen, setPoOpen] = useState(false);
  const [grnFor, setGrnFor] = useState<Po | null>(null);
  const [issueFor, setIssueFor] = useState<Item | null>(null);

  const load = useCallback(async () => {
    try { setData(await api('/api/erp/inventory')); }
    catch (error) { notifyError(error); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Stores & Purchase"
        subtitle={`${data.items.length} items · ${data.suppliers.length} suppliers`}
        actions={<Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>} />

      {data.lowStock.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Reorder: {data.lowStock.map((i) => `${i.name} (${i.currentStock} ${i.unit})`).join(', ')}
        </div>
      )}

      <Tabs defaultValue="items">
        <TabsList className="rounded-none bg-white border border-gold/10 flex-wrap h-auto">
          <TabsTrigger value="items" className="rounded-none">Items</TabsTrigger>
          <TabsTrigger value="po" className="rounded-none">Purchase Orders</TabsTrigger>
          <TabsTrigger value="suppliers" className="rounded-none">Suppliers</TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-none">Stock Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setItemEdit({})}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New Item
              </Button>
            </div>
            {data.items.length === 0 ? <EmptyState message="No inventory items yet — add rice, linen, diesel, everything." /> : (
              <DataTable headers={['Code', 'Item', 'Category', 'Stock', 'Avg Cost', 'Value', '']} minWidth={720}>
                {data.items.map((item) => (
                  <tr key={item.id} className={item.isActive ? '' : 'opacity-50'}>
                    <Td className="font-mono text-xs">{item.code}</Td>
                    <Td>
                      <button className="text-left underline-offset-2 hover:underline cursor-pointer" onClick={() => setItemEdit(item)}>{item.name}</button>
                      <span className="block text-[11px] text-muted-foreground">{item.hsn ? `HSN ${item.hsn} · ` : ''}GST {item.gstRate}%</span>
                    </Td>
                    <Td>{titleCase(item.category)}</Td>
                    <Td right>
                      <span className={item.reorderLevel > 0 && item.currentStock <= item.reorderLevel ? 'text-red-700 font-medium' : ''}>
                        {item.currentStock} {item.unit}
                      </span>
                    </Td>
                    <Td right>{inr(item.avgCost)}</Td>
                    <Td right>{inr(item.currentStock * item.avgCost)}</Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="rounded-none h-7 text-xs" onClick={() => setIssueFor(item)}>Issue</Button>
                        <Button size="sm" variant="ghost" className="rounded-none h-7 text-xs" onClick={() => {
                          const v = window.prompt(`Physical count for ${item.name} (${item.unit})`, String(item.currentStock));
                          if (v !== null) act('/api/erp/inventory', { action: 'adjust', itemId: item.id, newQty: Number(v) }).then(() => { notify('Stock adjusted'); load(); }).catch(notifyError);
                        }}>Count</Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>

        <TabsContent value="po" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setPoOpen(true)}
                disabled={!data.suppliers.length || !data.items.length}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New PO
              </Button>
            </div>
            {data.purchaseOrders.length === 0 ? <EmptyState message="No purchase orders yet." /> : (
              <DataTable headers={['PO', 'Supplier', 'Lines', 'Total', 'Status', '']} minWidth={700}>
                {data.purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <Td className="font-mono text-xs whitespace-nowrap">{po.poNo}<span className="block text-muted-foreground">{fmtDate(po.orderDate)}</span></Td>
                    <Td>{po.supplier.name}{po.invoiceNo && <span className="block text-[11px] text-muted-foreground">Inv {po.invoiceNo}</span>}</Td>
                    <Td className="text-xs">
                      {po.lines.map((l) => (
                        <span key={l.id} className="block">{l.item.name}: {l.receivedQty}/{l.qty} {l.item.unit}</span>
                      ))}
                    </Td>
                    <Td right>{inr(po.total)}</Td>
                    <Td><Chip label={titleCase(po.status)} className={
                      po.status === 'received' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : po.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200'
                          : 'bg-sky-100 text-sky-800 border-sky-200'} /></Td>
                    <Td>
                      {['ordered', 'partial'].includes(po.status) && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" className="rounded-none h-7 text-xs" onClick={() => setGrnFor(po)}>Receive</Button>
                          {po.status === 'ordered' && (
                            <Button size="sm" variant="ghost" className="rounded-none h-7 text-xs text-red-700"
                              onClick={() => { if (window.confirm(`Cancel ${po.poNo}?`)) act('/api/erp/inventory', { action: 'po_status', poId: po.id, status: 'cancelled' }).then(load).catch(notifyError); }}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setSupplierEdit({})}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New Supplier
              </Button>
            </div>
            {data.suppliers.length === 0 ? <EmptyState message="No suppliers yet." /> : (
              <DataTable headers={['Supplier', 'Contact', 'GSTIN', 'Terms', '']} minWidth={640}>
                {data.suppliers.map((s) => (
                  <tr key={s.id} className={s.isActive ? '' : 'opacity-50'}>
                    <Td><button className="underline-offset-2 hover:underline cursor-pointer" onClick={() => setSupplierEdit(s)}>{s.name}</button></Td>
                    <Td className="text-xs">{s.contactPerson ?? '—'}<span className="block text-muted-foreground">{s.phone ?? ''}</span></Td>
                    <Td className="font-mono text-xs">{s.gstin ?? '—'}<span className="block font-sans text-muted-foreground">{s.state ?? ''}</span></Td>
                    <Td className="text-xs">{s.paymentTermDays ? `${s.paymentTermDays} days credit` : 'Cash'}</Td>
                    <Td />
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            {data.ledger.length === 0 ? <EmptyState message="No stock movements yet." /> : (
              <DataTable headers={['When', 'Item', 'Move', 'Qty', 'Ref / Dept', 'Balance']} minWidth={700}>
                {data.ledger.map((row) => (
                  <tr key={row.id}>
                    <Td className="text-xs whitespace-nowrap">{fmtDateTime(row.createdAt)}<span className="block text-muted-foreground">{row.createdBy}</span></Td>
                    <Td>{row.item.name}</Td>
                    <Td><Chip label={titleCase(row.type)} className={row.qty >= 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-900 border-amber-200'} /></Td>
                    <Td right className={row.qty < 0 ? 'text-amber-800' : 'text-emerald-800'}>{row.qty > 0 ? '+' : ''}{row.qty} {row.item.unit}</Td>
                    <Td className="text-xs">{row.reference ?? row.department ?? '—'}</Td>
                    <Td right>{row.balanceAfter} {row.item.unit}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {itemEdit && <ItemDialog item={itemEdit} onClose={() => setItemEdit(null)} onDone={() => { setItemEdit(null); load(); }} />}
      {supplierEdit && <SupplierDialog supplier={supplierEdit} onClose={() => setSupplierEdit(null)} onDone={() => { setSupplierEdit(null); load(); }} />}
      {poOpen && <PoDialog items={data.items} suppliers={data.suppliers} onClose={() => setPoOpen(false)} onDone={() => { setPoOpen(false); load(); }} />}
      {grnFor && <GrnDialog po={grnFor} onClose={() => setGrnFor(null)} onDone={() => { setGrnFor(null); load(); }} />}
      {issueFor && <IssueDialog item={issueFor} onClose={() => setIssueFor(null)} onDone={() => { setIssueFor(null); load(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ItemDialog({ item, onClose, onDone }: { item: Partial<Item>; onClose: () => void; onDone: () => void }) {
  const isNew = !item.id;
  const [form, setForm] = useState({
    name: item.name ?? '', category: item.category ?? 'general', unit: item.unit ?? 'pcs',
    hsn: item.hsn ?? '', gstRate: String(item.gstRate ?? 0), reorderLevel: String(item.reorderLevel ?? 0),
    openingStock: '', openingCost: '', isActive: item.isActive ?? true,
  });
  const submit = async () => {
    try {
      await act('/api/erp/inventory', {
        action: 'item_save', id: item.id, ...form,
        gstRate: Number(form.gstRate) || 0, reorderLevel: Number(form.reorderLevel) || 0,
        openingStock: Number(form.openingStock) || 0, openingCost: Number(form.openingCost) || 0,
      });
      notify('Item saved'); onDone();
    } catch (error) { notifyError(error); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-light">{isNew ? 'New Item' : `Edit — ${item.name}`}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ITEM_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Unit"><Input value={form.unit} placeholder="kg / ltr / pcs" onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
            <Field label="HSN Code"><Input value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} /></Field>
            <Field label="GST % (on purchase)"><Input type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} /></Field>
            <Field label="Reorder Level"><Input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></Field>
          </div>
          {isNew && (
            <div className="grid grid-cols-2 gap-3 border-t border-gold/10 pt-3">
              <Field label="Opening Stock"><Input type="number" value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: e.target.value })} /></Field>
              <Field label="Opening Cost/Unit"><Input type="number" value={form.openingCost} onChange={(e) => setForm({ ...form, openingCost: e.target.value })} /></Field>
            </div>
          )}
          <Button onClick={submit} disabled={!form.name} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupplierDialog({ supplier, onClose, onDone }: { supplier: Partial<Supplier>; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    name: supplier.name ?? '', contactPerson: supplier.contactPerson ?? '', phone: supplier.phone ?? '',
    email: supplier.email ?? '', gstin: supplier.gstin ?? '', state: supplier.state ?? '',
    paymentTermDays: String(supplier.paymentTermDays ?? 0),
  });
  const submit = async () => {
    try {
      await act('/api/erp/inventory', { action: 'supplier_save', id: supplier.id, ...form, paymentTermDays: Number(form.paymentTermDays) || 0 });
      notify('Supplier saved'); onDone();
    } catch (error) { notifyError(error); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-light">{supplier.id ? `Edit — ${supplier.name}` : 'New Supplier'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Person"><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></Field>
            <Field label="State"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
            <Field label="Credit Days"><Input type="number" value={form.paymentTermDays} onChange={(e) => setForm({ ...form, paymentTermDays: e.target.value })} /></Field>
          </div>
          <Button onClick={submit} disabled={!form.name} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PoDialog({ items, suppliers, onClose, onDone }: {
  items: Item[]; suppliers: Supplier[]; onClose: () => void; onDone: () => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [lines, setLines] = useState<{ itemId: string; qty: string; unitCost: string }[]>([{ itemId: '', qty: '', unitCost: '' }]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await act('/api/erp/inventory', {
        action: 'po_create', supplierId, expectedDate: expectedDate || undefined,
        lines: lines.filter((l) => l.itemId && Number(l.qty) > 0).map((l) => ({ itemId: l.itemId, qty: Number(l.qty), unitCost: Number(l.unitCost) || 0 })),
      });
      notify('Purchase order raised'); onDone();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-light">New Purchase Order</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{suppliers.filter((s) => s.isActive).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Expected By"><Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></Field>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <Select value={line.itemId} onValueChange={(v) => {
                const item = items.find((it) => it.id === v);
                setLines(lines.map((l, j) => j === i ? { itemId: v, qty: l.qty, unitCost: l.unitCost || String(item?.lastCost || '') } : l));
              }}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Item…" /></SelectTrigger>
                <SelectContent>{items.filter((it) => it.isActive).map((it) => <SelectItem key={it.id} value={it.id}>{it.name} ({it.unit})</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" placeholder="Qty" className="w-20" value={line.qty}
                onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, qty: e.target.value } : l))} />
              <Input type="number" placeholder="₹/unit" className="w-24" value={line.unitCost}
                onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, unitCost: e.target.value } : l))} />
            </div>
          ))}
          <Button variant="ghost" size="sm" className="rounded-none" onClick={() => setLines([...lines, { itemId: '', qty: '', unitCost: '' }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add line
          </Button>
          <Button onClick={submit} disabled={busy || !supplierId || !lines.some((l) => l.itemId && Number(l.qty) > 0)}
            className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Raise PO</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GrnDialog({ po, onClose, onDone }: { po: Po; onClose: () => void; onDone: () => void }) {
  const [receipts, setReceipts] = useState(
    po.lines.map((l) => ({ lineId: l.id, qty: String(Math.max(0, l.qty - l.receivedQty)), unitCost: String(l.unitCost) })),
  );
  const [invoiceNo, setInvoiceNo] = useState(po.invoiceNo ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await act('/api/erp/inventory', {
        action: 'grn', poId: po.id, invoiceNo: invoiceNo || undefined,
        receipts: receipts.map((r) => ({ lineId: r.lineId, qty: Number(r.qty) || 0, unitCost: Number(r.unitCost) })),
      });
      notify('Goods received — stock updated'); onDone();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-light">Receive Goods — {po.poNo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {po.lines.map((line, i) => (
            <div key={line.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{line.item.name}<span className="block text-[11px] text-muted-foreground">pending {Math.max(0, line.qty - line.receivedQty)} {line.item.unit}</span></span>
              <Input type="number" className="w-24" value={receipts[i].qty} placeholder="Qty"
                onChange={(e) => setReceipts(receipts.map((r, j) => j === i ? { ...r, qty: e.target.value } : r))} />
              <Input type="number" className="w-24" value={receipts[i].unitCost} placeholder="₹/unit"
                onChange={(e) => setReceipts(receipts.map((r, j) => j === i ? { ...r, unitCost: e.target.value } : r))} />
            </div>
          ))}
          <Field label="Supplier Invoice No"><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></Field>
          <Button onClick={submit} disabled={busy} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Post GRN</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState('');
  const [department, setDepartment] = useState('kitchen');
  const [notes, setNotes] = useState('');
  const submit = async () => {
    try {
      await act('/api/erp/inventory', { action: 'issue', itemId: item.id, qty: Number(qty), department, notes });
      notify('Issued'); onDone();
    } catch (error) { notifyError(error); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-light">Issue — {item.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={`Quantity (${item.currentStock} ${item.unit} in stock)`}>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="To Department">
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{titleCase(d)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button onClick={submit} disabled={!Number(qty)} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Issue Stock</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
