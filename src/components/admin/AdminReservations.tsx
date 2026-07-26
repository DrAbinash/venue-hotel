'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Loader2, Phone, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { TableReservation } from '@/lib/types';

/** A reservation moves through these states at the host desk. */
const FLOW = ['requested', 'confirmed', 'seated', 'completed'];

const STATUS_TONE: Record<string, string> = {
  requested: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  seated: 'bg-teal-50 text-teal-700 border-teal-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  no_show: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function AdminReservations() {
  const { toast } = useToast();
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [status, setStatus] = useState('all');
  const [when, setWhen] = useState<'today' | 'upcoming' | 'all'>('upcoming');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status });
      if (when === 'today') params.set('date', new Date().toISOString().slice(0, 10));
      const res = await fetch(`/api/reservations?${params.toString()}`);
      if (res.ok) {
        let rows: TableReservation[] = await res.json();
        if (when === 'upcoming') {
          const today = new Date().toISOString().slice(0, 10);
          rows = rows.filter((row) => row.date >= today);
        }
        setReservations(rows);
      }
    } finally {
      setLoading(false);
    }
  }, [status, when]);

  useEffect(() => { load(); }, [load]);

  const advance = async (reservation: TableReservation, next: string) => {
    setReservations((current) =>
      current.map((row) => (row.id === reservation.id ? { ...row, status: next } : row)),
    );
    const res = await fetch('/api/reservations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reservation.id, status: next }),
    });
    if (!res.ok) {
      toast({ title: 'Could not update the reservation', variant: 'destructive' });
      load();
      return;
    }
    toast({ title: `${reservation.reservationRef} → ${next.replace('_', ' ')}` });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">Table Bookings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reservation requests from the website. Confirm them here and the desk stays in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={when} onValueChange={(value) => setWhen(value as typeof when)}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-none border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="all">All dates</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px] h-9 text-xs rounded-none border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['all', ...FLOW, 'cancelled', 'no_show'].map((option) => (
                <SelectItem key={option} value={option}>
                  {option === 'all' ? 'All statuses' : option.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setLoading(true); load(); }} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading reservations…
        </div>
      ) : reservations.length === 0 ? (
        <div className="bg-white border border-gold/10 p-12 text-center">
          <CalendarCheck className="w-10 h-10 text-gold/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No table reservations for this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {reservations.map((reservation) => {
            const nextStatus = FLOW[FLOW.indexOf(reservation.status) + 1];
            const closed = ['cancelled', 'no_show', 'completed'].includes(reservation.status);

            return (
              <article key={reservation.id} className="bg-white border border-gold/10 flex flex-col">
                <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gold/10">
                  <div>
                    <p className="text-sm tracking-widest text-charcoal">{reservation.reservationRef}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {reservation.date} · {reservation.time}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] uppercase tracking-wider rounded-none ${STATUS_TONE[reservation.status] ?? ''}`}>
                    {reservation.status.replace('_', ' ')}
                  </Badge>
                </header>

                <div className="px-4 py-3 flex-1 space-y-1.5 text-sm">
                  <p className="text-charcoal">{reservation.guestName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Party of {reservation.partySize}
                    {reservation.occasion && <span className="text-gold/80">· {reservation.occasion}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {reservation.guestPhone}
                    {reservation.guestEmail && <span> · {reservation.guestEmail}</span>}
                  </p>
                  {reservation.notes && (
                    <p className="text-xs text-gold/90 italic border-l-2 border-gold/30 pl-2 mt-2">{reservation.notes}</p>
                  )}
                </div>

                <footer className="px-4 py-3 border-t border-gold/10 flex items-center justify-end gap-2">
                  {!closed && reservation.status !== 'requested' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => advance(reservation, 'no_show')}
                      className="text-[11px] tracking-wider uppercase text-muted-foreground hover:text-amber-600"
                    >
                      No-show
                    </Button>
                  )}
                  {!closed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => advance(reservation, 'cancelled')}
                      className="text-[11px] tracking-wider uppercase text-muted-foreground hover:text-red-500"
                    >
                      Cancel
                    </Button>
                  )}
                  {nextStatus && !closed && (
                    <Button
                      size="sm"
                      onClick={() => advance(reservation, nextStatus)}
                      className="bg-gold hover:bg-gold-dark text-white text-[11px] tracking-wider uppercase rounded-none"
                    >
                      {nextStatus}
                    </Button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
