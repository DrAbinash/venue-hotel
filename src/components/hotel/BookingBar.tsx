'use client';

import { CalendarDays, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHotelStore } from '@/lib/store';
import { num } from '@/lib/content';

/** The quick-search bar that overlaps the hero. Sends guests into step 1. */
export default function BookingBar() {
  const { setView, bookingForm, setBookingForm, settings } = useHotelStore();
  const today = new Date().toISOString().slice(0, 10);

  const search = () => {
    setView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="relative -mt-12 z-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white p-5 md:p-8 luxury-shadow-lg border border-gold/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" /> Check In
              </Label>
              <input
                type="date"
                min={today}
                value={bookingForm.checkIn}
                onChange={(event) => setBookingForm({ checkIn: event.target.value })}
                className="w-full h-11 px-3 border border-gold/20 bg-cream/30 text-sm focus:outline-none focus:border-gold rounded-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" /> Check Out
              </Label>
              <input
                type="date"
                min={bookingForm.checkIn || today}
                value={bookingForm.checkOut}
                onChange={(event) => setBookingForm({ checkOut: event.target.value })}
                className="w-full h-11 px-3 border border-gold/20 bg-cream/30 text-sm focus:outline-none focus:border-gold rounded-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Adults
              </Label>
              <Select
                value={String(bookingForm.adults)}
                onValueChange={(value) => setBookingForm({ adults: Number.parseInt(value, 10) })}
              >
                <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: num(settings, 'maxAdults', 6) }, (_, index) => index + 1).map((count) => (
                    <SelectItem key={count} value={String(count)}>{count} Adult{count > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Children
              </Label>
              <div className="flex gap-2">
                <Select
                  value={String(bookingForm.children)}
                  onValueChange={(value) => setBookingForm({ children: Number.parseInt(value, 10) })}
                >
                  <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: num(settings, 'maxChildren', 4) + 1 }, (_, index) => index).map((count) => (
                      <SelectItem key={count} value={String(count)}>{count}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={search}
                  aria-label="Check availability"
                  className="h-11 px-6 bg-gold hover:bg-gold-dark text-white rounded-none transition-all"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
