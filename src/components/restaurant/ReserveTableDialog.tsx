'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, Loader2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { num, text } from '@/lib/content';
import type { HotelSettings } from '@/lib/types';

interface ReserveTableDialogProps {
  open: boolean;
  onClose: () => void;
  settings: HotelSettings;
}

const OCCASIONS = ['Birthday', 'Anniversary', 'Business Dinner', 'Family Gathering', 'Other'];

/** Half-hour slots between the kitchen's opening and closing time. */
function timeSlots(openTime: string, closeTime: string): string[] {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(hours)) return null;
    return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
  };
  const start = toMinutes(openTime) ?? 7 * 60;
  let end = toMinutes(closeTime) ?? 23 * 60;
  if (end <= start) end = 23 * 60;

  const slots: string[] = [];
  // The last seating is an hour before close — nobody books a table for closing time.
  for (let minute = start; minute <= end - 60; minute += 30) {
    const hh = String(Math.floor(minute / 60)).padStart(2, '0');
    const mm = String(minute % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

/**
 * The table-reservation request form. Submits to /api/reservations; the host
 * confirms from the admin panel, so the guest is told "requested" honestly
 * rather than promised a table the restaurant has not agreed to.
 */
export default function ReserveTableDialog({ open, onClose, settings }: ReserveTableDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const partyMax = Math.max(1, num(settings, 'reservationPartyMax', 12));

  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    date: today,
    time: '19:30',
    occasion: '',
    notes: '',
  });
  const [partySize, setPartySize] = useState(2);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ reservationRef: string; date: string; time: string; partySize: number } | null>(null);

  const slots = useMemo(
    () => timeSlots(text(settings, 'restaurantOpenTime'), text(settings, 'restaurantCloseTime')),
    [settings],
  );

  const canSubmit =
    form.guestName.trim().length >= 2 &&
    form.guestPhone.replace(/\D/g, '').length >= 7 &&
    form.date >= today &&
    Boolean(form.time);

  const submit = async () => {
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, partySize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not place the reservation.');
      setPlaced(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not place the reservation.');
    } finally {
      setPlacing(false);
    }
  };

  const close = () => {
    setPlaced(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto rounded-none border-gold/20">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide text-charcoal">Reserve a Table</DialogTitle>
        </DialogHeader>

        {placed ? (
          <div className="text-center py-4">
            <CalendarCheck className="w-12 h-12 text-gold mx-auto mb-4" />
            <p className="text-xs tracking-widest uppercase text-muted-foreground">Reservation Reference</p>
            <p className="text-2xl tracking-[0.2em] text-charcoal mt-1 mb-5">{placed.reservationRef}</p>
            <div className="bg-cream/60 border border-gold/15 p-4 text-sm text-left space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{placed.date}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span>{placed.time}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Guests</span><span>{placed.partySize}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>Awaiting confirmation</span></div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              We will confirm on {form.guestPhone}. {text(settings, 'reservationNote')}
            </p>
            <Button onClick={close} className="w-full mt-5 h-12 bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.2em] uppercase rounded-none">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Date *</Label>
                <Input
                  type="date"
                  min={today}
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  className="h-11 border-gold/20 bg-cream/30 rounded-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Time *</Label>
                <Select value={form.time} onValueChange={(value) => setForm({ ...form, time: value })}>
                  <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {slots.map((slot) => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Guests *</Label>
              <div className="flex items-center border border-gold/25 w-fit">
                <button
                  type="button"
                  onClick={() => setPartySize((value) => Math.max(1, value - 1))}
                  className="w-11 h-11 flex items-center justify-center hover:bg-cream cursor-pointer"
                  aria-label="Fewer guests"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-lg font-light">{partySize}</span>
                <button
                  type="button"
                  onClick={() => setPartySize((value) => Math.min(partyMax, value + 1))}
                  className="w-11 h-11 flex items-center justify-center hover:bg-cream cursor-pointer"
                  aria-label="More guests"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                For more than {partyMax} guests, please call {text(settings, 'phone')}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Name *</Label>
                <Input
                  value={form.guestName}
                  onChange={(event) => setForm({ ...form, guestName: event.target.value })}
                  className="h-11 border-gold/20 bg-cream/30 rounded-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Phone *</Label>
                <Input
                  type="tel"
                  value={form.guestPhone}
                  onChange={(event) => setForm({ ...form, guestPhone: event.target.value })}
                  className="h-11 border-gold/20 bg-cream/30 rounded-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={form.guestEmail}
                  onChange={(event) => setForm({ ...form, guestEmail: event.target.value })}
                  className="h-11 border-gold/20 bg-cream/30 rounded-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Occasion</Label>
                <Select value={form.occasion || 'none'} onValueChange={(value) => setForm({ ...form, occasion: value === 'none' ? '' : value })}>
                  <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Just dinner</SelectItem>
                    {OCCASIONS.map((occasion) => <SelectItem key={occasion} value={occasion}>{occasion}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Anything we should know?</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Window table, wheelchair access, allergies…"
                className="border-gold/20 bg-cream/30 rounded-none resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              onClick={submit}
              disabled={!canSubmit || placing}
              className="w-full h-12 bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.2em] uppercase rounded-none"
            >
              {placing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : 'Request Reservation'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
