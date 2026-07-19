'use client';

import { useHotelStore } from '@/lib/store';
import { CalendarDays, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useMemo } from 'react';

export default function BookingBar() {
  const { rooms, setView, bookingForm, setBookingForm, setSelectedRoom } = useHotelStore();
  const roomTypes = useMemo(() => [...new Set(rooms.map((r) => r.type))], [rooms]);

  const handleSearch = () => {
    if (!bookingForm.checkIn || !bookingForm.checkOut || !bookingForm.roomType) return;
    setView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRoomTypeChange = (type: string) => {
    const room = rooms.find((r) => r.type === type);
    setBookingForm({
      roomType: type,
      roomId: room?.id || null,
      basePrice: room?.basePrice || 0,
    });
    if (room) setSelectedRoom(room);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <section className="relative -mt-12 z-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white p-6 md:p-8 luxury-shadow-lg border border-gold/10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" /> Check In
              </Label>
              <input
                type="date"
                min={today}
                value={bookingForm.checkIn}
                onChange={(e) => setBookingForm({ checkIn: e.target.value })}
                className="w-full h-11 px-3 border border-gold/20 bg-cream/30 text-sm focus:outline-none focus:border-gold transition-colors rounded-none"
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
                onChange={(e) => setBookingForm({ checkOut: e.target.value })}
                className="w-full h-11 px-3 border border-gold/20 bg-cream/30 text-sm focus:outline-none focus:border-gold transition-colors rounded-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                Room Type
              </Label>
              <Select value={bookingForm.roomType} onValueChange={handleRoomTypeChange}>
                <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none">
                  <SelectValue placeholder="Select Room" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Guests
              </Label>
              <div className="flex gap-2">
                <Select
                  value={String(bookingForm.adults)}
                  onValueChange={(v) => setBookingForm({ adults: parseInt(v) })}
                >
                  <SelectTrigger className="h-11 border-gold/20 bg-cream/30 rounded-none flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} Adult{n > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSearch}
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