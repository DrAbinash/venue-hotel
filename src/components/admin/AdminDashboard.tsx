'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, IndianRupee, Loader2, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/pricing';
import type { Booking, FoodOrder } from '@/lib/types';

const isToday = (value: string) => new Date(value).toDateString() === new Date().toDateString();

/** A quick read on the day: arrivals, revenue and the state of the kitchen. */
export default function AdminDashboard() {
  const { settings, setAdminTab } = useHotelStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const money = (value: number) => formatMoney(value, settings);

  useEffect(() => {
    Promise.all([
      fetch('/api/bookings').then((res) => (res.ok ? res.json() : [])),
      fetch('/api/orders').then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([bookingData, orderData]) => {
        setBookings(Array.isArray(bookingData) ? bookingData : []);
        setOrders(Array.isArray(orderData) ? orderData : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const live = bookings.filter((booking) => booking.status !== 'cancelled');
    const roomRevenue = live.reduce((sum, booking) => sum + booking.amountPaid, 0);
    const foodRevenue = orders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + order.amountPaid, 0);

    return {
      arrivalsToday: live.filter((booking) => isToday(booking.checkIn)).length,
      departuresToday: live.filter((booking) => isToday(booking.checkOut)).length,
      pendingBookings: bookings.filter((booking) => booking.status === 'pending').length,
      unpaidBookings: live.filter((booking) => booking.paymentStatus !== 'paid').length,
      roomRevenue,
      foodRevenue,
      openOrders: orders.filter((order) => !['completed', 'cancelled', 'served'].includes(order.status)).length,
      ordersToday: orders.filter((order) => isToday(order.createdAt)).length,
    };
  }, [bookings, orders]);

  const upcoming = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status !== 'cancelled' && new Date(booking.checkIn) >= new Date(new Date().toDateString()))
        .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
        .slice(0, 6),
    [bookings],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-16">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your dashboard…
      </div>
    );
  }

  const tiles = [
    { label: 'Arrivals today', value: String(stats.arrivalsToday), hint: `${stats.departuresToday} departing`, icon: CalendarCheck, tab: 'bookings' },
    { label: 'Awaiting confirmation', value: String(stats.pendingBookings), hint: `${stats.unpaidBookings} not fully paid`, icon: TrendingUp, tab: 'bookings' },
    { label: 'Rooms collected', value: money(stats.roomRevenue), hint: 'Payments received to date', icon: IndianRupee, tab: 'payments' },
    { label: 'Open food orders', value: String(stats.openOrders), hint: `${stats.ordersToday} placed today · ${money(stats.foodRevenue)} collected`, icon: UtensilsCrossed, tab: 'orders' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Where things stand right now.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            onClick={() => setAdminTab(tile.tab)}
            className="bg-white border border-gold/10 p-5 text-left hover:border-gold/40 transition-colors cursor-pointer"
          >
            <tile.icon className="w-5 h-5 text-gold mb-3" />
            <p className="text-2xl font-light text-charcoal">{tile.value}</p>
            <p className="text-xs tracking-widest uppercase text-muted-foreground mt-1">{tile.label}</p>
            <p className="text-[11px] text-muted-foreground mt-2">{tile.hint}</p>
          </button>
        ))}
      </div>

      <section className="bg-white border border-gold/10">
        <header className="px-5 py-3 border-b border-gold/10">
          <h3 className="text-sm tracking-widest uppercase text-charcoal">Next Arrivals</h3>
        </header>
        {upcoming.length === 0 ? (
          <p className="p-8 text-sm text-muted-foreground text-center">No upcoming arrivals.</p>
        ) : (
          <div className="divide-y divide-gold/5">
            {upcoming.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-charcoal truncate">
                    {booking.guestName}
                    <span className="text-muted-foreground"> · {booking.roomType}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {booking.bookingRef} · {new Date(booking.checkIn).toLocaleDateString()} → {new Date(booking.checkOut).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="text-sm text-charcoal">{money(booking.totalAmount)}</p>
                  <p className={`text-[11px] ${booking.paymentStatus === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                    {booking.paymentStatus}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
