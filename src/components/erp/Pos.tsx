'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { act, api, fmtDateTime, inr, notify, notifyError, titleCase, PAY_MODES } from '@/components/erp/lib';
import { Chip, EmptyState, Field, PageHeader, Spinner } from '@/components/erp/ui';

interface OrderItem { id: string; name: string; size: string | null; quantity: number; lineTotal: number; notes: string | null }
interface Order {
  id: string; orderRef: string; orderType: string; tableNumber: string | null; roomNumber: string | null;
  bookingRef: string | null; customerName: string; customerPhone: string;
  subtotal: number; taxAmount: number; totalAmount: number; amountPaid: number;
  status: string; paymentStatus: string; paymentMethod: string | null; notes: string | null;
  createdAt: string; items: OrderItem[];
}
interface InHouse { id: string; bookingRef: string; guestName: string; unitNumber: string | null }
interface MenuCategory { id: string; name: string; items: MenuItem[] }
interface MenuItem { id: string; name: string; basePrice: number; isVeg: boolean; isAvailable: boolean; sizes: string }

const STATUS_COLORS: Record<string, string> = {
  placed: 'bg-amber-100 text-amber-900 border-amber-200',
  accepted: 'bg-sky-100 text-sky-800 border-sky-200',
  preparing: 'bg-orange-100 text-orange-800 border-orange-200',
  ready: 'bg-violet-100 text-violet-800 border-violet-200',
  served: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completed: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};
const NEXT: Record<string, { label: string; status: string }[]> = {
  placed: [{ label: 'Accept', status: 'accepted' }, { label: 'Reject', status: 'cancelled' }],
  accepted: [{ label: 'Start Cooking', status: 'preparing' }],
  preparing: [{ label: 'Ready', status: 'ready' }],
  ready: [{ label: 'Served', status: 'served' }],
  served: [{ label: 'Complete', status: 'completed' }],
};

