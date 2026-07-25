'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote, BedDouble, Bike, CheckCircle, CreditCard, Landmark, Loader2, Minus, Plus,
  ShoppingBag, Store, Trash2, Utensils,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import { useOrderStore } from '@/lib/order-store';
import { formatMoney } from '@/lib/pricing';
import { bool, num, text } from '@/lib/content';
import { ORDER_TYPES, computeOrderTotals, lineTotal, type OrderType } from '@/lib/menu';
import { loadRazorpayCheckout, openRazorpayCheckout } from '@/lib/razorpay-client';
import type { FoodOrder, GatewayId, PaymentConfig } from '@/lib/types';

const TYPE_ICON: Record<OrderType, React.ComponentType<{ className?: string }>> = {
  dine_in: Utensils,
  room_service: BedDouble,
  takeaway: Store,
  delivery: Bike,
};

const GATEWAY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  razorpay: CreditCard,
  icici: Landmark,
  payAtHotel: Banknote,
  bankTransfer: Landmark,
};

/**
 * The basket and checkout, as a bottom sheet on phones and a side panel on
 * larger screens. Order type drives which fields are asked for and which fees
 * apply; totals mirror the server's own calculation.
 */
export default function CartSheet() {
  const { settings } = useHotelStore();
  const { toast } = useToast();
  const { lines, orderType, setOrderType, setQuantity, remove, clear, cartOpen, setCartOpen } = useOrderStore();

  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<FoodOrder | null>(null);
  const [method, setMethod] = useState<GatewayId | 'later'>('later');
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    tableNumber: '',
    roomNumber: '',
    bookingRef: '',
    deliveryAddress: '',
    notes: '',
  });

  const money = (value: number) => formatMoney(value, settings);

  useEffect(() => {
    fetch('/api/payments/config')
      .then((res) => res.json())
      .then((data: PaymentConfig) => setConfig(data))
      .catch(() => undefined);
  }, []);

  const enabledTypes = useMemo(
    () => ORDER_TYPES.filter((type) => bool(settings, type.settingKey)),
    [settings],
  );

  // Keep the selected fulfilment type valid if an admin switches one off.
  useEffect(() => {
    if (enabledTypes.length && !enabledTypes.some((type) => type.id === orderType)) {
      setOrderType(enabledTypes[0].id);
    }
  }, [enabledTypes, orderType, setOrderType]);

  const totals = useMemo(
    () =>
      computeOrderTotals(lines, orderType, {
        taxPercent: num(settings, 'foodTaxPercent', 0),
        packagingFee: num(settings, 'packagingFee', 0),
        deliveryFee: num(settings, 'deliveryFee', 0),
        roomServiceFee: num(settings, 'roomServiceFee', 0),
      }),
    [lines, orderType, settings],
  );

  const onlineMethods = config?.methods.filter((option) => option.online) ?? [];
  const payLaterAllowed = bool(settings, 'orderPayAtCounterEnabled');
  const chargeToRoomAllowed = bool(settings, 'orderChargeToRoomEnabled') && orderType === 'room_service';

  const payForOrder = async (order: FoodOrder, gateway: GatewayId) => {
    const res = await fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderRef: order.orderRef, gateway }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not start the payment.');

    if (data.gateway === 'icici') {
      window.location.href = data.redirectUrl;
      return;
    }

    if (data.gateway === 'razorpay') {
      const ready = await loadRazorpayCheckout();
      if (!ready) throw new Error('Could not reach Razorpay. Please try again.');
      openRazorpayCheckout({
        key: data.keyId,
        amount: data.amountMinor,
        currency: data.currency,
        name: data.name,
        description: data.description,
        order_id: data.orderId,
        prefill: data.prefill,
        theme: { color: data.themeColor },
        modal: { ondismiss: () => setPlacing(false) },
        handler: async (response) => {
          try {
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            const verified = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verified.error || 'Verification failed.');
            setPlaced({ ...order, paymentStatus: verified.paymentStatus ?? 'paid', status: verified.status ?? order.status });
            clear();
          } catch (error) {
            toast({
              title: 'Payment taken but not verified',
              description: error instanceof Error ? error.message : `Quote order ${order.orderRef}.`,
              variant: 'destructive',
            });
          } finally {
            setPlacing(false);
          }
        },
      });
    }
  };

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType,
          ...form,
          bookingRef: chargeToRoomAllowed ? form.bookingRef : '',
          items: lines.map((line) => ({
            menuItemId: line.menuItemId,
            size: line.size,
            quantity: line.quantity,
            addons: line.addons.map((addon) => addon.label),
            notes: line.notes,
          })),
        }),
      });
      const order: FoodOrder = await res.json();
      if (!res.ok) throw new Error((order as unknown as { error?: string }).error || 'Could not place the order.');

      if (method === 'later') {
        if (payLaterAllowed) {
          await fetch('/api/payments/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderRef: order.orderRef, gateway: 'payAtHotel' }),
          }).catch(() => undefined);
        }
        setPlaced(order);
        clear();
        setPlacing(false);
        return;
      }

      await payForOrder(order, method);
    } catch (error) {
      toast({
        title: 'Order failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      setPlacing(false);
    }
  };

  const canSubmit =
    lines.length > 0 &&
    form.customerName.trim().length >= 2 &&
    form.customerPhone.replace(/\D/g, '').length >= 7 &&
    (orderType !== 'dine_in' || form.tableNumber.trim().length > 0) &&
    (orderType !== 'room_service' || form.roomNumber.trim().length > 0) &&
    (orderType !== 'delivery' || form.deliveryAddress.trim().length >= 10);

  return (
    <Sheet
      open={cartOpen}
      onOpenChange={(open) => {
        setCartOpen(open);
        if (!open) setPlaced(null);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col rounded-none border-gold/20">
        <SheetHeader className="px-5 py-4 border-b border-gold/15">
          <SheetTitle className="text-lg font-light tracking-wide text-charcoal flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-gold" />
            {placed ? 'Order Placed' : 'Your Order'}
          </SheetTitle>
        </SheetHeader>

        {/* ------------------------------------------------------ confirmation */}
        {placed ? (
          <div className="flex-1 overflow-y-auto p-6 text-center">
            <CheckCircle className="w-14 h-14 text-gold mx-auto mb-5" />
            <p className="text-xs tracking-widest uppercase text-muted-foreground">Order Reference</p>
            <p className="text-2xl tracking-[0.2em] text-charcoal mt-1 mb-6">{placed.orderRef}</p>
            <div className="bg-cream/60 border border-gold/15 p-4 text-left text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{money(placed.totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="capitalize">{placed.paymentStatus}</span></div>
              {placed.tableNumber && <div className="flex justify-between"><span className="text-muted-foreground">Table</span><span>{placed.tableNumber}</span></div>}
              {placed.roomNumber && <div className="flex justify-between"><span className="text-muted-foreground">Room</span><span>{placed.roomNumber}</span></div>}
            </div>
            <p className="text-sm text-muted-foreground mt-5">{text(settings, 'restaurantPrepNote')}</p>
            <Button
              onClick={() => { setPlaced(null); setCartOpen(false); }}
              className="w-full mt-6 h-12 bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.2em] uppercase rounded-none"
            >
              Done
            </Button>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <ShoppingBag className="w-12 h-12 text-gold/30 mb-4" />
            <p className="text-muted-foreground">Your order is empty.</p>
            <Button
              onClick={() => setCartOpen(false)}
              variant="outline"
              className="mt-5 border-gold/30 text-charcoal text-xs tracking-widest uppercase rounded-none"
            >
              Browse the Menu
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* ---- items ---- */}
              <div className="space-y-3">
                {lines.map((line) => (
                  <div key={line.key} className="flex gap-3 pb-3 border-b border-gold/10">
                    {line.imageUrl && (
                      <div className="w-16 h-16 flex-shrink-0 bg-cream bg-cover bg-center" style={{ backgroundImage: `url(${line.imageUrl})` }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal leading-snug">{line.name}</p>
                      {line.size && <p className="text-xs text-muted-foreground">{line.size}</p>}
                      {line.addons.length > 0 && (
                        <p className="text-xs text-muted-foreground">+ {line.addons.map((a) => a.label).join(', ')}</p>
                      )}
                      {line.notes && <p className="text-xs text-gold/80 italic mt-0.5">“{line.notes}”</p>}

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-gold/25">
                          <button
                            onClick={() => setQuantity(line.key, line.quantity - 1)}
                            className="w-9 h-9 flex items-center justify-center hover:bg-cream cursor-pointer"
                            aria-label="Decrease"
                          >
                            {line.quantity === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                          </button>
                          <span className="w-8 text-center text-sm">{line.quantity}</span>
                          <button
                            onClick={() => setQuantity(line.key, line.quantity + 1)}
                            className="w-9 h-9 flex items-center justify-center hover:bg-cream cursor-pointer"
                            aria-label="Increase"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-sm text-charcoal">{money(lineTotal(line))}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(line.key)}
                      className="text-muted-foreground hover:text-red-500 self-start cursor-pointer"
                      aria-label={`Remove ${line.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* ---- fulfilment ---- */}
              {enabledTypes.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs tracking-widest uppercase text-muted-foreground">How would you like it?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {enabledTypes.map((type) => {
                      const Icon = TYPE_ICON[type.id];
                      const active = orderType === type.id;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setOrderType(type.id)}
                          className={`min-h-16 p-3 border text-left transition-all cursor-pointer ${
                            active ? 'border-gold bg-gold/5' : 'border-gold/15 hover:border-gold/40'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mb-1 ${active ? 'text-gold' : 'text-charcoal/40'}`} />
                          <span className="block text-sm text-charcoal">{type.label}</span>
                          <span className="block text-[11px] text-muted-foreground">{type.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---- who and where ---- */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs tracking-widest uppercase text-muted-foreground">Name *</Label>
                  <Input
                    value={form.customerName}
                    onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                    className="h-12 border-gold/20 bg-cream/30 rounded-none text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs tracking-widest uppercase text-muted-foreground">Phone *</Label>
                  <Input
                    type="tel"
                    value={form.customerPhone}
                    onChange={(event) => setForm({ ...form, customerPhone: event.target.value })}
                    className="h-12 border-gold/20 bg-cream/30 rounded-none text-base"
                  />
                </div>

                {orderType === 'dine_in' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs tracking-widest uppercase text-muted-foreground">Table Number *</Label>
                    <Input
                      value={form.tableNumber}
                      onChange={(event) => setForm({ ...form, tableNumber: event.target.value })}
                      className="h-12 border-gold/20 bg-cream/30 rounded-none text-base"
                    />
                  </div>
                )}

                {orderType === 'room_service' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs tracking-widest uppercase text-muted-foreground">Room Number *</Label>
                      <Input
                        value={form.roomNumber}
                        onChange={(event) => setForm({ ...form, roomNumber: event.target.value })}
                        className="h-12 border-gold/20 bg-cream/30 rounded-none text-base"
                      />
                    </div>
                    {chargeToRoomAllowed && (
                      <div className="space-y-1.5">
                        <Label className="text-xs tracking-widest uppercase text-muted-foreground">Booking Reference</Label>
                        <Input
                          value={form.bookingRef}
                          onChange={(event) => setForm({ ...form, bookingRef: event.target.value.toUpperCase() })}
                          placeholder="Optional — links this bill to your stay"
                          className="h-12 border-gold/20 bg-cream/30 rounded-none text-base tracking-widest"
                        />
                      </div>
                    )}
                  </>
                )}

                {orderType === 'delivery' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs tracking-widest uppercase text-muted-foreground">Delivery Address *</Label>
                    <Textarea
                      value={form.deliveryAddress}
                      onChange={(event) => setForm({ ...form, deliveryAddress: event.target.value })}
                      rows={3}
                      className="border-gold/20 bg-cream/30 rounded-none resize-none text-base"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs tracking-widest uppercase text-muted-foreground">Notes for the kitchen</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    rows={2}
                    className="border-gold/20 bg-cream/30 rounded-none resize-none text-base"
                  />
                </div>
              </div>

              {/* ---- payment ---- */}
              <div className="space-y-2">
                <p className="text-xs tracking-widest uppercase text-muted-foreground">Payment</p>
                {[
                  ...onlineMethods.map((option) => ({ id: option.id as GatewayId | 'later', label: option.label, description: option.description })),
                  ...(payLaterAllowed
                    ? [{
                        id: 'later' as const,
                        label: orderType === 'delivery' ? 'Pay on Delivery' : 'Pay at the Counter',
                        description: chargeToRoomAllowed && form.bookingRef ? 'Added to your room folio' : 'Settle when your order arrives',
                      }]
                    : []),
                ].map((option) => {
                  const Icon = GATEWAY_ICON[option.id] ?? Banknote;
                  const active = method === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setMethod(option.id)}
                      className={`w-full min-h-14 flex items-center gap-3 p-3 border text-left transition-all cursor-pointer ${
                        active ? 'border-gold bg-gold/5' : 'border-gold/15 hover:border-gold/40'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-gold' : 'text-charcoal/40'}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-charcoal">{option.label}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">{option.description}</span>
                      </span>
                      <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${active ? 'border-gold bg-gold' : 'border-charcoal/20'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ---- totals + submit ---- */}
            <div className="border-t border-gold/15 p-5 space-y-3 bg-white">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(totals.subtotal)}</span></div>
                {totals.packagingFee > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Packaging / service</span><span>{money(totals.packagingFee)}</span></div>
                )}
                {totals.deliveryFee > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{money(totals.deliveryFee)}</span></div>
                )}
                {totals.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{text(settings, 'taxLabel')} ({num(settings, 'foodTaxPercent')}%)</span>
                    <span>{money(totals.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gold/10 text-base">
                  <span className="text-charcoal tracking-wide">Total</span>
                  <span className="text-gold font-light">{money(totals.totalAmount)}</span>
                </div>
              </div>

              <Button
                onClick={placeOrder}
                disabled={!canSubmit || placing}
                className="w-full h-14 bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.2em] uppercase rounded-none"
              >
                {placing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Placing…</> : `Place Order · ${money(totals.totalAmount)}`}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
