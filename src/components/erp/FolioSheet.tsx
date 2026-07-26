'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Printer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { act, api, fmtDate, inr, notify, notifyError, titleCase, PAY_MODES } from '@/components/erp/lib';
import { Chip, DataTable, Field, Td } from '@/components/erp/ui';

interface FolioLine {
  id: string; date: string; type: string; description: string; qty: number;
  unitAmount: number; amount: number; gstRate: number; cgst: number; sgst: number;
  igst: number; total: number; payMode: string | null; isVoid: boolean; voidReason: string | null;
}
interface FolioData {
  folio: {
    id: string; folioNo: string; guestName: string; status: string;
    lines: FolioLine[];
    invoices: { id: string; invoiceNo: string; total: number; status: string; issuedAt: string }[];
    booking: {
      id: string; bookingRef: string; guestPhone: string; guestEmail: string; checkIn: string; checkOut: string;
      unit: { unitNumber: string } | null;
      regCard: { id: string } | null;
    } | null;
  };
  totals: { charges: number; tax: number; chargesWithTax: number; payments: number; refunds: number; balance: number };
}

const CHARGE_TYPES = ['room', 'fnb', 'laundry', 'minibar', 'spa', 'transport', 'misc', 'discount'];

/**
 * The running bill for one stay: post charges, take payments, issue the GST
 * invoice, print. Opened from the front desk or a reservation.
 */
