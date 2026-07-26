'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { api, inr, notifyError, titleCase } from '@/components/erp/lib';
import { PageHeader, Section, Spinner, StatCard } from '@/components/erp/ui';

interface ReportData {
  from: string; to: string; days: number; unitCount: number;
  series: { date: string; occupied: number; occupancyPct: number; roomRevenue: number; fnbRevenue: number; adr: number; revpar: number }[];
  totals: {
    roomRevenue: number; fnbRevenue: number; roomNightsSold: number; avgOccupancyPct: number;
    adr: number; revpar: number; collected: number; expensed: number;
  };
  paymentMix: Record<string, number>;
  expenseMix: Record<string, number>;
  orderTypeMix: Record<string, number>;
  topItems: { name: string; qty: number; sales: number }[];
}

const PIE_COLORS = ['#c9a96e', '#1a1a1a', '#0ea5e9', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#64748b'];

export default function Reports() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ReportData | null>(null);

  const load = useCallback(async () => {
    try { setData(await api(`/api/erp/reports?days=${days}`)); }
    catch (error) { notifyError(error); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  const short = (d: string) => d.slice(5).replace('-', '/');
  const revenueSeries = data.series.map((s) => ({ ...s, label: short(s.date) }));
  const toPie = (mix: Record<string, number>) =>
    Object.entries(mix).map(([name, value]) => ({ name: titleCase(name), value }));

  return (
    <div>
      <PageHeader title="Reports" subtitle={`${data.from} → ${data.to}`}
        actions={
          <div className="flex gap-1">
            {[14, 30, 60, 92].map((d) => (
              <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'}
                className={`rounded-none ${days === d ? 'bg-gold hover:bg-gold-dark text-white' : ''}`}
                onClick={() => setDays(d)}>
                {d}d
              </Button>
            ))}
          </div>
        } />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Avg Occupancy" value={`${data.totals.avgOccupancyPct}%`} hint={`${data.totals.roomNightsSold} room-nights sold`} />
        <StatCard label="ADR" value={inr(data.totals.adr)} hint="average daily rate (net)" />
        <StatCard label="RevPAR" value={inr(data.totals.revpar)} hint="revenue per available room" />
        <StatCard label="Room + F&B Revenue" value={inr(data.totals.roomRevenue + data.totals.fnbRevenue)}
          hint={`rooms ${inr(data.totals.roomRevenue)} · F&B ${inr(data.totals.fnbRevenue)}`} />
      </div>

      <Section title="Occupancy %" className="mb-4">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={revenueSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" width={40} />
            <Tooltip formatter={(v) => [`${v}%`, 'Occupancy']} />
            <Line type="monotone" dataKey="occupancyPct" stroke="#c9a96e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Daily Revenue (₹)" className="mb-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={revenueSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(v)} />
            <Tooltip formatter={(v: number, name) => [inr(v), name === 'roomRevenue' ? 'Rooms (net)' : 'F&B']} />
            <Legend formatter={(v) => (v === 'roomRevenue' ? 'Rooms (net)' : 'F&B (gross)')} />
            <Bar dataKey="roomRevenue" stackId="a" fill="#c9a96e" />
            <Bar dataKey="fnbRevenue" stackId="a" fill="#1a1a1a" />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        {[
          { title: 'Collections by Mode', mix: data.paymentMix },
          { title: 'Expenses by Category', mix: data.expenseMix },
          { title: 'F&B by Order Type', mix: data.orderTypeMix },
        ].map(({ title, mix }) => (
          <Section key={title} title={title}>
            {Object.keys(mix).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={toPie(mix)} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {toPie(mix).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Section>
        ))}
      </div>

      <Section title="Top Dishes">
        {data.topItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders in this window.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
            {data.topItems.map((item, i) => (
              <div key={item.name} className="flex justify-between text-sm border-b border-gold/8 py-1">
                <span>{i + 1}. {item.name} <span className="text-muted-foreground">×{item.qty}</span></span>
                <span className="tabular-nums">{inr(item.sales)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
