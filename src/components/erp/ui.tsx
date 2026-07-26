'use client';

import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

/** Small shared building blocks so every ERP module reads the same way. */

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h2 className="text-xl font-light tracking-wide text-charcoal">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'default' }: {
  label: string; value: React.ReactNode; hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneClass = {
    default: 'text-charcoal',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-red-700',
  }[tone];
  return (
    <div className="bg-white border border-gold/10 p-4">
      <p className="text-[11px] tracking-widest uppercase text-muted-foreground">{label}</p>
      <p className={`text-2xl font-light mt-1 ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export function Section({ title, actions, children, className = '' }: {
  title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white border border-gold/10 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gold/10">
          {title && <h3 className="text-sm tracking-widest uppercase text-charcoal/80">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Chip({ label, className = 'bg-zinc-100 text-zinc-700 border-zinc-200' }: {
  label: string; className?: string;
}) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}

export function Field({ label, children, className = '', hint }: {
  label: string; children: React.ReactNode; className?: string; hint?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs tracking-wide uppercase text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin text-gold" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground text-center py-10">{message}</p>;
}

/** Dense data table used across the ERP. Rows render inside <tbody>. */
export function DataTable({ headers, children, minWidth = 640 }: {
  headers: (string | React.ReactNode)[]; children: React.ReactNode; minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-gold/15">
            {headers.map((h, i) => (
              <th key={i} className="text-left font-medium text-[11px] tracking-widest uppercase text-muted-foreground py-2 pr-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gold/8">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = '', right = false }: {
  children?: React.ReactNode; className?: string; right?: boolean;
}) {
  return <td className={`py-2.5 pr-3 align-top ${right ? 'text-right tabular-nums' : ''} ${className}`}>{children}</td>;
}
