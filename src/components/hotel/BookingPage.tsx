'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BedDouble, CalendarDays, CheckCircle, Loader2, Maximize, Search, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/pricing';
import { num, roomImage, text } from '@/lib/content';
import PaymentStep from '@/components/hotel/PaymentStep';
import type { AvailabilityResponse, Booking, GatewayId, RoomAvailability } from '@/lib/types';

const STEPS = [
  { n: 1, label: 'Dates & Room' },
  { n: 2, label: 'Your Details' },
  { n: 3, label: 'Review' },
  { n: 4, label: 'Payment' },
];

export default function BookingPage() {
  const { settings, bookingForm, setBookingForm, setView, resetBookingForm } = useHotelStore();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [outcome, setOutcome] = useState<'paid' | 'reserved' | null>(null);
  const [form, setForm] = useState({ guestName: '', guestEmail: '', guestPhone: '', specialRequests: '' });
  const [agreed, setAgreed] = useState(false);

  const money = useCallback((value: number) => formatMoney(value, settings), [settings]);
  const today = new Date().toISOString().slice(0, 10);

  /** Ask the server what is free and what it costs — never price on the client. */
  const checkAvailability = useCallback(async () => {
    const { checkIn, checkOut, adults, children } = bookingForm;
    if (!checkIn || !checkOut) return;

    try {
      const params = new URLSearchParams({ checkIn, checkOut, adults: String(adults), children: String(children) });
      const res = await fetch(`/api/availability?${params}`);
      const data: AvailabilityResponse = await res.json();
      setAvailability(data);
      if (data.error) toast({ title: data.error, variant: 'destructive' });

      // Drop a selection that the new dates made unavailable.
      if (bookingForm.roomId) {
        const stillFree = data.rooms.find((r) => r.id === bookingForm.roomId)?.isAvailable;
        if (!stillFree) setBookingForm({ roomId: null, roomType: '', basePrice: 0 });
      }
    } catch {
      toast({ title: 'Could not check availability', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  }, [bookingForm, setBookingForm, toast]);

  // Re-run whenever the stay parameters change, not on every render. The
  // results arrive after an await, so this is not a synchronous state cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { checkAvailability(); },
    [bookingForm.checkIn, bookingForm.checkOut, bookingForm.adults, bookingForm.children]);

  const selected: RoomAvailability | null = useMemo(
    () => availability?.rooms.find((r) => r.id === bookingForm.roomId) ?? null,
    [availability, bookingForm.roomId],
  );
  const quote = selected?.quote ?? null;
  const nights = availability?.nights ?? 0;

  const createBooking = async () => {
    if (!agreed) {
      toast({ title: 'Please accept the booking terms to continue.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: bookingForm.roomId,
          checkIn: bookingForm.checkIn,
          checkOut: bookingForm.checkOut,
          adults: bookingForm.adults,
          children: bookingForm.children,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the booking.');

      setBooking(data);
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast({
        title: 'Booking failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      // The dates may have just been taken — refresh what is free.
      checkAvailability();
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    resetBookingForm();
    setBooking(null);
    setOutcome(null);
    setStep(1);
    setForm({ guestName: '', guestEmail: '', guestPhone: '', specialRequests: '' });
    setAgreed(false);
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---------------------------------------------------------------- success
  if (outcome && booking) {
    const paid = outcome === 'paid';
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-lg">
          <CheckCircle className="w-16 h-16 text-gold mx-auto mb-6" />
          <h2 className="text-3xl font-extralight tracking-wide text-charcoal mb-3">
            {paid ? 'Payment Received' : 'Reservation Confirmed'}
          </h2>
          <div className="w-12 h-[1px] bg-gold mx-auto mb-6" />

          <div className="bg-cream/60 border border-gold/15 p-6 text-left space-y-2 text-sm mb-8">
            <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="text-charcoal font-medium tracking-widest">{booking.bookingRef}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Room</span><span className="text-charcoal">{booking.roomType}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stay</span><span className="text-charcoal">{booking.checkIn.slice(0, 10)} → {booking.checkOut.slice(0, 10)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="text-charcoal">{money(booking.totalAmount)}</span></div>
            {paid && (
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="text-charcoal">{money(booking.amountPaid)}</span></div>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-8">
            {paid
              ? `A receipt is on its way to ${booking.guestEmail}. Keep your reference handy at check-in.`
              : `We have held your room. Our team will be in touch at ${booking.guestEmail} to finish the arrangements.`}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={startOver} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-8 py-3 rounded-none">
              Back to Home
            </Button>
            <Button
              variant="outline"
              onClick={() => { setView('my-booking'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="border-gold/30 text-charcoal text-xs tracking-widest uppercase px-8 py-3 rounded-none"
            >
              View My Booking
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ------------------------------------------------------------------ steps
  return (
    <div className="min-h-[80vh] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => { setView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.5em] uppercase mb-3 text-gold">Reservation</p>
          <h1 className="text-3xl md:text-4xl font-extralight tracking-wide text-charcoal">Book Your Stay</h1>
          <div className="w-16 h-[1px] bg-gold mx-auto mt-4" />
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10 flex-wrap">
          {STEPS.map((s) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-all ${
                step >= s.n ? 'bg-gold text-white' : 'bg-cream text-muted-foreground'
              }`}>
                {s.n}
              </div>
              <span className={`text-xs tracking-wider hidden sm:inline ${step >= s.n ? 'text-charcoal' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {s.n < STEPS.length && <div className={`w-6 h-[1px] ${step > s.n ? 'bg-gold' : 'bg-cream-dark'}`} />}
            </div>
          ))}
        </div>

        {/* ---------------------------------------------- Step 1: dates & room */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest uppercase text-muted-foreground">Check-in</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold pointer-events-none" />
                    <input
                      type="date"
                      min={today}
                      value={bookingForm.checkIn}
                      onChange={(e) => setBookingForm({ checkIn: e.target.value })}
                      className="w-full h-11 pl-10 pr-3 border border-gold/20 bg-cream/30 text-sm focus:outline-none focus:border-gold rounded-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest uppercase text-muted-foreground">Check-out</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold pointer-events-none" />
                    <input
                      type="date"
                      min={bookingForm.checkIn || today}
                      value={bookingForm.checkOut}
                      onChange={(e) => setBookingForm({ checkOut: e.target.value })}
                      className="w-full h-11 pl-10 pr-3 border border-gold/20 bg-cream/30 text-sm focus:outline-none focus:border-gold rounded-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest uppercase text-muted-foreground">Adults</Label>
                  <Select value={String(bookingForm.adults)} onValueChange={(v) => setBookingForm({ adults: Number.parseInt(v, 10) })}>
                    <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: num(settings, 'maxAdults', 6) }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} Adult{n > 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-widest uppercase text-muted-foreground">Children</Label>
                  <Select value={String(bookingForm.children)} onValueChange={(v) => setBookingForm({ children: Number.parseInt(v, 10) })}>
                    <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: num(settings, 'maxChildren', 4) + 1 }, (_, i) => i).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} Child{n === 1 ? '' : 'ren'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {checking ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability…</span>
                  ) : nights > 0 ? (
                    `${nights} night${nights > 1 ? 's' : ''} · ${bookingForm.adults + bookingForm.children} guest${bookingForm.adults + bookingForm.children > 1 ? 's' : ''}`
                  ) : (
                    'Choose your dates to see live availability'
                  )}
                </span>
                <button onClick={() => { setChecking(true); checkAvailability(); }} className="text-xs tracking-widest uppercase text-gold hover:text-gold-dark flex items-center gap-1.5 cursor-pointer">
                  <Search className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {availability?.rooms.map((room) => {
                const isSelected = bookingForm.roomId === room.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    disabled={!room.isAvailable}
                    onClick={() => setBookingForm({ roomId: room.id, roomType: room.type, basePrice: room.basePrice })}
                    className={`w-full text-left bg-white border transition-all overflow-hidden flex flex-col sm:flex-row ${
                      isSelected ? 'border-gold ring-1 ring-gold/30' : 'border-gold/10 hover:border-gold/40'
                    } ${room.isAvailable ? 'cursor-pointer' : 'opacity-55 cursor-not-allowed'}`}
                  >
                    <div
                      className="sm:w-56 h-40 sm:h-auto bg-cream bg-cover bg-center flex-shrink-0"
                      style={{ backgroundImage: `url(${roomImage(room.images)})` }}
                    />
                    <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-light tracking-wide text-charcoal">{room.name}</h3>
                          {room.isAvailable && room.available <= 3 && (
                            <span className="text-[10px] tracking-widest uppercase bg-gold/10 text-gold px-2 py-0.5">
                              Only {room.available} left
                            </span>
                          )}
                          {!room.isAvailable && (
                            <span className="text-[10px] tracking-widest uppercase bg-charcoal/5 text-charcoal/50 px-2 py-0.5">
                              {room.fitsGuests === false ? 'Too many guests' : 'Sold out'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                          {room.bedType && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {room.bedType}</span>}
                          {room.size && <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {room.size}</span>}
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Up to {room.maxGuests}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{room.description}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xl font-light text-charcoal">{money(room.basePrice)}</p>
                        <p className="text-[11px] text-muted-foreground">per night</p>
                        {room.quote && nights > 0 && (
                          <p className="text-xs text-gold mt-2">{money(room.quote.totalAmount)} total</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {availability && availability.rooms.length === 0 && (
                <div className="bg-white border border-gold/10 p-8 text-center text-sm text-muted-foreground">
                  {availability.error ?? 'No rooms match those dates. Try a different range.'}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={!selected?.isAvailable}
                className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-8 py-3 rounded-none"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* -------------------------------------------------- Step 2: details */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Full Name *</Label>
                <Input
                  value={form.guestName}
                  onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                  placeholder="Priya Sharma"
                  className="h-11 border-gold/20 bg-cream/30 rounded-none focus:border-gold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Email Address *</Label>
                <Input
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                  placeholder="you@example.com"
                  className="h-11 border-gold/20 bg-cream/30 rounded-none focus:border-gold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Phone Number *</Label>
              <Input
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                placeholder="+91 98765 43210"
                className="h-11 border-gold/20 bg-cream/30 rounded-none focus:border-gold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Special Requests</Label>
              <Textarea
                value={form.specialRequests}
                onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                placeholder="Airport pickup, a high floor, a quiet room, an anniversary…"
                rows={4}
                className="border-gold/20 bg-cream/30 rounded-none focus:border-gold resize-none"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="border-gold/30 text-charcoal text-xs tracking-widest uppercase px-8 py-3 rounded-none">
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!form.guestName || !form.guestEmail || !form.guestPhone}
                className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-8 py-3 rounded-none"
              >
                Review Booking
              </Button>
            </div>
          </motion.div>
        )}

        {/* --------------------------------------------------- Step 3: review */}
        {step === 3 && selected && quote && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs tracking-widest uppercase text-muted-foreground">Room</p>
                <div className="border border-gold/10 p-4">
                  <p className="font-medium text-charcoal">{selected.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {[selected.bedType, selected.size, selected.view].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs tracking-widest uppercase text-muted-foreground">Stay</p>
                <div className="border border-gold/10 p-4 space-y-1 text-sm">
                  <p className="text-muted-foreground">Check-in: <span className="text-charcoal">{bookingForm.checkIn} from {text(settings, 'checkInTime')}</span></p>
                  <p className="text-muted-foreground">Check-out: <span className="text-charcoal">{bookingForm.checkOut} by {text(settings, 'checkOutTime')}</span></p>
                  <p className="text-muted-foreground">Guests: <span className="text-charcoal">{bookingForm.adults} adults, {bookingForm.children} children</span></p>
                  <p className="text-muted-foreground">Duration: <span className="text-charcoal">{nights} night{nights !== 1 ? 's' : ''}</span></p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs tracking-widest uppercase text-muted-foreground">Guest</p>
              <div className="border border-gold/10 p-4 space-y-1 text-sm">
                <p className="text-muted-foreground">Name: <span className="text-charcoal">{form.guestName}</span></p>
                <p className="text-muted-foreground">Email: <span className="text-charcoal">{form.guestEmail}</span></p>
                <p className="text-muted-foreground">Phone: <span className="text-charcoal">{form.guestPhone}</span></p>
                {form.specialRequests && <p className="text-muted-foreground">Requests: <span className="text-charcoal">{form.specialRequests}</span></p>}
              </div>
            </div>

            <div className="bg-charcoal text-white p-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">{money(selected.basePrice)} × {nights} night{nights !== 1 ? 's' : ''}</span>
                <span>{money(quote.roomTotal)}</span>
              </div>
              {quote.extraGuestTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Extra guest charge</span>
                  <span>{money(quote.extraGuestTotal)}</span>
                </div>
              )}
              {quote.feeAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">{text(settings, 'serviceFeeLabel')} ({num(settings, 'serviceFeePercent')}%)</span>
                  <span>{money(quote.feeAmount)}</span>
                </div>
              )}
              {quote.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">{text(settings, 'taxLabel')} ({num(settings, 'taxPercent')}%)</span>
                  <span>{money(quote.taxAmount)}</span>
                </div>
              )}
              <div className="border-t border-white/10 my-3" />
              <div className="flex justify-between items-center">
                <span className="text-sm tracking-wider uppercase">Total</span>
                <span className="text-2xl font-light text-gold">{money(quote.totalAmount)}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-[#c9a96e]" />
              <span>
                {text(settings, 'bookingTerms')}{' '}
                <span className="block mt-1 text-charcoal/70">{text(settings, 'cancellationPolicy')}</span>
              </span>
            </label>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="border-gold/30 text-charcoal text-xs tracking-widest uppercase px-8 py-3 rounded-none">
                Back
              </Button>
              <Button
                onClick={createBooking}
                disabled={submitting || !agreed}
                className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-8 py-3 rounded-none"
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reserving…</> : 'Continue to Payment'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* -------------------------------------------------- Step 4: payment */}
        {step === 4 && booking && (
          <PaymentStep
            booking={booking}
            onPaid={(result) => {
              setBooking({ ...booking, ...result });
              setOutcome('paid');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSkipped={(method: GatewayId) => {
              setBooking({ ...booking, paymentMethod: method });
              if (method !== 'bankTransfer') {
                setOutcome('reserved');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
