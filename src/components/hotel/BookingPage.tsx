'use client';

import { useHotelStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Users, BedDouble, CreditCard, CheckCircle, ArrowLeft, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Booking } from '@/lib/types';

export default function BookingPage() {
  const {
    rooms, settings, bookingForm, setBookingForm, selectedRoom,
    setSelectedRoom, setView, bookings, setBookings,
  } = useHotelStore();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [form, setForm] = useState({
    guestName: '', guestEmail: '', guestPhone: '', specialRequests: '',
  });
  const nights = useMemo(() => {
    if (bookingForm.checkIn && bookingForm.checkOut) {
      const d1 = new Date(bookingForm.checkIn);
      const d2 = new Date(bookingForm.checkOut);
      return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    }
    return 0;
  }, [bookingForm.checkIn, bookingForm.checkOut]);

  const total = useMemo(() => {
    return nights * (selectedRoom?.basePrice || bookingForm.basePrice || 0);
  }, [nights, selectedRoom, bookingForm.basePrice]);

  const handleRoomSelect = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      setSelectedRoom(room);
      setBookingForm({ roomId: room.id, roomType: room.type, basePrice: room.basePrice });
    }
  };

  const handleSubmit = async () => {
    if (!form.guestName || !form.guestEmail || !form.guestPhone) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    if (!bookingForm.checkIn || !bookingForm.checkOut || !bookingForm.roomType) {
      toast({ title: 'Please select dates and room type', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingForm,
          ...form,
        }),
      });
      const booking: Booking = await res.json();
      if (booking.id) {
        setBookingRef(booking.bookingRef);
        setSubmitted(true);
        const updated = await fetch('/api/bookings').then((r) => r.json());
        setBookings(updated);
      }
    } catch {
      toast({ title: 'Booking failed. Please try again.', variant: 'destructive' });
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <CheckCircle className="w-20 h-20 text-gold mx-auto mb-6" />
          <h2 className="text-3xl font-extralight tracking-wide text-charcoal mb-3">Booking Confirmed!</h2>
          <div className="w-12 h-[1px] bg-gold mx-auto mb-6" />
          <p className="text-muted-foreground mb-2">Your reservation has been received.</p>
          <p className="text-sm text-muted-foreground mb-6">
            Reference: <span className="font-medium text-charcoal">{bookingRef}</span>
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            A confirmation email has been sent to {form.guestEmail}.
            Our team will review and confirm your booking shortly.
          </p>
          <Button
            onClick={() => { setView('home'); setSubmitted(false); setStep(1); setForm({ guestName: '', guestEmail: '', guestPhone: '', specialRequests: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-8 py-3 rounded-none"
          >
            Back to Home
          </Button>
        </motion.div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

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
          <p className="text-xs tracking-[0.5em] uppercase mb-3" style={{ color: '#c9a96e' }}>Reservation</p>
          <h1 className="text-3xl md:text-4xl font-extralight tracking-wide text-charcoal">
            Book Your Stay
          </h1>
          <div className="w-16 h-[1px] bg-gold mx-auto mt-4" />
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {[
            { n: 1, label: 'Dates & Room' },
            { n: 2, label: 'Your Details' },
            { n: 3, label: 'Review' },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-all ${
                step >= s.n ? 'bg-gold text-white' : 'bg-cream text-muted-foreground'
              }`}>
                {s.n}
              </div>
              <span className={`text-xs tracking-wider hidden sm:inline ${
                step >= s.n ? 'text-charcoal' : 'text-muted-foreground'
              }`}>
                {s.label}
              </span>
              {s.n < 3 && <div className={`w-8 h-[1px] ${step > s.n ? 'bg-gold' : 'bg-cream-dark'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Dates & Room */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10 space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Check-in Date *</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold" />
                  <input
                    type="date"
                    min={today}
                    value={bookingForm.checkIn}
                    onChange={(e) => setBookingForm({ checkIn: e.target.value })}
                    className="w-full h-11 pl-10 pr-3 border border-gold/20 bg-cream/30 text-sm focus:outline-none focus:border-gold transition-colors rounded-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Check-out Date *</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold" />
                  <input
                    type="date"
                    min={bookingForm.checkIn || today}
                    value={bookingForm.checkOut}
                    onChange={(e) => setBookingForm({ checkOut: e.target.value })}
                    className="w-full h-11 pl-10 pr-3 border border-gold/20 bg-cream/30 text-sm focus:outline-none focus:border-gold transition-colors rounded-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Select Room *</Label>
              <Select
                value={bookingForm.roomId || ''}
                onValueChange={handleRoomSelect}
              >
                <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none">
                  <SelectValue placeholder="Choose a room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name} — ${room.basePrice}/night
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Adults</Label>
                <Select value={String(bookingForm.adults)} onValueChange={(v) => setBookingForm({ adults: parseInt(v) })}>
                  <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} Adult{n > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Children</Label>
                <Select value={String(bookingForm.children)} onValueChange={(v) => setBookingForm({ children: parseInt(v) })}>
                  <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} Child{n !== 1 ? 'ren' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedRoom && (
              <div className="bg-cream/50 p-4 border border-gold/10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-charcoal">{selectedRoom.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedRoom.type} • {selectedRoom.bedType} • {selectedRoom.size}</p>
                    <p className="text-sm text-muted-foreground">Max {selectedRoom.maxGuests} guests</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-light text-charcoal">${selectedRoom.basePrice}</p>
                    <p className="text-xs text-muted-foreground">per night</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-8 py-3 rounded-none"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Guest Details */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10 space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Full Name *</Label>
                <Input
                  value={form.guestName}
                  onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                  placeholder="John Doe"
                  className="h-11 border-gold/20 bg-cream/30 rounded-none focus:border-gold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Email Address *</Label>
                <Input
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                  placeholder="john@example.com"
                  className="h-11 border-gold/20 bg-cream/30 rounded-none focus:border-gold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Phone Number *</Label>
              <Input
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="h-11 border-gold/20 bg-cream/30 rounded-none focus:border-gold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Special Requests</Label>
              <Textarea
                value={form.specialRequests}
                onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                placeholder="Any special requirements or preferences?"
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
                className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-8 py-3 rounded-none"
              >
                Review Booking
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10 space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs tracking-widest uppercase text-muted-foreground">Room Details</p>
                <div className="border border-gold/10 p-4">
                  <p className="font-medium text-charcoal">{selectedRoom?.name || bookingForm.roomType}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedRoom?.bedType} • {selectedRoom?.size}</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs tracking-widest uppercase text-muted-foreground">Stay Details</p>
                <div className="border border-gold/10 p-4 space-y-1 text-sm">
                  <p className="text-muted-foreground">Check-in: <span className="text-charcoal">{bookingForm.checkIn}</span></p>
                  <p className="text-muted-foreground">Check-out: <span className="text-charcoal">{bookingForm.checkOut}</span></p>
                  <p className="text-muted-foreground">Guests: <span className="text-charcoal">{bookingForm.adults} Adults, {bookingForm.children} Children</span></p>
                  <p className="text-muted-foreground">Duration: <span className="text-charcoal">{nights} Night{nights !== 1 ? 's' : ''}</span></p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs tracking-widest uppercase text-muted-foreground">Guest Information</p>
              <div className="border border-gold/10 p-4 space-y-1 text-sm">
                <p className="text-muted-foreground">Name: <span className="text-charcoal">{form.guestName}</span></p>
                <p className="text-muted-foreground">Email: <span className="text-charcoal">{form.guestEmail}</span></p>
                <p className="text-muted-foreground">Phone: <span className="text-charcoal">{form.guestPhone}</span></p>
                {form.specialRequests && (
                  <p className="text-muted-foreground">Requests: <span className="text-charcoal">{form.specialRequests}</span></p>
                )}
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-charcoal text-white p-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white/60 text-sm">${selectedRoom?.basePrice || bookingForm.basePrice} × {nights} nights</span>
                <span className="text-sm">${total}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-white/60 text-sm">Taxes & Fees (18%)</span>
                <span className="text-sm">${(total * 0.18).toFixed(2)}</span>
              </div>
              <div className="border-t border-white/10 my-3" />
              <div className="flex justify-between items-center">
                <span className="text-sm tracking-wider uppercase">Total</span>
                <span className="text-2xl font-light" style={{ color: '#c9a96e' }}>
                  ${(total * 1.18).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="border-gold/30 text-charcoal text-xs tracking-widest uppercase px-8 py-3 rounded-none">
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-8 py-3 rounded-none"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Confirm Booking
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}