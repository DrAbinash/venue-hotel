'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, HelpCircle, Loader2, XCircle } from 'lucide-react';

/**
 * Where the ICICI Eazypay hosted page sends the guest back to.
 *
 * The outcome has already been verified and recorded server-side by
 * /api/payments/icici/callback — this page only reports it.
 */
const STATES = {
  paid: {
    icon: CheckCircle,
    title: 'Payment Successful',
    body: 'Thank you — your payment has been received and your reservation is confirmed.',
    tone: 'text-gold',
  },
  failed: {
    icon: XCircle,
    title: 'Payment Not Completed',
    body: 'The bank did not confirm this payment. Your reservation is still held — you can try again from the booking page.',
    tone: 'text-red-500',
  },
  mismatch: {
    icon: AlertTriangle,
    title: 'Payment Needs Review',
    body: 'The amount returned by the bank did not match your booking. Nothing has been charged to your reservation — please contact us and quote your reference.',
    tone: 'text-amber-500',
  },
  unknown: {
    icon: HelpCircle,
    title: 'Payment Status Unknown',
    body: 'We could not match this payment to a reservation. If money left your account, contact us and we will trace it.',
    tone: 'text-charcoal/60',
  },
} as const;

type StateKey = keyof typeof STATES;

function StatusInner() {
  const params = useSearchParams();
  const raw = (params.get('state') || 'unknown') as StateKey;
  const state: StateKey = raw in STATES ? raw : 'unknown';
  const reference = params.get('ref') || '';

  const view = STATES[state];
  const Icon = view.icon;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-cream/30">
      <div className="max-w-md w-full bg-white border border-gold/10 luxury-shadow p-10 text-center">
        <Icon className={`w-16 h-16 mx-auto mb-6 ${view.tone}`} />
        <h1 className="text-2xl font-extralight tracking-wide text-charcoal mb-3">{view.title}</h1>
        <div className="w-12 h-[1px] bg-gold mx-auto mb-6" />
        <p className="text-sm text-muted-foreground mb-6">{view.body}</p>

        {reference && (
          <div className="bg-cream/60 border border-gold/15 px-4 py-3 mb-8">
            <p className="text-xs tracking-widest uppercase text-muted-foreground">Booking Reference</p>
            <p className="text-lg tracking-[0.2em] text-charcoal mt-1">{reference}</p>
          </div>
        )}

        <Link
          href="/"
          className="inline-block bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.3em] uppercase px-8 py-3 transition-colors"
        >
          Return to the Hotel
        </Link>
      </div>
    </div>
  );
}

export default function BookingStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      }
    >
      <StatusInner />
    </Suspense>
  );
}
