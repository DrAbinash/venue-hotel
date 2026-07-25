'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/pricing';
import SettingsForm from '@/components/admin/SettingsForm';
import type { Payment } from '@/lib/types';

const STATUS_TONE: Record<string, string> = {
  paid: 'bg-green-50 text-green-700 border-green-200',
  created: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-purple-50 text-purple-700 border-purple-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

/** Gateway configuration plus the ledger of every transaction. */
export default function AdminPayments() {
  const { toast } = useToast();
  const { settings } = useHotelStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [webhookUrl] = useState(() =>
    typeof window === 'undefined' ? '' : `${window.location.origin}/api/payments/razorpay/webhook`,
  );

  const money = (value: number) => formatMoney(value, settings);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments?status=${status}`);
      if (res.ok) setPayments(await res.json());
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, next: string) => {
    const res = await fetch('/api/payments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: data.error || 'Update failed', variant: 'destructive' });
      return;
    }
    toast({ title: `Payment marked ${next}` });
    load();
  };

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="space-y-10">
      <SettingsForm
        section="payments"
        title="Payments"
        intro="Currency, taxes and the gateways guests can pay with. Secrets are stored server-side and never sent to a browser."
      >
        <div className="bg-white border border-gold/10 p-6 mb-6 space-y-4">
          <h3 className="text-sm tracking-widest uppercase text-charcoal flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gold" /> Connecting a gateway
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
            <div className="space-y-2">
              <p className="font-medium text-charcoal">Razorpay</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[13px]">
                <li>Copy the Key ID and Key Secret from the Razorpay dashboard (Settings → API Keys).</li>
                <li>Paste them below, switch <em>Razorpay — Enabled</em> on and save.</li>
                <li>Add a webhook for <code className="text-charcoal">payment.captured</code> and <code className="text-charcoal">payment.failed</code> pointing at the URL below, then paste its secret here.</li>
                <li>Take one test payment before switching Mode to <em>live</em>.</li>
              </ol>
              <div className="flex items-center gap-2 bg-cream/60 border border-gold/15 px-3 py-2">
                <code className="text-[11px] text-charcoal truncate flex-1">{webhookUrl}</code>
                <button onClick={() => copy(webhookUrl)} className="text-gold hover:text-gold-dark cursor-pointer" aria-label="Copy webhook URL">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <a
                href="https://dashboard.razorpay.com/app/website-app-settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gold hover:text-gold-dark"
              >
                Razorpay dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-charcoal">ICICI Bank (Eazypay)</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[13px]">
                <li>ICICI issues a Merchant ID, a Sub-Merchant ID and a 16-character encryption key.</li>
                <li>Enter them below and switch <em>ICICI Eazypay — Enabled</em> on.</li>
                <li>Register this return URL with the bank: <code className="text-charcoal break-all">{webhookUrl.replace('/razorpay/webhook', '/icici/callback')}</code></li>
                <li>The guest is redirected to the bank&apos;s own page; response code <code className="text-charcoal">E000</code> means success.</li>
              </ol>
              <p className="text-[11px] text-muted-foreground">
                Amounts returned by the bank are checked against the stored total, so a tampered return URL cannot mark a booking paid.
              </p>
            </div>
          </div>
        </div>
      </SettingsForm>

      {/* ------------------------------------------------------------ ledger */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-lg font-medium">Transactions</h2>
          <div className="flex gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px] h-9 text-xs rounded-none border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['all', 'paid', 'pending', 'created', 'failed', 'refunded'].map((option) => (
                  <SelectItem key={option} value={option}>{option === 'all' ? 'All statuses' : option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setLoading(true); load(); }} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        <div className="bg-white border border-gold/10 overflow-x-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading transactions…
            </div>
          ) : payments.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground text-center">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const reference = payment.booking?.bookingRef ?? payment.order?.orderRef ?? '—';
                  const customer = payment.booking?.guestName ?? payment.order?.customerName ?? '—';
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(payment.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs tracking-wider">{reference}</TableCell>
                      <TableCell className="text-sm">{customer}</TableCell>
                      <TableCell className="text-xs">
                        <span className="capitalize">{payment.gateway}</span>
                        {payment.mode === 'test' && <span className="ml-1.5 text-[10px] text-amber-600">test</span>}
                        {payment.method && <span className="block text-[11px] text-muted-foreground">{payment.method}</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm">{money(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider rounded-none ${STATUS_TONE[payment.status] ?? ''}`}>
                          {payment.status}
                        </Badge>
                        {payment.errorMessage && (
                          <span className="block text-[10px] text-red-500 mt-1 max-w-[180px] truncate" title={payment.errorMessage}>
                            {payment.errorMessage}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.status === 'paid' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(payment.id, 'refunded')}
                            className="text-[11px] tracking-wider uppercase text-muted-foreground hover:text-purple-600"
                          >
                            Mark refunded
                          </Button>
                        )}
                        {['created', 'pending'].includes(payment.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(payment.id, 'cancelled')}
                            className="text-[11px] tracking-wider uppercase text-muted-foreground hover:text-red-500"
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground mt-3">
          Refunds must also be issued in the gateway&apos;s own dashboard — marking a payment refunded here only corrects the balance on this system.
        </p>
      </div>
    </div>
  );
}
