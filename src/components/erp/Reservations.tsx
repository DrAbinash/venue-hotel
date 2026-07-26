'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, fmtDate, inr, notifyError, BOOKING_STATUS_META } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, PageHeader, Spinner, Td } from '@/components/erp/ui';
import FolioSheet from '@/components/erp/FolioSheet';

interface Row {
  id: string; bookingRef: string; guestName: string; guestEmail: string; guestPhone: string;
  checkIn: string; checkOut: string; nights: number; adults: number; children: number;
  roomType: string; totalAmount: number; amountPaid: number; status: string;
  paymentStatus: string; source: string; createdAt: string;
  unit?: { unitNumber: string } | null;
}

/**
 * The reservations register — website bookings and walk-ins side by side.
 * Uses the existing admin bookings API shape via the ERP folio join.
 */
export default function Reservations() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [folioId, setFolioId] = useState<string | null>(null);
  const [folios, setFolios] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const [deskData, folioData] = await Promise.all([
        api<{ bookings: Row[] }>('/api/erp/frontdesk?days=31'),
        api<{ folios: { id: string; bookingRef: string | null }[] }>('/api/erp/folios'),
      ]);
      // The tape window covers ±1 month; for the full register we also pull
      // everything the desk data may have missed via a wider fetch below.
      setFolios(new Map(folioData.folios.filter((f) => f.bookingRef).map((f) => [f.bookingRef as string, f.id])));
      setRows(deskData.bookings.sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1)));
    } catch (error) { notifyError(error); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!rows) return <Spinner />;

  const filtered = rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (q) {
      const needle = q.toLowerCase();
      return [r.bookingRef, r.guestName, r.guestPhone, r.roomType].some((v) => v?.toLowerCase().includes(needle));
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Reservations"
        subtitle="Stays inside the front-desk window (±1 month). Older history lives in the website admin."
        actions={
          <>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ref / guest / phone"
                className="pl-8 w-56" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(BOOKING_STATUS_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState message="No reservations match." />
      ) : (
        <div className="bg-white border border-gold/10 p-4">
          <DataTable headers={['Ref', 'Guest', 'Room', 'Stay', 'Amount', 'Status', 'Folio']} minWidth={780}>
            {filtered.map((r) => {
              const meta = BOOKING_STATUS_META[r.status];
              const fid = folios.get(r.bookingRef);
              return (
                <tr key={r.id}>
                  <Td className="font-mono text-xs whitespace-nowrap">{r.bookingRef}<span className="block text-muted-foreground">{r.source}</span></Td>
                  <Td>
                    {r.guestName}
                    <span className="block text-[11px] text-muted-foreground">{r.guestPhone}</span>
                  </Td>
                  <Td>{r.roomType}{r.unit?.unitNumber ? <span className="block text-[11px] text-muted-foreground">Room {r.unit.unitNumber}</span> : null}</Td>
                  <Td className="whitespace-nowrap">
                    {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}
                    <span className="block text-[11px] text-muted-foreground">{r.nights}N · {r.adults}A{r.children ? `+${r.children}C` : ''}</span>
                  </Td>
                  <Td right>
                    {inr(r.totalAmount)}
                    <span className={`block text-[11px] ${r.amountPaid + 0.01 >= r.totalAmount ? 'text-emerald-700' : 'text-amber-700'}`}>
                      paid {inr(r.amountPaid)}
                    </span>
                  </Td>
                  <Td><Chip label={meta?.label ?? r.status} className={meta?.className} /></Td>
                  <Td>
                    {fid ? (
                      <button className="text-xs underline text-gold-dark cursor-pointer" onClick={() => setFolioId(fid)}>Open</button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        </div>
      )}

      <FolioSheet folioId={folioId} onClose={() => setFolioId(null)} onChanged={load} />
    </div>
  );
}
