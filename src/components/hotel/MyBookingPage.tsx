'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/pricing';
import { text } from '@/lib/content';

interface LookupResult {
  bookingRef: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomName: string;
  totalAmount: number;
  amountPaid: number;
  status: string;
  paymentStatus: string;
  specialRequests: string | null;
}

const STATUS_COPY: Record<string, string> = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Marked as no-show',
};

/** Guest-facing booking lookup: reference plus email, no account needed. */
export default function MyBookingPage() {
  const { settings, setView } = useHotelStore();
  const [ref, setRef] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<LookupResult | null>(null);

  const money = (value: number) => formatMoney(value, settings);

  const lookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setBooking(null);
    try {
      const params = new URLSearchParams({ ref: ref.trim(), email: email.trim() });
      const res = await fetch(`/api/bookings/lookup?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed.');
      setBooking(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => { setView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.5em] uppercase mb-3 text-gold">Manage</p>
          <h1 className="text-3xl md:text-4xl font-extralight tracking-wide text-charcoal">Find My Booking</h1>
          <div className="w-16 h-[1px] bg-gold mx-auto mt-4" />
        </div>

        <form onSubmit={lookup} className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs tracking-widest uppercase text-muted-foreground">Booking Reference</Label>
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value.toUpperCase())}
              placeholder="ABCD-1234"
              className="h-11 border-gold/20 bg-cream/30 rounded-none focus:border-gold tracking-widest"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs tracking-widest uppercase text-muted-foreground">Email Address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 border-gold/20 bg-cream/30 rounded-none focus:border-gold"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !ref || !email}
            className="w-full bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.3em] uppercase py-5 rounded-none"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</> : <><Search className="w-4 h-4 mr-2" /> Find Booking</>}
          </Button>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        </form>

        {booking && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-white p-6 md:p-8 luxury-shadow border border-gold/10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs tracking-widest uppercase text-muted-foreground">Reference</p>
                <p className="text-xl tracking-[0.2em] text-charcoal">{booking.bookingRef}</p>
              </div>
              <span className="text-[10px] tracking-widest uppercase bg-gold/10 text-gold px-3 py-1.5">
                {STATUS_COPY[booking.status] ?? booking.status}
              </span>
            </div>

            <dl className="text-sm space-y-2">
              {[
                ['Guest', booking.guestName],
                ['Room', booking.roomName],
                ['Check-in', `${booking.checkIn.slice(0, 10)} from ${text(settings, 'checkInTime')}`],
                ['Check-out', `${booking.checkOut.slice(0, 10)} by ${text(settings, 'checkOutTime')}`],
                ['Guests', `${booking.adults} adults, ${booking.children} children`],
                ['Nights', String(booking.nights)],
                ['Total', money(booking.totalAmount)],
                ['Paid', `${money(booking.amountPaid)} (${booking.paymentStatus})`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-gold/10 pb-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-charcoal text-right">{value}</dd>
                </div>
              ))}
            </dl>

            {booking.specialRequests && (
              <p className="text-sm text-muted-foreground mt-4">
                <span className="text-charcoal">Requests:</span> {booking.specialRequests}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-6">
              To change or cancel this reservation, call {text(settings, 'phone')} or write to {text(settings, 'email')} quoting your reference.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
