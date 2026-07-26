'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, fmtDate, inr, notifyError, titleCase } from '@/components/erp/lib';
import { Chip, PageHeader, Section, Spinner, StatCard } from '@/components/erp/ui';

interface DashboardData {
  businessDate: string;
  today: string;
  auditLagDays: number;
  occupancy: { totalUnits: number; occupied: number; pct: number };
  movements: { arrivalsDue: number; departuresDue: number };
  housekeeping: { dirtyRooms: number };
  maintenance: { openTickets: number };
  stores: { lowStock: number };
  hr: { pendingLeaves: number };
  pos: { openOrders: number };
  money: { collectedToday: number; spentToday: number; openFolios: number; receivables: number };
  compliance: { formCPending: number };
  upcomingEvents: { id: string; eventRef: string; eventDate: string; eventType: string; customerName: string; hallName: string; pax: number; status: string }[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    try { setData(await api<DashboardData>('/api/erp/dashboard')); }
    catch (error) { notifyError(error); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Business date ${fmtDate(data.businessDate)} · Today ${fmtDate(data.today)}`}
        actions={
          <Button variant="outline" size="sm" onClick={load} className="rounded-none">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        }
      />

      {data.auditLagDays > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Night audit is {data.auditLagDays} day{data.auditLagDays > 1 ? 's' : ''} behind — run it from the Front Desk to post room charges and roll the date.
        </div>
      )}
      {data.compliance.formCPending > 0 && (
        <div className="mb-4 bg-sky-50 border border-sky-200 px-4 py-3 flex items-center gap-2 text-sm text-sky-900">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {data.compliance.formCPending} foreign guest{data.compliance.formCPending > 1 ? 's' : ''} in house without a Form C reference — file on indianfrro.gov.in within 24h of check-in.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Occupancy" value={`${data.occupancy.pct}%`}
          hint={`${data.occupancy.occupied} of ${data.occupancy.totalUnits} rooms`} tone={data.occupancy.pct >= 70 ? 'good' : 'default'} />
        <StatCard label="Arrivals Due" value={data.movements.arrivalsDue} hint="pending check-in" />
        <StatCard label="Departures Due" value={data.movements.departuresDue} hint="pending check-out" />
        <StatCard label="Collected Today" value={inr(data.money.collectedToday)} tone="good" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Dirty Rooms" value={data.housekeeping.dirtyRooms} tone={data.housekeeping.dirtyRooms > 0 ? 'warn' : 'good'} />
        <StatCard label="Open Work Orders" value={data.maintenance.openTickets} tone={data.maintenance.openTickets > 0 ? 'warn' : 'good'} />
        <StatCard label="Kitchen Orders Live" value={data.pos.openOrders} />
        <StatCard label="Low Stock Items" value={data.stores.lowStock} tone={data.stores.lowStock > 0 ? 'warn' : 'good'} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Open Folios" value={data.money.openFolios} />
        <StatCard label="Guest Receivables" value={inr(data.money.receivables)} tone={data.money.receivables > 0 ? 'warn' : 'default'} />
        <StatCard label="Spent Today" value={inr(data.money.spentToday)} />
        <StatCard label="Leave Requests" value={data.hr.pendingLeaves} hint="awaiting decision" />
      </div>

      <Section title="Upcoming Events">
        {data.upcomingEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tentative or confirmed events ahead.</p>
        ) : (
          <div className="space-y-2">
            {data.upcomingEvents.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 border border-gold/10 px-3 py-2">
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{titleCase(event.eventType)}</span> — {event.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground">{event.eventRef} · {event.hallName} · {event.pax} pax</p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip label={fmtDate(event.eventDate)} className="bg-cream text-charcoal border-gold/20" />
                  <Chip label={titleCase(event.status)} className={event.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-900 border-amber-200'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
