'use client';

import { useCallback, useEffect, useState } from 'react';
import { BedDouble, Bike, ChefHat, Clock, Loader2, RefreshCw, Store, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/pricing';
import { parseOptions, type MenuAddon } from '@/lib/menu';
import type { FoodOrder } from '@/lib/types';

/** The kitchen board: an order moves left to right through these states. */
const FLOW = ['placed', 'accepted', 'preparing', 'ready', 'served', 'completed'];

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  dine_in: Utensils,
  room_service: BedDouble,
  takeaway: Store,
  delivery: Bike,
  cloud_kitchen: ChefHat,
};

const STATUS_TONE: Record<string, string> = {
  placed: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  preparing: 'bg-amber-50 text-amber-700 border-amber-200',
  ready: 'bg-green-50 text-green-700 border-green-200',
  served: 'bg-teal-50 text-teal-700 border-teal-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const minutesAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

export default function AdminOrders() {
  const { toast } = useToast();
  const { settings } = useHotelStore();
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const money = (value: number) => formatMoney(value, settings);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?status=${status}`);
      if (res.ok) setOrders(await res.json());
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  // The kitchen leaves this open all service; poll quietly so it stays current.
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => load(), 20_000);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  const advance = async (order: FoodOrder, next: string) => {
    setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: next } : item)));
    const res = await fetch('/api/orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order.id, status: next }),
    });
    if (!res.ok) {
      toast({ title: 'Could not update the order', variant: 'destructive' });
      load();
      return;
    }
    toast({ title: `${order.orderRef} → ${next}` });
  };

  const recordCash = async (order: FoodOrder) => {
    const outstanding = order.totalAmount - order.amountPaid;
    if (outstanding <= 0) return;
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, amount: outstanding, method: 'cash' }),
    });
    if (res.ok) {
      toast({ title: `Recorded ${money(outstanding)} for ${order.orderRef}` });
      load();
    } else {
      toast({ title: 'Could not record the payment', variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">Food Orders</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live kitchen queue. {autoRefresh ? 'Refreshing every 20 seconds.' : 'Auto-refresh is off.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px] h-9 text-xs rounded-none border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['all', ...FLOW, 'cancelled'].map((option) => (
                <SelectItem key={option} value={option}>{option === 'all' ? 'All orders' : option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setAutoRefresh((value) => !value)}
            className={`border-gold/20 text-xs tracking-wider uppercase rounded-none ${autoRefresh ? 'text-gold' : ''}`}
          >
            Auto
          </Button>
          <Button variant="outline" onClick={() => { setLoading(true); load(); }} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-gold/10 p-12 text-center text-sm text-muted-foreground">
          No orders yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order) => {
            const Icon = TYPE_ICON[order.orderType] ?? Utensils;
            const nextStatus = FLOW[FLOW.indexOf(order.status) + 1];
            const outstanding = order.totalAmount - order.amountPaid;

            return (
              <article key={order.id} className="bg-white border border-gold/10 flex flex-col">
                <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gold/10">
                  <div>
                    <p className="text-sm tracking-widest text-charcoal">{order.orderRef}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Icon className="w-3.5 h-3.5" />
                      {order.orderType.replace('_', ' ')}
                      {order.tableNumber && ` · Table ${order.tableNumber}`}
                      {order.roomNumber && ` · Room ${order.roomNumber}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider rounded-none ${STATUS_TONE[order.status] ?? ''}`}>
                      {order.status}
                    </Badge>
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" /> {minutesAgo(order.createdAt)}m
                    </p>
                  </div>
                </header>

                <div className="px-4 py-3 flex-1 space-y-1.5">
                  {order.items.map((item) => {
                    const addons = parseOptions<MenuAddon>(item.addons);
                    return (
                      <div key={item.id} className="flex justify-between gap-3 text-sm">
                        <span className="text-charcoal">
                          <span className="text-gold">{item.quantity}×</span> {item.name}
                          {item.size && <span className="text-muted-foreground"> ({item.size})</span>}
                          {addons.length > 0 && (
                            <span className="block text-[11px] text-muted-foreground">+ {addons.map((a) => a.label).join(', ')}</span>
                          )}
                          {item.notes && <span className="block text-[11px] text-gold/80 italic">“{item.notes}”</span>}
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap">{money(item.lineTotal)}</span>
                      </div>
                    );
                  })}

                  {order.deliveryAddress && (
                    <p className="text-xs text-muted-foreground border-l-2 border-gold/30 pl-2 mt-2">
                      Deliver to: {order.deliveryAddress}
                    </p>
                  )}
                  {order.notes && (
                    <p className="text-xs text-gold/90 italic border-l-2 border-gold/30 pl-2 mt-2">{order.notes}</p>
                  )}
                </div>

                <footer className="px-4 py-3 border-t border-gold/10 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {order.customerName} · {order.customerPhone}
                    </span>
                    <span className="text-charcoal">{money(order.totalAmount)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wider rounded-none ${
                        order.paymentStatus === 'paid' ? 'text-green-700 border-green-200 bg-green-50' : 'text-amber-700 border-amber-200 bg-amber-50'
                      }`}
                    >
                      {order.paymentStatus}
                    </Badge>

                    <div className="flex gap-2">
                      {outstanding > 0 && (
                        <Button size="sm" variant="outline" onClick={() => recordCash(order)} className="border-gold/20 text-[11px] tracking-wider uppercase rounded-none">
                          Take {money(outstanding)}
                        </Button>
                      )}
                      {order.status !== 'cancelled' && order.status !== 'completed' && (
                        <Button size="sm" variant="ghost" onClick={() => advance(order, 'cancelled')} className="text-[11px] tracking-wider uppercase text-muted-foreground hover:text-red-500">
                          Cancel
                        </Button>
                      )}
                      {nextStatus && order.status !== 'cancelled' && (
                        <Button size="sm" onClick={() => advance(order, nextStatus)} className="bg-gold hover:bg-gold-dark text-white text-[11px] tracking-wider uppercase rounded-none">
                          {nextStatus}
                        </Button>
                      )}
                    </div>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
