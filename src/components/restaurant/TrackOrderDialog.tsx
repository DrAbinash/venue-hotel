'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatMoney } from '@/lib/pricing';
import type { HotelSettings } from '@/lib/types';

interface TrackedOrder {
  orderRef: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  amountPaid: number;
  tableNumber: string | null;
  roomNumber: string | null;
  createdAt: string;
  items: { name: string; size: string | null; quantity: number; lineTotal: number }[];
}

interface TrackOrderDialogProps {
  open: boolean;
  onClose: () => void;
  settings: HotelSettings;
  /** Pre-filled from a just-placed order so tracking is one tap away. */
  initialRef?: string;
  initialPhone?: string;
}

/** The journey an order takes; cancelled is shown separately. */
const STEPS: { key: string; label: string }[] = [
  { key: 'placed', label: 'Placed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'preparing', label: 'In the Kitchen' },
  { key: 'ready', label: 'Ready' },
  { key: 'served', label: 'On its Way' },
  { key: 'completed', label: 'Done' },
];

/**
 * Guest-side order tracking against /api/orders/lookup — reference plus the
 * phone used to order. While open on a found order it re-checks every 20
 * seconds, so the status moves as the kitchen board does.
 */
export default function TrackOrderDialog({ open, onClose, settings, initialRef, initialPhone }: TrackOrderDialogProps) {
  const [ref, setRef] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const money = (value: number) => formatMoney(value, settings);

  // Pre-fill from the last placed order each time the dialog opens. Done as a
  // render-time state adjustment (not an effect) so the fields are right on
  // the very first frame the dialog is visible.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    if (initialRef) setRef(initialRef);
    if (initialPhone) setPhone(initialPhone);
    setError(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const lookup = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams({ ref: ref.trim(), phone: phone.trim() });
      const res = await fetch(`/api/orders/lookup?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No order matches those details.');
      setOrder(data);
    } catch (lookupError) {
      if (!quiet) {
        setOrder(null);
        setError(lookupError instanceof Error ? lookupError.message : 'Lookup failed.');
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [ref, phone]);

  // Keep a found order fresh while the dialog stays open.
  useEffect(() => {
    if (!open || !order) return;
    const timer = setInterval(() => lookup(true), 20_000);
    return () => clearInterval(timer);
  }, [open, order, lookup]);

  const stepIndex = order ? STEPS.findIndex((step) => step.key === order.status) : -1;
  const cancelled = order?.status === 'cancelled';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setOrder(null); setError(null); onClose(); } }}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] rounded-none border-gold/20">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide text-charcoal">Track Your Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Order Ref</Label>
              <Input
                value={ref}
                onChange={(event) => setRef(event.target.value.toUpperCase())}
                placeholder="F1A2B3C"
                className="h-11 border-gold/20 bg-cream/30 rounded-none tracking-widest"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs tracking-widest uppercase text-muted-foreground">Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="As used to order"
                className="h-11 border-gold/20 bg-cream/30 rounded-none"
              />
            </div>
          </div>

          <Button
            onClick={() => lookup()}
            disabled={loading || !ref.trim() || phone.replace(/\D/g, '').length < 4}
            className="w-full h-11 bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.2em] uppercase rounded-none"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Find My Order
          </Button>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          {order && (
            <div className="border border-gold/15 bg-cream/40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm tracking-[0.2em] text-charcoal">{order.orderRef}</span>
                <span className={`text-[10px] tracking-widest uppercase px-2 py-1 border ${
                  cancelled ? 'border-red-200 bg-red-50 text-red-700' : 'border-gold/30 bg-white text-gold-dark'
                }`}>
                  {order.status.replace('_', ' ')}
                </span>
              </div>

              {!cancelled && (
                <ol className="space-y-2">
                  {STEPS.map((step, index) => {
                    const reached = stepIndex >= index;
                    const current = stepIndex === index;
                    return (
                      <li key={step.key} className="flex items-center gap-3">
                        <span className={`w-5 h-5 flex items-center justify-center border ${
                          reached ? 'border-gold bg-gold text-white' : 'border-charcoal/15 text-transparent'
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                        <span className={`text-sm ${current ? 'text-charcoal' : reached ? 'text-charcoal/70' : 'text-muted-foreground/60'}`}>
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              <div className="text-sm space-y-1 pt-2 border-t border-gold/10">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between gap-3">
                    <span className="text-charcoal/80">
                      {item.quantity}× {item.name}
                      {item.size ? ` (${item.size})` : ''}
                    </span>
                    <span className="text-muted-foreground">{money(item.lineTotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-gold/10">
                  <span className="text-charcoal">Total</span>
                  <span className="text-gold-dark">{money(order.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Payment</span>
                  <span className="capitalize">{order.paymentStatus}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
