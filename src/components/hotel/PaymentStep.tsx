'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Banknote, BadgeCheck, Building2, CreditCard, Landmark, Loader2, Lock, ShieldCheck, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/pricing';
import { loadRazorpayCheckout, openRazorpayCheckout } from '@/lib/razorpay-client';
import type { Booking, GatewayId, PaymentConfig } from '@/lib/types';

const GATEWAY_ICON: Record<GatewayId, React.ComponentType<{ className?: string }>> = {
  razorpay: CreditCard,
  icici: Landmark,
  bankTransfer: Building2,
  payAtHotel: Banknote,
};

interface PaymentStepProps {
  booking: Booking;
  onPaid: (result: { status: string; paymentStatus: string; amountPaid: number }) => void;
  onSkipped: (method: GatewayId) => void;
}

/**
 * The final step of the booking flow.
 *
 * Which options appear here is entirely admin-driven: enable Razorpay or ICICI
 * Eazypay in Admin → Payments and they show up, with no code change. Amounts
 * are always re-derived on the server from the stored booking.
 */
export default function PaymentStep({ booking, onPaid, onSkipped }: PaymentStepProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<GatewayId | null>(null);
  const [amountType, setAmountType] = useState<'full' | 'advance'>('full');
  const [processing, setProcessing] = useState(false);
  const [bankDetails, setBankDetails] = useState<PaymentConfig['bank'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/config')
      .then((res) => res.json())
      .then((data: PaymentConfig) => {
        if (cancelled) return;
        setConfig(data);
        setMethod(data.methods[0]?.id ?? null);
      })
      .catch(() => toast({ title: 'Could not load payment options', variant: 'destructive' }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const outstanding = Math.max(0, booking.totalAmount - booking.amountPaid);
  const advanceAmount = useMemo(() => {
    if (!config) return outstanding;
    return Math.min(Math.round(booking.totalAmount * (config.advancePercent / 100)), outstanding);
  }, [config, booking.totalAmount, outstanding]);

  const payable = amountType === 'advance' ? advanceAmount : outstanding;
  const money = (value: number) => formatMoney(value, config ?? { currency: booking.currency });

  const selectedMethod = config?.methods.find((m) => m.id === method) ?? null;

  const startPayment = async () => {
    if (!method || !config) return;
    setProcessing(true);

    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingRef: booking.bookingRef, gateway: method, amountType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the payment.');

      // ---- Offline: nothing to charge now, just confirm the intent. ----
      if (data.online === false) {
        if (method === 'bankTransfer') setBankDetails(data.instructions);
        onSkipped(method);
        setProcessing(false);
        return;
      }

      // ---- ICICI Eazypay: hand the guest to the bank's hosted page. ----
      if (data.gateway === 'icici') {
        window.location.href = data.redirectUrl;
        return;
      }

      // ---- Razorpay: open Checkout in an overlay. ----
      if (data.gateway === 'razorpay') {
        const ready = await loadRazorpayCheckout();
        if (!ready) throw new Error('Could not reach Razorpay. Please check your connection and try again.');

        const opened = openRazorpayCheckout({
          key: data.keyId,
          amount: data.amountMinor,
          currency: data.currency,
          name: data.name,
          description: data.description,
          order_id: data.orderId,
          prefill: data.prefill,
          theme: { color: data.themeColor },
          modal: {
            ondismiss: () => {
              setProcessing(false);
              toast({ title: 'Payment cancelled', description: 'Your reservation is held — you can pay again from this page.' });
            },
          },
          handler: async (response) => {
            try {
              const verifyRes = await fetch('/api/payments/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response),
              });
              const verified = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verified.error || 'Payment verification failed.');
              onPaid({
                status: verified.status,
                paymentStatus: verified.paymentStatus,
                amountPaid: verified.amountPaid,
              });
            } catch (error) {
              toast({
                title: 'Payment received but not verified',
                description: `${error instanceof Error ? error.message : 'Please contact us with reference ' + booking.bookingRef}`,
                variant: 'destructive',
              });
            } finally {
              setProcessing(false);
            }
          },
        });
        if (!opened) throw new Error('Could not open the payment window.');
        return;
      }

      throw new Error('Unsupported payment method.');
    } catch (error) {
      toast({
        title: 'Payment could not be started',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-8 luxury-shadow border border-gold/10 flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading payment options…
      </div>
    );
  }

  if (bankDetails) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10">
        <h3 className="text-lg font-light tracking-wide text-charcoal mb-4">Transfer Details</h3>
        <dl className="text-sm space-y-2">
          {[
            ['Bank', bankDetails.name],
            ['Account Name', bankDetails.accountName],
            ['Account Number', bankDetails.accountNumber],
            ['IFSC', bankDetails.ifsc],
            ['UPI ID', bankDetails.upiId],
            ['Amount', money(payable)],
            ['Reference', booking.bookingRef],
          ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-gold/10 pb-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-charcoal font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground mt-4">
          Quote booking reference <strong>{booking.bookingRef}</strong> in the transfer note. We confirm your room as soon as the transfer lands.
        </p>
      </motion.div>
    );
  }

  if (!config?.methods.length) {
    return (
      <div className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10 text-center">
        <BadgeCheck className="w-10 h-10 text-gold mx-auto mb-3" />
        <h3 className="text-lg font-light text-charcoal mb-2">Reservation received</h3>
        <p className="text-sm text-muted-foreground">
          Online payment is not switched on right now. Our team will contact you at{' '}
          <span className="text-charcoal">{booking.guestEmail}</span> to complete your booking.
        </p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {config.mode === 'test' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          Test mode is on — no real money will move.
        </div>
      )}

      <div className="bg-white p-6 md:p-8 luxury-shadow border border-gold/10 space-y-5">
        <div>
          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Booking Reference</p>
          <p className="text-2xl font-light tracking-[0.2em] text-charcoal">{booking.bookingRef}</p>
        </div>

        {config.allowPartialPayment && advanceAmount > 0 && advanceAmount < outstanding && (
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'full' as const, title: 'Pay in Full', amount: outstanding },
              { key: 'advance' as const, title: `Pay ${config.advancePercent}% Now`, amount: advanceAmount },
            ]).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setAmountType(option.key)}
                className={`p-4 text-left border transition-all cursor-pointer ${
                  amountType === option.key ? 'border-gold bg-gold/5' : 'border-gold/15 hover:border-gold/40'
                }`}
              >
                <p className="text-xs tracking-widest uppercase text-muted-foreground">{option.title}</p>
                <p className="text-lg font-light text-charcoal mt-1">{money(option.amount)}</p>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs tracking-widest uppercase text-muted-foreground">Choose how to pay</p>
          {config.methods.map((option) => {
            const Icon = GATEWAY_ICON[option.id] ?? Wallet;
            const active = method === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setMethod(option.id)}
                className={`w-full flex items-start gap-4 p-4 border text-left transition-all cursor-pointer ${
                  active ? 'border-gold bg-gold/5' : 'border-gold/15 hover:border-gold/40'
                }`}
              >
                <span className={`mt-0.5 ${active ? 'text-gold' : 'text-charcoal/40'}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-charcoal">{option.label}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{option.description}</span>
                </span>
                <span
                  className={`w-4 h-4 mt-1 rounded-full border-2 flex-shrink-0 ${
                    active ? 'border-gold bg-gold' : 'border-charcoal/20'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="bg-charcoal text-white p-5 flex items-center justify-between">
          <span className="text-xs tracking-widest uppercase text-white/60">
            {amountType === 'advance' ? 'Paying now' : 'Amount due'}
          </span>
          <span className="text-2xl font-light" style={{ color: '#c9a96e' }}>{money(payable)}</span>
        </div>

        <Button
          onClick={startPayment}
          disabled={processing || !method}
          className="w-full bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.3em] uppercase py-6 rounded-none"
        >
          {processing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
          ) : selectedMethod?.online ? (
            <><Lock className="w-4 h-4 mr-2" /> Pay {money(payable)} Securely</>
          ) : (
            <><BadgeCheck className="w-4 h-4 mr-2" /> Confirm Reservation</>
          )}
        </Button>

        <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3" /> Card details are entered on the gateway’s own page — this site never sees them.
        </p>
      </div>
    </motion.div>
  );
}
