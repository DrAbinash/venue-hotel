'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Moon, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  act, api, errorData, fmtDate, inr, needsForce, notify, notifyError, titleCase,
  BOOKING_STATUS_META, HK_STATUS_META, ID_TYPES, INDIAN_STATES, PAY_MODES,
} from '@/components/erp/lib';
import { Chip, Field, PageHeader, Spinner } from '@/components/erp/ui';
import FolioSheet from '@/components/erp/FolioSheet';

interface Unit {
  id: string; unitNumber: string; hkStatus: string; roomId: string;
  roomName: string; roomType: string; basePrice: number; maxGuests: number;
}
interface ChartBooking {
  id: string; bookingRef: string; guestName: string; guestPhone: string;
  roomId: string | null; roomType: string; unitId: string | null;
  checkIn: string; checkOut: string; nights: number; adults: number; children: number;
  status: string; paymentStatus: string; totalAmount: number; amountPaid: number;
  source: string; balance: number | null;
}
interface DeskData {
  businessDate: string; today: string; auditLagDays: number; from: string; days: number;
  units: Unit[]; bookings: ChartBooking[]; arrivals: ChartBooking[]; departures: ChartBooking[];
  stats: { totalUnits: number; occupied: number; occupancyPct: number; arrivalsDue: number; departuresDue: number };
}

