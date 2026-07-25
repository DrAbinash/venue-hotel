'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/pricing';
import type { Booking } from '@/lib/types';

const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  checked_in: 'bg-blue-50 text-blue-700 border-blue-200',
  checked_out: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  no_show: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function AdminBookings() {
  const { toast } = useToast();
  const { settings, bookings, setBookings } = useHotelStore();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Booking | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [notes, setNotes] = useState('');

  const money = (value: number) => formatMoney(value, settings);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings?status=${status}`);
      if (res.ok) setBookings(await res.json());
    } finally {
      setLoading(false);
    }
  }, [status, setBookings]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bookings;
    return bookings.filter((booking) =>
      [booking.bookingRef, booking.guestName, booking.guestEmail, booking.guestPhone, booking.roomType]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [bookings, query]);

  const patch = async (booking: Booking, data: Partial<Booking>) => {
    const res = await fetch('/api/bookings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: booking.id, ...data }),
    });
    const result = await res.json();
    if (!res.ok) {
      toast({ title: result.error || 'Update failed', variant: 'destructive' });
      return;
    }
    toast({ title: 'Booking updated' });
    if (detail?.id === booking.id) setDetail(result);
    load();
  };

  const remove = async (booking: Booking) => {
    if (!confirm(`Delete ${booking.bookingRef} permanently? Cancelling is usually better — it keeps the record.`)) return;
    const res = await fetch(`/api/bookings?id=${booking.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Booking deleted' });
      setDetail(null);
      load();
    }
  };

  const recordPayment = async () => {
    if (!detail) return;
    const amount = Number.parseFloat(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Enter a positive amount', variant: 'destructive' });
      return;
    }
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: detail.id, amount, method: 'cash', note: notes }),
    });
    const result = await res.json();
    if (!res.ok) {
      toast({ title: result.error || 'Could not record the payment', variant: 'destructive' });
      return;
    }
    toast({ title: `Recorded ${money(amount)}` });
    setDetail(result);
    setPayAmount('');
    setNotes('');
    load();
  };

  /** Export what is on screen, so a filtered view exports the same rows. */
  const exportCsv = () => {
    const headers = ['Reference', 'Guest', 'Email', 'Phone', 'Room', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Total', 'Paid', 'Status', 'Payment'];
    const rows = filtered.map((booking) => [
      booking.bookingRef, booking.guestName, booking.guestEmail, booking.guestPhone, booking.roomType,
      booking.checkIn.slice(0, 10), booking.checkOut.slice(0, 10), booking.nights,
      `${booking.adults}+${booking.children}`, booking.totalAmount, booking.amountPaid, booking.status, booking.paymentStatus,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">Reservations</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} shown</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search guests or references"
              className="h-9 pl-9 w-56 text-xs rounded-none border-gold/20"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px] h-9 text-xs rounded-none border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((option) => (
                <SelectItem key={option} value={option}>{option.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
            <Download className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
          <Button variant="outline" onClick={() => { setLoading(true); load(); }} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gold/10 overflow-x-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading reservations…
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-sm text-muted-foreground text-center">No reservations match.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Stay</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((booking) => (
                <TableRow key={booking.id} className="cursor-pointer" onClick={() => { setDetail(booking); setPayAmount(''); }}>
                  <TableCell className="text-xs tracking-wider">{booking.bookingRef}</TableCell>
                  <TableCell>
                    <span className="block text-sm text-charcoal">{booking.guestName}</span>
                    <span className="block text-[11px] text-muted-foreground">{booking.guestEmail}</span>
                  </TableCell>
                  <TableCell className="text-sm">{booking.roomType}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {booking.checkIn.slice(0, 10)} → {booking.checkOut.slice(0, 10)}
                    <span className="block text-[11px] text-muted-foreground">{booking.nights} night(s)</span>
                  </TableCell>
                  <TableCell className="text-right text-sm">{money(booking.totalAmount)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wider rounded-none ${
                        booking.paymentStatus === 'paid'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {booking.paymentStatus}
                    </Badge>
                    {booking.amountPaid > 0 && booking.paymentStatus !== 'paid' && (
                      <span className="block text-[10px] text-muted-foreground mt-1">{money(booking.amountPaid)} paid</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Select value={booking.status} onValueChange={(value) => patch(booking, { status: value })}>
                      <SelectTrigger className={`h-8 w-[135px] text-[11px] uppercase tracking-wider rounded-none ${STATUS_TONE[booking.status] ?? ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((option) => (
                          <SelectItem key={option} value={option}>{option.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ---------------------------------------------------------- detail */}
      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-none border-gold/20">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-light tracking-wide">
                  {detail.bookingRef} · {detail.guestName}
                </DialogTitle>
              </DialogHeader>

              <dl className="text-sm space-y-2">
                {[
                  ['Email', detail.guestEmail],
                  ['Phone', detail.guestPhone],
                  ['Room', detail.roomType],
                  ['Stay', `${detail.checkIn.slice(0, 10)} → ${detail.checkOut.slice(0, 10)} (${detail.nights} nights)`],
                  ['Guests', `${detail.adults} adults, ${detail.children} children`],
                  ['Room charge', money(detail.roomTotal)],
                  ...(detail.extraGuestTotal ? [['Extra guests', money(detail.extraGuestTotal)]] : []),
                  ...(detail.feeAmount ? [['Fees', money(detail.feeAmount)]] : []),
                  ...(detail.taxAmount ? [['Tax', money(detail.taxAmount)]] : []),
                  ['Total', money(detail.totalAmount)],
                  ['Paid', `${money(detail.amountPaid)} (${detail.paymentStatus})`],
                  ['Booked', new Date(detail.createdAt).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-gold/10 pb-1.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-charcoal text-right">{value}</dd>
                  </div>
                ))}
              </dl>

              {detail.specialRequests && (
                <p className="text-sm text-muted-foreground">
                  <span className="text-charcoal">Requests:</span> {detail.specialRequests}
                </p>
              )}

              {detail.payments && detail.payments.length > 0 && (
                <div>
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Payments</p>
                  <div className="space-y-1">
                    {detail.payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between text-xs border-b border-gold/5 pb-1">
                        <span className="text-muted-foreground capitalize">
                          {payment.gateway} · {new Date(payment.createdAt).toLocaleDateString()}
                        </span>
                        <span className={payment.status === 'paid' ? 'text-green-600' : 'text-muted-foreground'}>
                          {money(payment.amount)} · {payment.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.totalAmount - detail.amountPaid > 0 && (
                <div className="border border-gold/15 p-4 space-y-3">
                  <p className="text-xs tracking-widest uppercase text-muted-foreground">
                    Record a payment ({money(detail.totalAmount - detail.amountPaid)} outstanding)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={payAmount}
                      onChange={(event) => setPayAmount(event.target.value)}
                      placeholder={String(detail.totalAmount - detail.amountPaid)}
                      className="rounded-none border-gold/20"
                    />
                    <Button onClick={recordPayment} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none whitespace-nowrap">
                      Record
                    </Button>
                  </div>
                  <Input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Note (optional)"
                    className="rounded-none border-gold/20 text-xs"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs tracking-widest uppercase text-muted-foreground">Internal notes</Label>
                <Textarea
                  rows={3}
                  defaultValue={detail.internalNotes ?? ''}
                  onBlur={(event) => {
                    if (event.target.value !== (detail.internalNotes ?? '')) {
                      patch(detail, { internalNotes: event.target.value });
                    }
                  }}
                  className="rounded-none border-gold/20 resize-none text-sm"
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  onClick={() => remove(detail)}
                  className="text-xs tracking-wider uppercase text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
                <Button onClick={() => setDetail(null)} variant="outline" className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