export default function FolioSheet({ folioId, onClose, onChanged }: {
  folioId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<FolioData | null>(null);
  const [busy, setBusy] = useState(false);
  const [charge, setCharge] = useState({ type: 'misc', description: '', qty: '1', unitAmount: '' });
  const [payment, setPayment] = useState({ amount: '', mode: 'cash', reference: '' });
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [buyer, setBuyer] = useState({ name: '', gstin: '', address: '' });

  const load = useCallback(async () => {
    if (!folioId) return;
    try { setData(await api<FolioData>(`/api/erp/folios?id=${folioId}`)); }
    catch (error) { notifyError(error); }
  }, [folioId]);

  useEffect(() => { setData(null); load(); }, [load]);

  const run = async (body: Record<string, unknown>, message?: string) => {
    setBusy(true);
    try {
      const result = await act<Record<string, unknown>>('/api/erp/folios', { folioId, ...body });
      if (message) notify(message);
      await load();
      onChanged?.();
      return result;
    } catch (error) {
      notifyError(error);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const addCharge = async () => {
    if (!charge.description || !charge.unitAmount) return;
    const ok = await run({
      action: 'charge', type: charge.type, description: charge.description,
      qty: Number(charge.qty) || 1, unitAmount: Number(charge.unitAmount),
    }, 'Charge posted');
    if (ok) setCharge({ type: 'misc', description: '', qty: '1', unitAmount: '' });
  };

  const addPayment = async (isRefund = false) => {
    if (!payment.amount) return;
    const ok = await run({
      action: isRefund ? 'refund' : 'payment',
      amount: Number(payment.amount), mode: payment.mode, reference: payment.reference || undefined,
    }, isRefund ? 'Refund recorded' : 'Payment recorded');
    if (ok) setPayment({ amount: '', mode: 'cash', reference: '' });
  };

  const issueInvoice = async () => {
    const result = await run({
      action: 'invoice',
      buyerName: buyer.name || undefined, buyerGstin: buyer.gstin || undefined, buyerAddress: buyer.address || undefined,
    });
    if (result) {
      setInvoiceOpen(false);
      notify(`Invoice ${result.invoiceNo} issued`);
      window.open(`/erp/print/invoice/${result.id}`, '_blank');
    }
  };

  const folio = data?.folio;
  const totals = data?.totals;

  return (
    <Dialog open={Boolean(folioId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        {!folio || !totals ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gold" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-light tracking-wide flex flex-wrap items-center gap-2">
                Folio {folio.folioNo}
                <Chip label={folio.status === 'open' ? 'Open' : titleCase(folio.status)}
                  className={folio.status === 'open' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'} />
              </DialogTitle>
            </DialogHeader>

            <div className="text-sm text-muted-foreground -mt-1">
              {folio.guestName}
              {folio.booking && (
                <> · {folio.booking.bookingRef} · Room {folio.booking.unit?.unitNumber ?? '—'} ·{' '}
                  {fmtDate(folio.booking.checkIn)} → {fmtDate(folio.booking.checkOut)}</>
              )}
            </div>

            <DataTable headers={['Date', 'Description', 'Qty', 'Taxable', 'GST', 'Total', '']} minWidth={700}>
              {folio.lines.map((line) => (
                <tr key={line.id} className={line.isVoid ? 'opacity-40 line-through' : ''}>
                  <Td className="whitespace-nowrap">{fmtDate(line.date)}</Td>
                  <Td>
                    <span className="text-charcoal">{line.description}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {titleCase(line.type)}{line.payMode ? ` · ${line.payMode}` : ''}{line.gstRate ? ` · GST ${line.gstRate}%` : ''}
                      {line.isVoid ? ` · VOID: ${line.voidReason}` : ''}
                    </span>
                  </Td>
                  <Td right>{line.qty !== 1 ? line.qty : ''}</Td>
                  <Td right>{line.type === 'payment' || line.type === 'refund' ? '—' : inr(line.amount)}</Td>
                  <Td right>{line.cgst + line.sgst + line.igst ? inr(line.cgst + line.sgst + line.igst) : '—'}</Td>
                  <Td right className={line.total < 0 ? 'text-emerald-700' : ''}>{inr(line.total)}</Td>
                  <Td>
                    {!line.isVoid && folio.status === 'open' && line.type !== 'payment' && line.type !== 'refund' && (
                      <button
                        title="Void line" disabled={busy}
                        onClick={() => {
                          const reason = window.prompt(`Void "${line.description}" — reason?`);
                          if (reason) run({ action: 'void_line', lineId: line.id, reason }, 'Line voided');
                        }}
                        className="text-muted-foreground hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
              {folio.lines.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">No postings yet</td></tr>
              )}
            </DataTable>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-cream/50 border border-gold/10 px-4 py-3 text-sm">
              <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Charges + GST</p><p className="tabular-nums">{inr(totals.chargesWithTax)}</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">of which GST</p><p className="tabular-nums">{inr(totals.tax)}</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Paid</p><p className="tabular-nums text-emerald-700">{inr(totals.payments)}</p></div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Balance Due</p>
                <p className={`tabular-nums font-medium ${totals.balance > 0.5 ? 'text-red-700' : 'text-emerald-700'}`}>{inr(totals.balance)}</p>
              </div>
            </div>

            {folio.status === 'open' && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-gold/10 p-3 space-y-2">
                  <p className="text-xs tracking-widest uppercase text-muted-foreground">Post a Charge</p>
                  <div className="flex gap-2">
                    <Select value={charge.type} onValueChange={(v) => setCharge({ ...charge, type: v })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHARGE_TYPES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Description" value={charge.description}
                      onChange={(e) => setCharge({ ...charge, description: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Qty" className="w-20" value={charge.qty}
                      onChange={(e) => setCharge({ ...charge, qty: e.target.value })} />
                    <Input type="number" placeholder="Amount (pre-GST)" value={charge.unitAmount}
                      onChange={(e) => setCharge({ ...charge, unitAmount: e.target.value })} />
                    <Button size="sm" onClick={addCharge} disabled={busy || !charge.description || !charge.unitAmount}
                      className="bg-charcoal hover:bg-charcoal-light text-white rounded-none">Post</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">GST is applied automatically by charge type (rooms via tariff slab).</p>
                </div>

                <div className="border border-gold/10 p-3 space-y-2">
                  <p className="text-xs tracking-widest uppercase text-muted-foreground">Take a Payment</p>
                  <div className="flex gap-2">
                    <Input type="number" placeholder={`Amount (due ${inr(Math.max(0, totals.balance))})`} value={payment.amount}
                      onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
                    <Select value={payment.mode} onValueChange={(v) => setPayment({ ...payment, mode: v })}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAY_MODES.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Reference (UTR / last 4 digits)" value={payment.reference}
                      onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
                    <Button size="sm" onClick={() => addPayment(false)} disabled={busy || !payment.amount}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-none">Receive</Button>
                    <Button size="sm" variant="outline" onClick={() => addPayment(true)} disabled={busy || !payment.amount}
                      className="rounded-none">Refund</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Quick fill:{' '}
                    <button className="underline cursor-pointer" onClick={() => setPayment({ ...payment, amount: String(Math.max(0, totals.balance)) })}>
                      full balance
                    </button>
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap gap-2">
                {folio.invoices.map((invoice) => (
                  <button key={invoice.id} onClick={() => window.open(`/erp/print/invoice/${invoice.id}`, '_blank')}
                    className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs cursor-pointer hover:border-gold ${invoice.status === 'cancelled' ? 'line-through opacity-50' : ''}`}>
                    <FileText className="w-3.5 h-3.5 text-gold" /> {invoice.invoiceNo} · {inr(invoice.total)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {folio.booking?.regCard && (
                  <Button variant="outline" size="sm" className="rounded-none"
                    onClick={() => window.open(`/erp/print/regcard/${folio.booking!.id}`, '_blank')}>
                    <Printer className="w-3.5 h-3.5 mr-1.5" /> Reg Card
                  </Button>
                )}
                <Button variant="outline" size="sm" className="rounded-none" onClick={() => setInvoiceOpen(true)} disabled={busy}>
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Issue GST Invoice
                </Button>
                {folio.status === 'open' ? (
                  <Button size="sm" className="bg-charcoal hover:bg-charcoal-light text-white rounded-none" disabled={busy}
                    onClick={() => run({ action: 'settle' }, 'Folio settled')}>Settle & Close</Button>
                ) : (
                  <Button size="sm" variant="outline" className="rounded-none" disabled={busy}
                    onClick={() => run({ action: 'reopen' }, 'Folio reopened')}>Reopen</Button>
                )}
              </div>
            </div>

            <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle className="font-light">GST Invoice Details</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Field label="Bill To (blank = guest name)">
                    <Input value={buyer.name} placeholder={folio.guestName}
                      onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} />
                  </Field>
                  <Field label="Buyer GSTIN (for B2B / corporate)">
                    <Input value={buyer.gstin} placeholder="e.g. 21ABCDE1234F1Z5"
                      onChange={(e) => setBuyer({ ...buyer, gstin: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Buyer Address">
                    <Input value={buyer.address} onChange={(e) => setBuyer({ ...buyer, address: e.target.value })} />
                  </Field>
                  <Button onClick={issueInvoice} disabled={busy}
                    className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Issue & Print'}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Invoices snapshot the folio's un-voided charges. Numbering follows the financial year series.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
