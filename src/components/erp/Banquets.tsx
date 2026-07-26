'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { act, fmtDate, api, inr, needsForce, notify, notifyError, titleCase, todayIst, PAY_MODES } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, Field, PageHeader, Spinner, Td } from '@/components/erp/ui';

interface Hall {
  id: string; name: string; capacitySeating: number; capacityFloating: number;
  area: string | null; baseRent: number; isActive: boolean;
}
interface EventRow {
  id: string; eventRef: string; hallId: string; eventDate: string; startTime: string; endTime: string;
  eventType: string; customerName: string; customerPhone: string; customerGstin: string | null;
  pax: number; ratePerPlate: number; hallRent: number; decorationAmount: number; otherCharges: number;
  discountAmount: number; gstRate: number; menuNotes: string | null; notes: string | null;
  status: string; advancePaid: number; totalAmount: number; hall: { name: string };
}

const STATUS_META: Record<string, string> = {
  enquiry: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  tentative: 'bg-amber-100 text-amber-900 border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completed: 'bg-sky-100 text-sky-800 border-sky-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};
const EVENT_TYPES = ['wedding', 'reception', 'conference', 'birthday', 'corporate', 'other'];

export default function Banquets() {
  const [data, setData] = useState<{ halls: Hall[]; bookings: EventRow[] } | null>(null);
  const [eventEdit, setEventEdit] = useState<Partial<EventRow> | null>(null);
  const [hallEdit, setHallEdit] = useState<Partial<Hall> | null>(null);
  const [payFor, setPayFor] = useState<EventRow | null>(null);

  const load = useCallback(async () => {
    try { setData(await api('/api/erp/banquets')); }
    catch (error) { notifyError(error); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;
  const upcoming = data.bookings.filter((b) => b.eventDate >= todayIst() && !['cancelled', 'completed'].includes(b.status));

  return (
    <div>
      <PageHeader title="Banquets & Events"
        subtitle={`${data.halls.length} hall${data.halls.length === 1 ? '' : 's'} · ${upcoming.length} upcoming event${upcoming.length === 1 ? '' : 's'}`}
        actions={
          <>
            <Button size="sm" variant="outline" className="rounded-none" onClick={() => setHallEdit({})}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Hall
            </Button>
            <Button size="sm" className="rounded-none bg-gold hover:bg-gold-dark text-white" onClick={() => setEventEdit({})}
              disabled={!data.halls.length}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Event
            </Button>
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </>
        } />

      {data.halls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {data.halls.map((hall) => (
            <button key={hall.id} onClick={() => setHallEdit(hall)}
              className="bg-white border border-gold/10 p-3 text-left hover:border-gold/40 cursor-pointer">
              <p className="font-light text-base">{hall.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {hall.capacitySeating} seated · {hall.capacityFloating} floating{hall.area ? ` · ${hall.area}` : ''}
              </p>
              <p className="text-xs mt-1">{inr(hall.baseRent)} base rent</p>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border border-gold/10 p-4">
        {data.bookings.length === 0 ? (
          <EmptyState message="No events yet. Weddings pay the bills — add your first enquiry." />
        ) : (
          <DataTable headers={['Event', 'Customer', 'Hall & Date', 'Value', 'Advance', 'Status', '']} minWidth={860}>
            {data.bookings.map((b) => (
              <tr key={b.id}>
                <Td className="whitespace-nowrap">
                  <button className="font-mono text-xs underline-offset-2 hover:underline cursor-pointer" onClick={() => setEventEdit(b)}>{b.eventRef}</button>
                  <span className="block text-[11px] text-muted-foreground">{titleCase(b.eventType)} · {b.pax} pax</span>
                </Td>
                <Td>{b.customerName}<span className="block text-[11px] text-muted-foreground">{b.customerPhone}</span></Td>
                <Td className="whitespace-nowrap">{b.hall.name}<span className="block text-[11px] text-muted-foreground">{fmtDate(b.eventDate)} · {b.startTime}–{b.endTime}</span></Td>
                <Td right>{inr(b.totalAmount)}</Td>
                <Td right className={b.advancePaid > 0 ? 'text-emerald-700' : ''}>{inr(b.advancePaid)}</Td>
                <Td>
                  <Select value={b.status} onValueChange={(v) => {
                    act('/api/erp/banquets', { action: 'booking_status', id: b.id, status: v })
                      .then(() => { notify('Status updated'); load(); }).catch(notifyError);
                  }}>
                    <SelectTrigger className="h-7 w-32 text-xs border-0 p-0 [&>svg]:hidden justify-start">
                      <Chip label={titleCase(b.status)} className={STATUS_META[b.status]} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STATUS_META).map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Td>
                <Td>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="rounded-none h-7 text-xs" onClick={() => setPayFor(b)}>
                      <Wallet className="w-3 h-3 mr-1" /> Advance
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-none h-7 text-xs"
                      onClick={async () => {
                        try {
                          const result = await act<{ invoiceId: string; invoiceNo: string }>('/api/erp/banquets', { action: 'booking_invoice', id: b.id });
                          notify(`Invoice ${result.invoiceNo} issued`);
                          window.open(`/erp/print/invoice/${result.invoiceId}`, '_blank');
                          load();
                        } catch (error) { notifyError(error); }
                      }}>
                      <FileText className="w-3 h-3 mr-1" /> Invoice
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      {eventEdit && <EventDialog event={eventEdit} halls={data.halls} onClose={() => setEventEdit(null)} onDone={() => { setEventEdit(null); load(); }} />}
      {hallEdit && <HallDialog hall={hallEdit} onClose={() => setHallEdit(null)} onDone={() => { setHallEdit(null); load(); }} />}
      {payFor && <AdvanceDialog event={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />}
    </div>
  );
}

function EventDialog({ event, halls, onClose, onDone }: {
  event: Partial<EventRow>; halls: Hall[]; onClose: () => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    hallId: event.hallId ?? (halls[0]?.id ?? ''), eventDate: event.eventDate ?? todayIst(),
    startTime: event.startTime ?? '18:00', endTime: event.endTime ?? '23:00',
    eventType: event.eventType ?? 'wedding', status: event.status ?? 'enquiry',
    customerName: event.customerName ?? '', customerPhone: event.customerPhone ?? '',
    customerGstin: event.customerGstin ?? '', pax: String(event.pax ?? 100),
    ratePerPlate: String(event.ratePerPlate ?? ''), hallRent: String(event.hallRent ?? (halls[0]?.baseRent ?? 0)),
    decorationAmount: String(event.decorationAmount ?? '0'), otherCharges: String(event.otherCharges ?? '0'),
    discountAmount: String(event.discountAmount ?? '0'), menuNotes: event.menuNotes ?? '', notes: event.notes ?? '',
  });

  const submit = async () => {
    setBusy(true);
    const body = {
      action: 'booking_save', id: event.id, ...form,
      pax: Number(form.pax) || 1, ratePerPlate: Number(form.ratePerPlate) || 0,
      hallRent: Number(form.hallRent) || 0, decorationAmount: Number(form.decorationAmount) || 0,
      otherCharges: Number(form.otherCharges) || 0, discountAmount: Number(form.discountAmount) || 0,
    };
    try {
      await act('/api/erp/banquets', body);
      notify('Event saved'); onDone();
    } catch (error) {
      if (needsForce(error) && window.confirm(`${(error as Error).message}`)) {
        try { await act('/api/erp/banquets', { ...body, force: true }); notify('Event saved'); onDone(); }
        catch (e2) { notifyError(e2); }
      } else { notifyError(error); }
    } finally { setBusy(false); }
  };

  const estimate = (Number(form.pax) || 0) * (Number(form.ratePerPlate) || 0)
    + (Number(form.hallRent) || 0) + (Number(form.decorationAmount) || 0)
    + (Number(form.otherCharges) || 0) - (Number(form.discountAmount) || 0);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-light">{event.id ? `Edit ${event.eventRef}` : 'New Event Booking'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Hall">
            <Select value={form.hallId} onValueChange={(v) => setForm({ ...form, hallId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{halls.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="From"><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
          <Field label="To"><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(STATUS_META).map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Customer Name" className="col-span-2"><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></Field>
          <Field label="Customer GSTIN (B2B)" className="col-span-2"><Input value={form.customerGstin} onChange={(e) => setForm({ ...form, customerGstin: e.target.value.toUpperCase() })} /></Field>
          <Field label="Pax"><Input type="number" value={form.pax} onChange={(e) => setForm({ ...form, pax: e.target.value })} /></Field>
          <Field label="Rate / Plate"><Input type="number" value={form.ratePerPlate} onChange={(e) => setForm({ ...form, ratePerPlate: e.target.value })} /></Field>
          <Field label="Hall Rent"><Input type="number" value={form.hallRent} onChange={(e) => setForm({ ...form, hallRent: e.target.value })} /></Field>
          <Field label="Decoration"><Input type="number" value={form.decorationAmount} onChange={(e) => setForm({ ...form, decorationAmount: e.target.value })} /></Field>
          <Field label="Other Charges"><Input type="number" value={form.otherCharges} onChange={(e) => setForm({ ...form, otherCharges: e.target.value })} /></Field>
          <Field label="Discount"><Input type="number" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} /></Field>
        </div>
        <Field label="Menu Notes">
          <Textarea rows={2} value={form.menuNotes} placeholder="Veg thali ×300, live chaat counter, 2 mocktail stations…"
            onChange={(e) => setForm({ ...form, menuNotes: e.target.value })} />
        </Field>
        <p className="text-sm bg-cream/60 border border-gold/10 px-3 py-2">
          Estimated value (pre-GST): <strong>{inr(Math.max(0, estimate))}</strong> — final total with GST is computed on save.
        </p>
        <Button onClick={submit} disabled={busy || !form.customerName || !form.customerPhone}
          className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Save Event</Button>
      </DialogContent>
    </Dialog>
  );
}

function HallDialog({ hall, onClose, onDone }: { hall: Partial<Hall>; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    name: hall.name ?? '', capacitySeating: String(hall.capacitySeating ?? ''),
    capacityFloating: String(hall.capacityFloating ?? ''), area: hall.area ?? '', baseRent: String(hall.baseRent ?? ''),
  });
  const submit = async () => {
    try {
      await act('/api/erp/banquets', {
        action: 'hall_save', id: hall.id, ...form,
        capacitySeating: Number(form.capacitySeating) || 0, capacityFloating: Number(form.capacityFloating) || 0,
        baseRent: Number(form.baseRent) || 0,
      });
      notify('Hall saved'); onDone();
    } catch (error) { notifyError(error); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-light">{hall.id ? `Edit — ${hall.name}` : 'New Banquet Hall'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} placeholder="Grand Ballroom" onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seating Capacity"><Input type="number" value={form.capacitySeating} onChange={(e) => setForm({ ...form, capacitySeating: e.target.value })} /></Field>
            <Field label="Floating Capacity"><Input type="number" value={form.capacityFloating} onChange={(e) => setForm({ ...form, capacityFloating: e.target.value })} /></Field>
            <Field label="Area (sq ft)"><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
            <Field label="Base Rent (₹)"><Input type="number" value={form.baseRent} onChange={(e) => setForm({ ...form, baseRent: e.target.value })} /></Field>
          </div>
          <Button onClick={submit} disabled={!form.name} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdvanceDialog({ event, onClose, onDone }: { event: EventRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('upi');
  const [reference, setReference] = useState('');
  const submit = async () => {
    try {
      await act('/api/erp/banquets', { action: 'booking_payment', id: event.id, amount: Number(amount), mode, reference });
      notify('Advance recorded'); onDone();
    } catch (error) { notifyError(error); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-light">
            Advance — {event.eventRef} <span className="text-sm text-muted-foreground">(due {inr(Math.max(0, event.totalAmount - event.advancePaid))})</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Amount"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Mode">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAY_MODES.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Button onClick={submit} disabled={!Number(amount)} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-none">Record</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