export default function Pos() {
  const [data, setData] = useState<{ orders: Order[]; inHouse: InHouse[]; tableCount: number } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [settle, setSettle] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try { setData(await api('/api/erp/pos')); }
    catch (error) { notifyError(error); }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000); // the kitchen board keeps itself fresh
    return () => clearInterval(timer);
  }, [load]);

  if (!data) return <Spinner />;

  const advance = async (order: Order, status: string) => {
    try { await act('/api/erp/pos', { action: 'update_status', orderId: order.id, status }); load(); }
    catch (error) { notifyError(error); }
  };

  const live = data.orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const recent = data.orders.filter((o) => ['completed', 'cancelled'].includes(o.status));

  return (
    <div>
      <PageHeader
        title="Restaurant POS"
        subtitle={`${live.length} live order${live.length === 1 ? '' : 's'} · auto-refreshes every 30s`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-none" onClick={() => setNewOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Order
            </Button>
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </>
        }
      />

      {live.length === 0 ? <EmptyState message="No live orders — the kitchen is quiet." /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
          {live.map((order) => (
            <div key={order.id} className="bg-white border border-gold/15 p-3.5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{order.orderRef} · {fmtDateTime(order.createdAt)}</p>
                  <p className="text-sm font-medium">
                    {titleCase(order.orderType)}
                    {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
                    {order.roomNumber ? ` · Room ${order.roomNumber}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">{order.customerName} · {order.customerPhone}</p>
                </div>
                <Chip label={titleCase(order.status)} className={STATUS_COLORS[order.status]} />
              </div>
              <ul className="text-sm border-y border-gold/10 py-2 space-y-1">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span>{item.quantity} × {item.name}{item.size ? ` (${item.size})` : ''}
                      {item.notes && <span className="block text-[11px] text-amber-700">“{item.notes}”</span>}
                    </span>
                    <span className="tabular-nums">{inr(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between text-sm">
                <span>Total <strong>{inr(order.totalAmount)}</strong></span>
                <Chip label={order.paymentStatus === 'paid' ? (order.paymentMethod === 'room_folio' ? 'On Room' : 'Paid') : 'Unpaid'}
                  className={order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(NEXT[order.status] ?? []).map((n) => (
                  <Button key={n.status} size="sm" variant={n.status === 'cancelled' ? 'outline' : 'default'}
                    className={`rounded-none h-7 text-xs ${n.status === 'cancelled' ? 'text-red-700' : 'bg-charcoal hover:bg-charcoal-light text-white'}`}
                    onClick={() => advance(order, n.status)}>
                    {n.label}
                  </Button>
                ))}
                {order.paymentStatus !== 'paid' && (
                  <Button size="sm" variant="outline" className="rounded-none h-7 text-xs text-emerald-800"
                    onClick={() => setSettle(order)}>
                    Settle
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <details className="bg-white border border-gold/10 p-4">
          <summary className="text-sm cursor-pointer text-muted-foreground">Last 24h — {recent.length} closed order(s)</summary>
          <div className="mt-3 space-y-1.5">
            {recent.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-gold/8 pb-1.5">
                <span className="font-mono text-xs">{order.orderRef}</span>
                <span className="text-xs">{titleCase(order.orderType)}{order.roomNumber ? ` · Rm ${order.roomNumber}` : ''}{order.tableNumber ? ` · T${order.tableNumber}` : ''}</span>
                <span className="tabular-nums">{inr(order.totalAmount)}</span>
                <span className="flex gap-1.5">
                  <Chip label={titleCase(order.status)} className={STATUS_COLORS[order.status]} />
                  {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                    <Button size="sm" variant="outline" className="rounded-none h-6 text-[11px]" onClick={() => setSettle(order)}>Settle</Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {newOpen && <NewOrderDialog tableCount={data.tableCount} inHouse={data.inHouse}
        onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); load(); }} />}
      {settle && <SettleDialog order={settle} inHouse={data.inHouse}
        onClose={() => setSettle(null)} onDone={() => { setSettle(null); load(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SettleDialog({ order, inHouse, onClose, onDone }: {
  order: Order; inHouse: InHouse[]; onClose: () => void; onDone: () => void;
}) {
  const due = Math.max(0, order.totalAmount - order.amountPaid);
  const [mode, setMode] = useState('cash');
  const [amount, setAmount] = useState(String(due));
  const [bookingId, setBookingId] = useState('');
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    setBusy(true);
    try {
      await act('/api/erp/pos', { action: 'record_payment', orderId: order.id, amount: Number(amount), mode });
      notify('Payment recorded'); onDone();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  const toRoom = async () => {
    setBusy(true);
    try {
      await act('/api/erp/pos', { action: 'post_to_room', orderId: order.id, bookingId: bookingId || undefined });
      notify('Posted to room folio'); onDone();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide">Settle {order.orderRef} — due {inr(due)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs tracking-widest uppercase text-muted-foreground">Collect now</p>
          <div className="flex gap-2">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{PAY_MODES.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={pay} disabled={busy || !Number(amount)} className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-none">Take</Button>
          </div>
          <div className="border-t border-gold/10 pt-3">
            <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">…or bill to an in-house room</p>
            <div className="flex gap-2">
              <Select value={bookingId} onValueChange={setBookingId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={order.bookingRef ? `Auto: ${order.bookingRef}` : 'Pick the stay…'} />
                </SelectTrigger>
                <SelectContent>
                  {inHouse.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.unitNumber ? `Room ${b.unitNumber}` : b.bookingRef} — {b.guestName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={toRoom} disabled={busy || (!bookingId && !order.bookingRef && !order.roomNumber)}
                variant="outline" className="rounded-none">
                <UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" /> Post to Room
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">The amount lands on the guest folio and is collected at checkout.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

interface CartRow { menuItemId: string; name: string; unitPrice: number; quantity: number }

function NewOrderDialog({ tableCount, inHouse, onClose, onDone }: {
  tableCount: number; inHouse: InHouse[]; onClose: () => void; onDone: () => void;
}) {
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [category, setCategory] = useState('');
  const [cart, setCart] = useState<CartRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    orderType: 'dine_in', tableNumber: '', bookingId: '', customerName: 'Walk-in Guest', customerPhone: '0000000000', notes: '',
  });

  useEffect(() => {
    api<MenuCategory[]>('/api/menu')
      .then((cats) => { setMenu(cats); if (cats.length) setCategory(cats[0].id); })
      .catch(notifyError);
  }, []);

  const activeItems = useMemo(
    () => menu?.find((c) => c.id === category)?.items.filter((i) => i.isAvailable) ?? [],
    [menu, category],
  );
  const total = cart.reduce((s, r) => s + r.unitPrice * r.quantity, 0);

  const bump = (item: MenuItem, delta: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((r) => r.menuItemId === item.id);
      if (idx === -1) {
        return delta > 0 ? [...prev, { menuItemId: item.id, name: item.name, unitPrice: item.basePrice, quantity: 1 }] : prev;
      }
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + delta };
      return next.filter((r) => r.quantity > 0);
    });
  };

  const submit = async () => {
    if (!cart.length) return;
    setBusy(true);
    try {
      const stay = inHouse.find((b) => b.id === form.bookingId);
      // Orders go through the same engine as the website so pricing, taxes
      // and stock rules stay in one place.
      await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          orderType: form.orderType,
          tableNumber: form.orderType === 'dine_in' ? form.tableNumber || null : null,
          roomNumber: form.orderType === 'room_service' ? stay?.unitNumber ?? null : null,
          bookingRef: form.orderType === 'room_service' ? stay?.bookingRef ?? null : null,
          customerName: stay?.guestName ?? form.customerName,
          customerPhone: form.customerPhone,
          notes: form.notes || null,
          items: cart.map((r) => ({ menuItemId: r.menuItemId, quantity: r.quantity })),
        }),
      });
      notify('Order placed');
      onDone();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-light tracking-wide">New Order (Staff)</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Type">
            <Select value={form.orderType} onValueChange={(v) => setForm({ ...form, orderType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dine_in">Dine In</SelectItem>
                <SelectItem value="room_service">Room Service</SelectItem>
                <SelectItem value="takeaway">Takeaway</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.orderType === 'dine_in' && (
            <Field label="Table">
              <Select value={form.tableNumber} onValueChange={(v) => setForm({ ...form, tableNumber: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: tableCount }, (_, i) => String(i + 1)).map((t) => (
                    <SelectItem key={t} value={t}>Table {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {form.orderType === 'room_service' && (
            <Field label="Guest / Room" className="col-span-2">
              <Select value={form.bookingId} onValueChange={(v) => setForm({ ...form, bookingId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick in-house guest…" /></SelectTrigger>
                <SelectContent>
                  {inHouse.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.unitNumber ? `Room ${b.unitNumber}` : b.bookingRef} — {b.guestName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {form.orderType !== 'room_service' && (
            <Field label="Customer">
              <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </Field>
          )}
          <Field label="Phone">
            <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
          </Field>
        </div>

        {!menu ? <Spinner label="Loading menu…" /> : (
          <div className="grid md:grid-cols-[1fr_260px] gap-4">
            <div>
              <div className="flex gap-1.5 overflow-x-auto pb-2">
                {menu.map((c) => (
                  <button key={c.id} onClick={() => setCategory(c.id)}
                    className={`px-3 py-1.5 text-xs whitespace-nowrap border cursor-pointer ${category === c.id ? 'bg-gold text-white border-gold' : 'border-gold/20 text-charcoal/70 hover:border-gold'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                {activeItems.map((item) => {
                  const inCart = cart.find((r) => r.menuItemId === item.id);
                  return (
                    <button key={item.id} onClick={() => bump(item, 1)}
                      className={`text-left border p-2.5 cursor-pointer transition-colors ${inCart ? 'border-gold bg-cream/60' : 'border-gold/15 hover:border-gold/50'}`}>
                      <span className="flex items-center gap-1.5">
                        <i className={`w-2.5 h-2.5 border flex-shrink-0 ${item.isVeg ? 'border-emerald-600' : 'border-red-600'}`}>
                          <i className={`block w-1.5 h-1.5 m-[1px] rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-red-600'}`} />
                        </i>
                        <span className="text-xs font-medium truncate">{item.name}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground mt-1">{inr(item.basePrice)}{inCart ? ` · ×${inCart.quantity}` : ''}</span>
                    </button>
                  );
                })}
                {activeItems.length === 0 && <p className="text-xs text-muted-foreground col-span-3 py-6 text-center">No dishes in this category.</p>}
              </div>
            </div>

            <div className="border border-gold/15 p-3 h-fit">
              <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Order</p>
              {cart.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Tap dishes to add</p>}
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {cart.map((row) => (
                  <div key={row.menuItemId} className="flex items-center justify-between gap-1 text-sm">
                    <span className="truncate flex-1">{row.name}</span>
                    <span className="flex items-center gap-1">
                      <button className="border w-5 h-5 flex items-center justify-center cursor-pointer" onClick={() => bump({ id: row.menuItemId } as MenuItem, -1)}><Minus className="w-3 h-3" /></button>
                      <span className="w-5 text-center tabular-nums">{row.quantity}</span>
                      <button className="border w-5 h-5 flex items-center justify-center cursor-pointer"
                        onClick={() => setCart((prev) => prev.map((r) => r.menuItemId === row.menuItemId ? { ...r, quantity: r.quantity + 1 } : r))}>
                        <Plus className="w-3 h-3" />
                      </button>
                    </span>
                    <span className="w-16 text-right tabular-nums text-xs">{inr(row.unitPrice * row.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gold/10 mt-2 pt-2 flex justify-between text-sm">
                <span>Subtotal</span><strong className="tabular-nums">{inr(total)}</strong>
              </div>
              <p className="text-[11px] text-muted-foreground">Taxes & fees are computed on the server at placement.</p>
              <Input className="mt-2" placeholder="Kitchen notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={submit} disabled={busy || cart.length === 0}
                className="w-full mt-2 bg-gold hover:bg-gold-dark text-white rounded-none">
                Place Order
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
