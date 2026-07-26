'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { act, api, fmtDate, fmtDateTime, inr, notify, notifyError, titleCase, todayIst, PAY_MODES } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, Field, PageHeader, Spinner, StatCard, Td } from '@/components/erp/ui';

interface Invoice {
  id: string; invoiceNo: string; buyerName: string; buyerGstin: string | null; source: string;
  taxable: number; cgst: number; sgst: number; igst: number; total: number; status: string; issuedAt: string;
}
interface Expense {
  id: string; voucherNo: string; date: string; category: string; payee: string; description: string | null;
  amount: number; gstAmount: number; tdsAmount: number; mode: string; billNo: string | null; department: string | null;
}
interface Data {
  from: string; to: string;
  invoices: Invoice[]; expenses: Expense[];
  summary: {
    roomRevenue: number; roomTax: number; fnbSales: number; fnbTax: number; invoiceTotal: number;
    collections: Record<string, number>; collected: number; expenseTotal: number; netCash: number;
  };
  gstSummary: { rate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }[];
}

const EXPENSE_CATEGORIES = ['utilities', 'salaries', 'maintenance', 'purchases', 'fuel', 'marketing', 'licenses', 'rent', 'commissions', 'other'];

export default function Finance() {
  const today = todayIst();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Data | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api(`/api/erp/finance?from=${from}&to=${to}`)); }
    catch (error) { notifyError(error); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  const download = (kind: string) => {
    window.open(`/api/erp/finance?export=${kind}&from=${from}&to=${to}`, '_blank');
  };

  return (
    <div>
      <PageHeader title="Finance & GST" subtitle={`${fmtDate(data.from)} — ${fmtDate(data.to)}`}
        actions={
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </>
        } />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Room Revenue (net)" value={inr(data.summary.roomRevenue)} hint={`+ GST ${inr(data.summary.roomTax)}`} />
        <StatCard label="F&B Sales" value={inr(data.summary.fnbSales)} hint={`incl tax ${inr(data.summary.fnbTax)}`} />
        <StatCard label="Collected" value={inr(data.summary.collected)} tone="good" />
        <StatCard label="Net Cash Flow" value={inr(data.summary.netCash)} tone={data.summary.netCash >= 0 ? 'good' : 'bad'}
          hint={`expenses ${inr(data.summary.expenseTotal)}`} />
      </div>

      <Tabs defaultValue="gst">
        <TabsList className="rounded-none bg-white border border-gold/10 flex-wrap h-auto">
          <TabsTrigger value="gst" className="rounded-none">GST & Compliance</TabsTrigger>
          <TabsTrigger value="invoices" className="rounded-none">Tax Invoices ({data.invoices.length})</TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-none">Expenses ({data.expenses.length})</TabsTrigger>
          <TabsTrigger value="collections" className="rounded-none">Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="gst" className="mt-4 space-y-4">
          <div className="bg-white border border-gold/10 p-4">
            <h3 className="text-sm tracking-widest uppercase text-charcoal/80 mb-3">Outward GST by Rate (issued invoices)</h3>
            {data.gstSummary.length === 0 ? <EmptyState message="No tax invoices in this range." /> : (
              <DataTable headers={['Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax']} minWidth={560}>
                {data.gstSummary.map((row) => (
                  <tr key={row.rate}>
                    <Td>{row.rate}%</Td>
                    <Td right>{inr(row.taxable)}</Td>
                    <Td right>{inr(row.cgst)}</Td>
                    <Td right>{inr(row.sgst)}</Td>
                    <Td right>{inr(row.igst)}</Td>
                    <Td right className="font-medium">{inr(row.tax)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Restaurant orders billed without a tax invoice are B2C supplies — include their consolidated tax
              ({inr(data.summary.fnbTax)} this range) when filing GSTR-1/3B.
            </p>
          </div>

          <div className="bg-white border border-gold/10 p-4">
            <h3 className="text-sm tracking-widest uppercase text-charcoal/80 mb-3">Registers & Exports (CSV)</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-none" onClick={() => download('gstr1')}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> GSTR-1 Outward
              </Button>
              <Button variant="outline" size="sm" className="rounded-none" onClick={() => download('invoices')}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Invoice Register
              </Button>
              <Button variant="outline" size="sm" className="rounded-none" onClick={() => download('expenses')}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Expense Register
              </Button>
              <Button variant="outline" size="sm" className="rounded-none" onClick={() => download('police')}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Police Guest Register (Form F)
              </Button>
              <Button variant="outline" size="sm" className="rounded-none" onClick={() => download('formc')}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Form C — Foreign Guests
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Exports cover the selected date range. Form C data must also be filed online at indianfrro.gov.in within 24 hours of each foreign check-in.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            {data.invoices.length === 0 ? <EmptyState message="No tax invoices issued in this range." /> : (
              <DataTable headers={['Invoice', 'Buyer', 'Taxable', 'CGST', 'SGST', 'Total', 'Status', '']} minWidth={780}>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id} className={invoice.status === 'cancelled' ? 'opacity-50' : ''}>
                    <Td className="whitespace-nowrap">
                      <button className="font-mono text-xs underline-offset-2 hover:underline cursor-pointer"
                        onClick={() => window.open(`/erp/print/invoice/${invoice.id}`, '_blank')}>
                        {invoice.invoiceNo}
                      </button>
                      <span className="block text-[11px] text-muted-foreground">{fmtDateTime(invoice.issuedAt)} · {invoice.source}</span>
                    </Td>
                    <Td>{invoice.buyerName}{invoice.buyerGstin && <span className="block font-mono text-[11px] text-muted-foreground">{invoice.buyerGstin}</span>}</Td>
                    <Td right>{inr(invoice.taxable)}</Td>
                    <Td right>{inr(invoice.cgst)}</Td>
                    <Td right>{inr(invoice.sgst)}</Td>
                    <Td right className="font-medium">{inr(invoice.total)}</Td>
                    <Td><Chip label={titleCase(invoice.status)} className={invoice.status === 'issued' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'} /></Td>
                    <Td>
                      {invoice.status === 'issued' && (
                        <button className="text-muted-foreground hover:text-red-600 cursor-pointer" title="Cancel invoice"
                          onClick={() => {
                            const reason = window.prompt(`Cancel ${invoice.invoiceNo}? Enter the reason (kept for GST records):`);
                            if (reason) act('/api/erp/finance', { action: 'invoice_cancel', id: invoice.id, reason }).then(() => { notify('Invoice cancelled'); load(); }).catch(notifyError);
                          }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setExpenseOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New Voucher
              </Button>
            </div>
            {data.expenses.length === 0 ? <EmptyState message="No expense vouchers in this range." /> : (
              <DataTable headers={['Voucher', 'Payee', 'Category', 'Mode', 'Amount', '']} minWidth={680}>
                {data.expenses.map((expense) => (
                  <tr key={expense.id}>
                    <Td className="font-mono text-xs whitespace-nowrap">{expense.voucherNo}<span className="block font-sans text-muted-foreground">{fmtDate(expense.date)}</span></Td>
                    <Td>{expense.payee}
                      <span className="block text-[11px] text-muted-foreground">
                        {expense.description ?? ''}{expense.billNo ? ` · Bill ${expense.billNo}` : ''}{expense.tdsAmount > 0 ? ` · TDS ${inr(expense.tdsAmount)}` : ''}
                      </span>
                    </Td>
                    <Td>{titleCase(expense.category)}{expense.department && <span className="block text-[11px] text-muted-foreground">{titleCase(expense.department)}</span>}</Td>
                    <Td>{expense.mode.toUpperCase()}</Td>
                    <Td right className="font-medium">{inr(expense.amount)}{expense.gstAmount > 0 && <span className="block text-[11px] text-muted-foreground font-normal">incl GST {inr(expense.gstAmount)}</span>}</Td>
                    <Td>
                      <button className="text-muted-foreground hover:text-red-600 cursor-pointer"
                        onClick={() => { if (window.confirm(`Delete ${expense.voucherNo}?`)) act('/api/erp/finance', { action: 'expense_delete', id: expense.id }).then(() => { notify('Deleted'); load(); }).catch(notifyError); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <h3 className="text-sm tracking-widest uppercase text-charcoal/80 mb-3">Collections by Mode</h3>
            {Object.keys(data.summary.collections).length === 0 ? <EmptyState message="No payments in this range." /> : (
              <DataTable headers={['Mode', 'Amount']} minWidth={320}>
                {Object.entries(data.summary.collections).sort((a, b) => b[1] - a[1]).map(([mode, amount]) => (
                  <tr key={mode}>
                    <Td>{titleCase(mode)}</Td>
                    <Td right>{inr(amount)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Covers every paid entry in the payment ledger — website gateways, front-desk folios and POS alike.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {expenseOpen && <ExpenseDialog onClose={() => setExpenseOpen(false)} onDone={() => { setExpenseOpen(false); load(); }} />}
    </div>
  );
}

function ExpenseDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    date: todayIst(), category: 'other', payee: '', description: '', amount: '', gstAmount: '',
    tdsAmount: '', mode: 'cash', reference: '', supplierGstin: '', billNo: '', department: '',
  });
  const submit = async () => {
    setBusy(true);
    try {
      await act('/api/erp/finance', {
        action: 'expense_save', ...form,
        amount: Number(form.amount), gstAmount: Number(form.gstAmount) || 0, tdsAmount: Number(form.tdsAmount) || 0,
      });
      notify('Voucher saved'); onDone();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-light">New Expense Voucher</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Payee" className="col-span-2"><Input value={form.payee} placeholder="TPCODL / Diesel vendor / Laundry" onChange={(e) => setForm({ ...form, payee: e.target.value })} /></Field>
          <Field label="Description" className="col-span-2"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Amount (₹)"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Mode">
            <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAY_MODES.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="GST in bill (₹)"><Input type="number" value={form.gstAmount} onChange={(e) => setForm({ ...form, gstAmount: e.target.value })} /></Field>
          <Field label="TDS deducted (₹)"><Input type="number" value={form.tdsAmount} onChange={(e) => setForm({ ...form, tdsAmount: e.target.value })} /></Field>
          <Field label="Supplier GSTIN"><Input value={form.supplierGstin} onChange={(e) => setForm({ ...form, supplierGstin: e.target.value.toUpperCase() })} /></Field>
          <Field label="Bill No"><Input value={form.billNo} onChange={(e) => setForm({ ...form, billNo: e.target.value })} /></Field>
        </div>
        <Button onClick={submit} disabled={busy || !form.payee || !Number(form.amount)}
          className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Save Voucher</Button>
      </DialogContent>
    </Dialog>
  );
}
