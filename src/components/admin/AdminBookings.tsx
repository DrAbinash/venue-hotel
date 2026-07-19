'use client';

import { useHotelStore } from '@/lib/store';
import { useState, useEffect, useCallback } from 'react';
import { Trash2, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Booking } from '@/lib/types';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700', icon: <CheckCircle className="w-3 h-3" /> },
};

export default function AdminBookings() {
  const { bookings, setBookings } = useHotelStore();
  const { toast } = useToast();
  const [viewing, setViewing] = useState<Booking | null>(null);

  const loadBookings = useCallback(async () => {
    const res = await fetch('/api/bookings');
    const data = await res.json();
    setBookings(data);
  }, [setBookings]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleStatusChange = async (bookingId: string, status: string) => {
    await fetch('/api/bookings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bookingId, status }),
    });
    toast({ title: `Booking ${status}` });
    loadBookings();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/bookings?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Booking deleted' });
    loadBookings();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Booking Management</h2>
        <Badge variant="outline" className="text-xs">{bookings.length} bookings</Badge>
      </div>

      <div className="bg-white border border-gold/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gold/10 hover:bg-transparent">
              <TableHead className="text-xs tracking-wider uppercase">Reference</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Guest</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Dates</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Room</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Amount</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Status</TableHead>
              <TableHead className="text-xs tracking-wider uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No bookings yet</TableCell></TableRow>
            )}
            {bookings.map((b) => {
              const sc = statusConfig[b.status] || statusConfig.pending;
              return (
                <TableRow key={b.id} className="border-gold/5">
                  <TableCell className="font-mono text-xs">{b.bookingRef}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{b.guestName}</p>
                    <p className="text-xs text-muted-foreground">{b.guestEmail}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(b.checkIn)} — {formatDate(b.checkOut)}
                  </TableCell>
                  <TableCell className="text-sm">{b.roomType}</TableCell>
                  <TableCell className="text-sm font-medium">${b.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Select value={b.status} onValueChange={(v) => handleStatusChange(b.id, v)}>
                      <SelectTrigger className={`h-7 w-[120px] text-xs rounded-none border-0 ${sc.color}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(b)} className="h-8 w-8 p-0"><Eye className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)} className="h-8 w-8 p-0 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-xl font-light tracking-wider">Booking Details</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 mt-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Reference</p><p className="font-mono">{viewing.bookingRef}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p><Badge className={statusConfig[viewing.status]?.color}>{statusConfig[viewing.status]?.label}</Badge></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Guest</p><p>{viewing.guestName}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p><p>{viewing.guestEmail}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Phone</p><p>{viewing.guestPhone}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Room Type</p><p>{viewing.roomType}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Check-in</p><p>{formatDate(viewing.checkIn)}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Check-out</p><p>{formatDate(viewing.checkOut)}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Guests</p><p>{viewing.adults} Adults, {viewing.children} Children</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p><p className="font-medium text-lg">${viewing.totalAmount.toFixed(2)}</p></div>
              </div>
              {viewing.specialRequests && (
                <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Special Requests</p><p className="mt-1">{viewing.specialRequests}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}