const BAR_COLORS: Record<string, string> = {
  pending: 'bg-amber-400/90 hover:bg-amber-500',
  confirmed: 'bg-sky-500/90 hover:bg-sky-600',
  checked_in: 'bg-emerald-600/90 hover:bg-emerald-700',
  checked_out: 'bg-zinc-300 hover:bg-zinc-400 text-zinc-700',
};

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export default function FrontDesk() {
  const [data, setData] = useState<DeskData | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChartBooking | null>(null);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [checkinFor, setCheckinFor] = useState<ChartBooking | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<ChartBooking | null>(null);
  const [folioId, setFolioId] = useState<string | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = from ? `?from=${from}` : '';
      setData(await api<DeskData>(`/api/erp/frontdesk${qs}`));
    } catch (error) { notifyError(error); }
  }, [from]);

  useEffect(() => { load(); }, [load]);

  const openFolioForBooking = async (booking: ChartBooking) => {
    // The folio is created lazily at check-in; look it up via the folios list.
    try {
      const result = await api<{ folios: { id: string; bookingRef: string | null }[] }>('/api/erp/folios');
      const match = result.folios.find((f) => f.bookingRef === booking.bookingRef);
      if (match) setFolioId(match.id);
      else notify('No folio yet — check the guest in first.');
    } catch (error) { notifyError(error); }
  };

  const runNightAudit = async () => {
    if (!data) return;
    if (!window.confirm(
      `Run night audit for ${fmtDate(data.businessDate)}?\n\nThis posts tonight's room charges to all in-house folios, marks no-shows, and rolls the business date forward.`,
    )) return;
    setAuditBusy(true);
    type AuditResult = { postedNights: number; roomCharges: number; noShows: number; newBusinessDate: string };
    const announce = (result: AuditResult) =>
      notify(`Audit done: ${result.postedNights} night(s) posted (${inr(result.roomCharges)}), ${result.noShows} no-show(s). New date ${fmtDate(result.newBusinessDate)}.`);
    try {
      announce(await act<AuditResult>('/api/erp/frontdesk', { action: 'night_audit' }));
      load();
    } catch (error) {
      if (needsForce(error) && window.confirm(`${(error as Error).message}\n\nRun it anyway and move the business date on?`)) {
        try { announce(await act<AuditResult>('/api/erp/frontdesk', { action: 'night_audit', force: true })); load(); }
        catch (e2) { notifyError(e2); }
      } else { notifyError(error); }
    }
    finally { setAuditBusy(false); }
  };

  if (!data) return <Spinner />;

  const dates = Array.from({ length: data.days }, (_, i) => addDaysStr(data.from, i));

  return (
    <div>
      <PageHeader
        title="Front Desk"
        subtitle={`Business date ${fmtDate(data.businessDate)} · ${data.stats.occupied}/${data.stats.totalUnits} occupied (${data.stats.occupancyPct}%)`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-none" onClick={() => setWalkinOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Walk-in
            </Button>
            <Button size="sm" onClick={runNightAudit} disabled={auditBusy}
              className={`rounded-none text-white ${data.auditLagDays > 0 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-charcoal hover:bg-charcoal-light'}`}>
              {auditBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Moon className="w-3.5 h-3.5 mr-1.5" />}
              Night Audit{data.auditLagDays > 0 ? ` (${data.auditLagDays} behind)` : ''}
            </Button>
            <Button variant="ghost" size="sm" onClick={load} className="rounded-none"><RefreshCw className="w-3.5 h-3.5" /></Button>
          </>
        }
      />

      {/* Arrivals / departures rails */}
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <MovementRail title={`Arrivals due (${data.arrivals.length})`} bookings={data.arrivals}
          empty="No arrivals pending" onPick={(b) => setSelected(b)} />
        <MovementRail title={`Departures due (${data.departures.length})`} bookings={data.departures}
          empty="No departures pending" onPick={(b) => setSelected(b)} />
      </div>

      {/* Tape chart */}
      <div className="bg-white border border-gold/10 mb-4">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gold/10">
          <h3 className="text-sm tracking-widest uppercase text-charcoal/80">Room Chart</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setFrom(addDaysStr(data.from, -7))}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs text-muted-foreground">{fmtDate(data.from)} — {fmtDate(dates[dates.length - 1])}</span>
            <Button variant="ghost" size="sm" onClick={() => setFrom(addDaysStr(data.from, 7))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
        <TapeChart data={data} dates={dates} onPick={setSelected} />
        <div className="flex flex-wrap gap-3 px-3 py-2 border-t border-gold/10 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><i className="w-3 h-3 inline-block bg-amber-400" /> Pending</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 inline-block bg-sky-500" /> Confirmed</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 inline-block bg-emerald-600" /> In house</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 inline-block bg-zinc-300" /> Departed</span>
          <span>· Room number chip colour = housekeeping status</span>
        </div>
      </div>

      {/* Dialogs */}
      {selected && (
        <BookingActions
          booking={selected}
          units={data.units}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
          onCheckin={() => { setCheckinFor(selected); setSelected(null); }}
          onCheckout={() => { setCheckoutFor(selected); setSelected(null); }}
          onFolio={() => { openFolioForBooking(selected); setSelected(null); }}
        />
      )}
      {walkinOpen && (
        <WalkinDialog units={data.units} businessDate={data.businessDate}
          onClose={() => setWalkinOpen(false)} onDone={() => { setWalkinOpen(false); load(); }} />
      )}
      {checkinFor && (
        <CheckinDialog booking={checkinFor} units={data.units}
          onClose={() => setCheckinFor(null)} onDone={() => { setCheckinFor(null); load(); }} />
      )}
      {checkoutFor && (
        <CheckoutDialog booking={checkoutFor}
          onClose={() => setCheckoutFor(null)} onDone={(fid) => { setCheckoutFor(null); setFolioId(fid ?? null); load(); }} />
      )}
      <FolioSheet folioId={folioId} onClose={() => setFolioId(null)} onChanged={load} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function MovementRail({ title, bookings, empty, onPick }: {
  title: string; bookings: ChartBooking[]; empty: string; onPick: (b: ChartBooking) => void;
}) {
  return (
    <div className="bg-white border border-gold/10">
      <p className="px-3 py-2 border-b border-gold/10 text-xs tracking-widest uppercase text-charcoal/70">{title}</p>
      <div className="p-2 flex flex-col gap-1 max-h-44 overflow-y-auto">
        {bookings.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3">{empty}</p>}
        {bookings.map((b) => (
          <button key={b.id} onClick={() => onPick(b)}
            className="flex items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-cream/60 cursor-pointer">
            <span className="min-w-0">
              <span className="text-sm text-charcoal block truncate">{b.guestName}</span>
              <span className="text-[11px] text-muted-foreground">{b.bookingRef} · {b.roomType} · {b.nights}N</span>
            </span>
            <Chip label={BOOKING_STATUS_META[b.status]?.label ?? b.status} className={BOOKING_STATUS_META[b.status]?.className} />
          </button>
        ))}
      </div>
    </div>
  );
}

function TapeChart({ data, dates, onPick }: {
  data: DeskData; dates: string[]; onPick: (b: ChartBooking) => void;
}) {
  const byUnit = useMemo(() => {
    const map = new Map<string, ChartBooking[]>();
    for (const b of data.bookings) {
      if (!b.unitId) continue;
      map.set(b.unitId, [...(map.get(b.unitId) ?? []), b]);
    }
    return map;
  }, [data.bookings]);

  const unassigned = data.bookings.filter((b) => !b.unitId && ['pending', 'confirmed', 'checked_in'].includes(b.status));
  const windowEnd = addDaysStr(data.from, data.days);
  const gridCols = { gridTemplateColumns: `170px repeat(${data.days}, minmax(52px, 1fr))` };

  const renderBar = (b: ChartBooking, row: number) => {
    const start = b.checkIn < data.from ? data.from : b.checkIn;
    const end = b.checkOut > windowEnd ? windowEnd : b.checkOut;
    const startIdx = dates.indexOf(start);
    let span = Math.max(1, Math.round((new Date(`${end}T00:00Z`).getTime() - new Date(`${start}T00:00Z`).getTime()) / 86_400_000));
    if (startIdx === -1) return null;
    if (startIdx + span > data.days) span = data.days - startIdx;
    return (
      <button
        key={b.id}
        onClick={() => onPick(b)}
        title={`${b.guestName} · ${b.bookingRef} · ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}`}
        className={`absolute h-7 text-white text-[11px] px-1.5 flex items-center overflow-hidden whitespace-nowrap cursor-pointer transition-colors ${BAR_COLORS[b.status] ?? 'bg-zinc-400'}`}
        style={{
          top: `${row * 36 + 4}px`,
          left: `calc(170px + (100% - 170px) / ${data.days} * ${startIdx} + 2px)`,
          width: `calc((100% - 170px) / ${data.days} * ${span} - 4px)`,
        }}
      >
        {b.guestName}
      </button>
    );
  };

  const groups = useMemo(() => {
    const map = new Map<string, Unit[]>();
    for (const unit of data.units) map.set(unit.roomName, [...(map.get(unit.roomName) ?? []), unit]);
    return [...map.entries()];
  }, [data.units]);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 170 + data.days * 52 }}>
        {/* header */}
        <div className="grid border-b border-gold/15 bg-cream/40" style={gridCols}>
          <div className="px-3 py-1.5 text-[11px] tracking-widest uppercase text-muted-foreground">Room</div>
          {dates.map((d) => (
            <div key={d} className={`px-1 py-1.5 text-center text-[11px] border-l border-gold/10 ${d === data.businessDate ? 'bg-gold/15 font-semibold' : ''} ${d === data.today ? 'text-gold-dark' : 'text-muted-foreground'}`}>
              {new Date(`${d}T00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit' })}
              <span className="block text-[9px] uppercase">{new Date(`${d}T00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short' })}</span>
            </div>
          ))}
        </div>

        {unassigned.length > 0 && (
          <div className="relative border-b border-gold/15 bg-amber-50/40" style={{ height: unassigned.length * 36 }}>
            <div className="grid absolute inset-0" style={gridCols}>
              <div className="px-3 py-2 text-xs text-amber-900">Unassigned ({unassigned.length})</div>
              {dates.map((d) => <div key={d} className="border-l border-gold/8" />)}
            </div>
            {unassigned.map((b, i) => renderBar(b, i))}
          </div>
        )}

        {groups.map(([roomName, units]) => (
          <div key={roomName}>
            <div className="grid bg-cream/30 border-b border-gold/10" style={gridCols}>
              <div className="px-3 py-1 text-[11px] tracking-widest uppercase text-gold-dark">{roomName}</div>
              {dates.map((d) => <div key={d} className="border-l border-gold/8" />)}
            </div>
            {units.map((unit) => {
              const rows = byUnit.get(unit.id) ?? [];
              return (
                <div key={unit.id} className="relative border-b border-gold/8" style={{ height: 36 }}>
                  <div className="grid absolute inset-0" style={gridCols}>
                    <div className="px-3 flex items-center gap-2">
                      <span className={`text-[11px] px-1.5 py-0.5 border ${HK_STATUS_META[unit.hkStatus]?.className ?? ''}`}>{unit.unitNumber}</span>
                    </div>
                    {dates.map((d) => (
                      <div key={d} className={`border-l border-gold/8 ${d === data.businessDate ? 'bg-gold/5' : ''}`} />
                    ))}
                  </div>
                  {rows.map((b) => renderBar(b, 0))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BookingActions({ booking, units, onClose, onChanged, onCheckin, onCheckout, onFolio }: {
  booking: ChartBooking; units: Unit[];
  onClose: () => void; onChanged: () => void;
  onCheckin: () => void; onCheckout: () => void; onFolio: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [moveUnit, setMoveUnit] = useState('');
  const [assignUnit, setAssignUnit] = useState('');
  const typeUnits = units.filter((u) => !booking.roomId || u.roomId === booking.roomId);
  const otherUnits = units.filter((u) => booking.roomId && u.roomId !== booking.roomId);

  const run = async (body: Record<string, unknown>, confirmForce?: string) => {
    setBusy(true);
    try {
      await act('/api/erp/frontdesk', body);
      onChanged();
    } catch (error) {
      if (needsForce(error) && confirmForce && window.confirm(`${(error as Error).message}\n\nProceed anyway?`)) {
        try { await act('/api/erp/frontdesk', { ...body, force: true }); onChanged(); }
        catch (e2) { notifyError(e2); }
      } else {
        notifyError(error);
      }
    } finally { setBusy(false); }
  };

  const meta = BOOKING_STATUS_META[booking.status];
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide flex items-center gap-2">
            {booking.guestName}
            <Chip label={meta?.label ?? booking.status} className={meta?.className} />
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm space-y-1 text-charcoal/80">
          <p>{booking.bookingRef} · {booking.roomType} · {booking.adults}A{booking.children ? `+${booking.children}C` : ''} · {booking.source}</p>
          <p>{fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)} ({booking.nights} night{booking.nights > 1 ? 's' : ''})</p>
          <p>☎ {booking.guestPhone}</p>
          <p>
            Total {inr(booking.totalAmount)} · Paid {inr(booking.amountPaid)}
            {booking.balance !== null && <> · Folio balance <strong className={booking.balance > 0.5 ? 'text-red-700' : 'text-emerald-700'}>{inr(booking.balance)}</strong></>}
          </p>
        </div>

        {['pending', 'confirmed'].includes(booking.status) && (
          <div className="space-y-3 border-t border-gold/10 pt-3">
            <div className="flex gap-2">
              <Select value={assignUnit} onValueChange={setAssignUnit}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Pre-assign a room…" /></SelectTrigger>
                <SelectContent>
                  {typeUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.unitNumber} · {titleCase(u.hkStatus)}</SelectItem>
                  ))}
                  {otherUnits.length > 0 && otherUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.unitNumber} ({u.roomName}) · {titleCase(u.hkStatus)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="rounded-none" disabled={!assignUnit || busy}
                onClick={() => run({ action: 'assign_unit', bookingId: booking.id, unitId: assignUnit }, 'force')}>
                Assign
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onCheckin} className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-none flex-1">Check In</Button>
              <Button variant="outline" className="rounded-none" disabled={busy}
                onClick={() => { const r = window.prompt('Cancellation reason?'); if (r !== null) run({ action: 'cancel', bookingId: booking.id, reason: r }); }}>
                Cancel
              </Button>
              <Button variant="outline" className="rounded-none text-orange-700" disabled={busy}
                onClick={() => { if (window.confirm('Mark this booking as a no-show?')) run({ action: 'no_show', bookingId: booking.id }); }}>
                No Show
              </Button>
            </div>
          </div>
        )}

        {booking.status === 'checked_in' && (
          <div className="space-y-3 border-t border-gold/10 pt-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={onFolio} variant="outline" className="rounded-none flex-1">Open Folio</Button>
              <Button onClick={onCheckout} className="bg-charcoal hover:bg-charcoal-light text-white rounded-none flex-1">Check Out</Button>
            </div>
            <div className="flex gap-2">
              <Select value={moveUnit} onValueChange={setMoveUnit}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Move to room…" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.unitNumber} ({u.roomName}) · {titleCase(u.hkStatus)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="rounded-none" disabled={!moveUnit || busy}
                onClick={() => run({ action: 'room_move', bookingId: booking.id, unitId: moveUnit })}>
                Move
              </Button>
            </div>
          </div>
        )}

        {booking.status === 'checked_out' && (
          <Button onClick={onFolio} variant="outline" className="rounded-none">Open Folio</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

const EMPTY_REG = {
  nationality: 'Indian', idType: 'aadhaar', idNumber: '', address: '', city: '', state: '',
  pincode: '', arrivalFrom: '', nextDestination: '', purposeOfVisit: 'Leisure', vehicleNo: '',
  isForeigner: false, passportNo: '', passportIssuePlace: '', passportIssueDate: '', passportExpiry: '',
  visaNo: '', visaType: '', visaIssueDate: '', visaExpiry: '', arrivedFromCountry: '', arrivalDateInIndia: '',
};

function RegCardFields({ reg, setReg }: {
  reg: typeof EMPTY_REG; setReg: (r: typeof EMPTY_REG) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nationality">
          <Input value={reg.nationality} onChange={(e) => setReg({ ...reg, nationality: e.target.value })} />
        </Field>
        <Field label="Purpose of Visit">
          <Select value={reg.purposeOfVisit} onValueChange={(v) => setReg({ ...reg, purposeOfVisit: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Leisure', 'Business', 'Wedding', 'Medical', 'Pilgrimage', 'Official', 'Other'].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ID Type">
          <Select value={reg.idType} onValueChange={(v) => setReg({ ...reg, idType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ID_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="ID Number">
          <Input value={reg.idNumber} onChange={(e) => setReg({ ...reg, idNumber: e.target.value })} />
        </Field>
      </div>
      <Field label="Address">
        <Input value={reg.address} onChange={(e) => setReg({ ...reg, address: e.target.value })} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="City">
          <Input value={reg.city} onChange={(e) => setReg({ ...reg, city: e.target.value })} />
        </Field>
        <Field label="State">
          <Select value={reg.state || undefined} onValueChange={(v) => setReg({ ...reg, state: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="PIN Code">
          <Input value={reg.pincode} onChange={(e) => setReg({ ...reg, pincode: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Arriving From">
          <Input value={reg.arrivalFrom} onChange={(e) => setReg({ ...reg, arrivalFrom: e.target.value })} />
        </Field>
        <Field label="Going To">
          <Input value={reg.nextDestination} onChange={(e) => setReg({ ...reg, nextDestination: e.target.value })} />
        </Field>
        <Field label="Vehicle No">
          <Input value={reg.vehicleNo} onChange={(e) => setReg({ ...reg, vehicleNo: e.target.value })} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
        <Checkbox checked={reg.isForeigner}
          onCheckedChange={(v) => setReg({ ...reg, isForeigner: Boolean(v), idType: v ? 'passport' : 'aadhaar' })} />
        Foreign national (Form C applies — passport & visa details required)
      </label>

      {reg.isForeigner && (
        <div className="border border-sky-200 bg-sky-50/60 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Passport No">
              <Input value={reg.passportNo} onChange={(e) => setReg({ ...reg, passportNo: e.target.value })} />
            </Field>
            <Field label="Place of Issue">
              <Input value={reg.passportIssuePlace} onChange={(e) => setReg({ ...reg, passportIssuePlace: e.target.value })} />
            </Field>
            <Field label="Passport Issue Date">
              <Input type="date" value={reg.passportIssueDate} onChange={(e) => setReg({ ...reg, passportIssueDate: e.target.value })} />
            </Field>
            <Field label="Passport Expiry">
              <Input type="date" value={reg.passportExpiry} onChange={(e) => setReg({ ...reg, passportExpiry: e.target.value })} />
            </Field>
            <Field label="Visa No">
              <Input value={reg.visaNo} onChange={(e) => setReg({ ...reg, visaNo: e.target.value })} />
            </Field>
            <Field label="Visa Type">
              <Input value={reg.visaType} placeholder="Tourist / Business / e-Visa"
                onChange={(e) => setReg({ ...reg, visaType: e.target.value })} />
            </Field>
            <Field label="Visa Expiry">
              <Input type="date" value={reg.visaExpiry} onChange={(e) => setReg({ ...reg, visaExpiry: e.target.value })} />
            </Field>
            <Field label="Arrived From (Country)">
              <Input value={reg.arrivedFromCountry} onChange={(e) => setReg({ ...reg, arrivedFromCountry: e.target.value })} />
            </Field>
            <Field label="Date of Arrival in India">
              <Input type="date" value={reg.arrivalDateInIndia} onChange={(e) => setReg({ ...reg, arrivalDateInIndia: e.target.value })} />
            </Field>
          </div>
          <p className="text-[11px] text-sky-900">File Form C on indianfrro.gov.in within 24 hours of check-in; save the reference in the reg card later.</p>
        </div>
      )}
    </div>
  );
}

function CheckinDialog({ booking, units, onClose, onDone }: {
  booking: ChartBooking; units: Unit[]; onClose: () => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [reg, setReg] = useState({ ...EMPTY_REG });
  const typeUnits = units.filter((u) => !booking.roomId || u.roomId === booking.roomId);
  const otherUnits = units.filter((u) => booking.roomId && u.roomId !== booking.roomId);

  const submit = async () => {
    if (!unitId) { notifyError(new Error('Pick a room to allocate')); return; }
    setBusy(true);
    const body = { action: 'checkin', bookingId: booking.id, unitId, regCard: reg };
    try {
      await act('/api/erp/frontdesk', body);
      notify(`${booking.guestName} checked in`);
      onDone();
    } catch (error) {
      if (needsForce(error) && window.confirm(`${(error as Error).message}\n\nProceed anyway?`)) {
        try { await act('/api/erp/frontdesk', { ...body, force: true }); notify(`${booking.guestName} checked in`); onDone(); }
        catch (e2) { notifyError(e2); }
      } else { notifyError(error); }
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide">
            Check In — {booking.guestName} <span className="text-muted-foreground text-sm">({booking.bookingRef})</span>
          </DialogTitle>
        </DialogHeader>
        <Field label={`Allocate Room (${booking.roomType})`}>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger><SelectValue placeholder="Choose a room…" /></SelectTrigger>
            <SelectContent>
              {typeUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.unitNumber} · {titleCase(u.hkStatus)}</SelectItem>
              ))}
              {otherUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.unitNumber} ({u.roomName}) · {titleCase(u.hkStatus)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="border-t border-gold/10 pt-3">
          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Registration Card (Guest Register)</p>
          <RegCardFields reg={reg} setReg={setReg} />
        </div>
        <Button onClick={submit} disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-none">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete Check-In'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function CheckoutDialog({ booking, onClose, onDone }: {
  booking: ChartBooking; onClose: () => void; onDone: (folioId?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(booking.balance);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [reference, setReference] = useState('');
  const [allowCredit, setAllowCredit] = useState(false);
  const [creditNote, setCreditNote] = useState('');

  const attempt = async (withPayment: boolean) => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { action: 'checkout', bookingId: booking.id };
      if (withPayment && Number(amount) > 0) body.payment = { amount: Number(amount), mode, reference };
      if (allowCredit) { body.allowCredit = true; body.creditNote = creditNote; }
      const result = await act<{ balance: number; folioId: string }>('/api/erp/frontdesk', body);
      notify(`${booking.guestName} checked out`);
      onDone(result.folioId);
    } catch (error) {
      const data = (error as { data?: { balance?: number; needsSettlement?: boolean } }).data;
      if (data?.needsSettlement && data.balance !== undefined) {
        setBalance(data.balance);
        if (!amount) setAmount(String(Math.max(0, data.balance)));
        notifyError(error);
      } else {
        notifyError(error);
      }
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide">Check Out — {booking.guestName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          {booking.bookingRef} · {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}
          {balance !== null && <> · Balance <strong className={balance > 0.5 ? 'text-red-700' : 'text-emerald-700'}>{inr(balance)}</strong></>}
        </p>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Any unposted room nights are charged automatically at checkout. Collect the balance here, or check out on credit (city ledger).
          </p>
          <div className="flex gap-2">
            <Input type="number" placeholder="Amount to collect now" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{PAY_MODES.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input placeholder="Payment reference (UTR / approval code)" value={reference} onChange={(e) => setReference(e.target.value)} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={allowCredit} onCheckedChange={(v) => setAllowCredit(Boolean(v))} />
            Allow checkout with pending balance (bill to company / city ledger)
          </label>
          {allowCredit && (
            <Textarea placeholder="Credit note — who pays and when?" value={creditNote}
              onChange={(e) => setCreditNote(e.target.value)} />
          )}
          <Button onClick={() => attempt(true)} disabled={busy}
            className="w-full bg-charcoal hover:bg-charcoal-light text-white rounded-none">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Settle & Check Out'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function WalkinDialog({ units, businessDate, onClose, onDone }: {
  units: Unit[]; businessDate: string; onClose: () => void; onDone: () => void;
}) {
  const roomTypes = useMemo(() => {
    const map = new Map<string, Unit>();
    for (const u of units) if (!map.has(u.roomId)) map.set(u.roomId, u);
    return [...map.values()];
  }, [units]);

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    roomId: '', guestName: '', guestPhone: '', guestEmail: '',
    checkIn: businessDate, checkOut: addDaysStr(businessDate, 1),
    adults: '2', children: '0', nightlyRate: '', discountAmount: '', notes: '',
  });
  const [checkinNow, setCheckinNow] = useState(true);
  const [unitId, setUnitId] = useState('');
  const [reg, setReg] = useState({ ...EMPTY_REG });

  const chosenType = roomTypes.find((r) => r.roomId === form.roomId);
  const typeUnits = units.filter((u) => u.roomId === form.roomId);

  const submit = async () => {
    setBusy(true);
    const body: Record<string, unknown> = {
      action: 'walkin',
      ...form,
      adults: Number(form.adults) || 1,
      children: Number(form.children) || 0,
      nightlyRate: form.nightlyRate ? Number(form.nightlyRate) : undefined,
      discountAmount: form.discountAmount ? Number(form.discountAmount) : undefined,
      checkinNow: checkinNow && Boolean(unitId),
      unitId: checkinNow ? unitId : undefined,
      regCard: checkinNow ? reg : undefined,
    };
    try {
      await act('/api/erp/frontdesk', body);
      notify(checkinNow ? 'Walk-in checked in' : 'Walk-in reservation created');
      onDone();
    } catch (error) {
      // The reservation is created before the room is allocated, so a retry
      // must only re-run the check-in — re-posting the walk-in would book the
      // guest twice.
      const created = errorData<{ bookingId?: string; bookingRef?: string }>(error);
      if (needsForce(error) && window.confirm(`${(error as Error).message}\n\nProceed anyway?`)) {
        try {
          if (created?.bookingId) {
            await act('/api/erp/frontdesk', { action: 'checkin', bookingId: created.bookingId, unitId, regCard: reg, force: true });
          } else {
            await act('/api/erp/frontdesk', { ...body, force: true });
          }
          notify('Walk-in checked in');
          onDone();
        } catch (e2) { notifyError(e2); }
      } else {
        notifyError(error);
        // Allocation failed but the booking stands — close and let the desk
        // assign a different room from the chart.
        if (created?.bookingRef) {
          notify(`Reservation ${created.bookingRef} was created — allocate a room from the chart.`);
          onDone();
        }
      }
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-light tracking-wide">New Walk-in</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Guest Name" className="col-span-2 sm:col-span-1">
            <Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} />
          </Field>
          <Field label="Email (optional)" className="col-span-2">
            <Input value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} />
          </Field>
          <Field label="Room Type" className="col-span-2">
            <Select value={form.roomId} onValueChange={(v) => { setForm({ ...form, roomId: v }); setUnitId(''); }}>
              <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                {roomTypes.map((r) => (
                  <SelectItem key={r.roomId} value={r.roomId}>{r.roomName} — {inr(r.basePrice)}/night</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Check-in">
            <Input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          </Field>
          <Field label="Check-out">
            <Input type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </Field>
          <Field label="Adults">
            <Input type="number" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
          </Field>
          <Field label="Children">
            <Input type="number" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />
          </Field>
          <Field label={`Rate/Night (default ${chosenType ? inr(chosenType.basePrice) : '—'})`}>
            <Input type="number" value={form.nightlyRate} placeholder="override"
              onChange={(e) => setForm({ ...form, nightlyRate: e.target.value })} />
          </Field>
          <Field label="Discount (₹, on room total)">
            <Input type="number" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer border-t border-gold/10 pt-3">
          <Checkbox checked={checkinNow} onCheckedChange={(v) => setCheckinNow(Boolean(v))} />
          Check in immediately
        </label>
        {checkinNow && (
          <>
            <Field label="Allocate Room">
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue placeholder={form.roomId ? 'Choose a room…' : 'Pick a room type first'} /></SelectTrigger>
                <SelectContent>
                  {typeUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.unitNumber} · {titleCase(u.hkStatus)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <RegCardFields reg={reg} setReg={setReg} />
          </>
        )}

        <Button onClick={submit} disabled={busy || !form.roomId || !form.guestName || !form.guestPhone}
          className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : checkinNow ? 'Create & Check In' : 'Create Reservation'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
