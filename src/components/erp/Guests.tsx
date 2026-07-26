'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, Crown, RefreshCw, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { act, api, fmtDate, inr, notify, notifyError, titleCase } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, Field, PageHeader, Spinner, Td } from '@/components/erp/ui';

interface Profile {
  id: string; profileKey: string; name: string; email: string | null; phone: string | null;
  nationality: string | null; company: string | null; gstin: string | null; address: string | null;
  dob: string | null; anniversary: string | null; preferences: string | null;
  isVip: boolean; isBlacklisted: boolean; blacklistReason: string | null;
  totalStays: number; totalSpend: number; lastStay: string | null; notes: string | null;
}
interface History {
  bookings: { id: string; bookingRef: string; checkIn: string; checkOut: string; roomType: string; status: string; totalAmount: number; unit: { unitNumber: string } | null }[];
  orders: { id: string; orderRef: string; createdAt: string; orderType: string; totalAmount: number; status: string }[];
}

export default function Guests() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Profile> | null>(null);
  const [history, setHistory] = useState<{ profile: Profile; data: History } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ profiles: Profile[] }>(`/api/erp/guests${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setProfiles(result.profiles);
    } catch (error) { notifyError(error); }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const openHistory = async (profile: Profile) => {
    try {
      const key = profile.email || profile.phone || '';
      const data = await api<History>(`/api/erp/guests?history=${encodeURIComponent(key)}`);
      setHistory({ profile, data });
    } catch (error) { notifyError(error); }
  };

  if (!profiles) return <Spinner />;

  return (
    <div>
      <PageHeader title="Guest CRM" subtitle={`${profiles.length} profiles`}
        actions={
          <>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name / phone / email / company" className="pl-8 w-60" />
            </div>
            <Button variant="outline" size="sm" className="rounded-none" onClick={() => setEdit({})}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Guest
            </Button>
            <Button variant="outline" size="sm" className="rounded-none"
              onClick={() => act('/api/erp/guests', { action: 'rebuild' }).then((r) => { notify(`Directory rebuilt (${(r as { count: number }).count} profiles)`); load(); }).catch(notifyError)}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sync from Bookings
            </Button>
          </>
        } />

      {profiles.length === 0 ? (
        <EmptyState message='No guest profiles yet — press "Sync from Bookings" to build the directory.' />
      ) : (
        <div className="bg-white border border-gold/10 p-4">
          <DataTable headers={['Guest', 'Contact', 'Stays', 'Lifetime Spend', 'Last Stay', 'Flags']} minWidth={760}>
            {profiles.map((p) => (
              <tr key={p.id} className={p.isBlacklisted ? 'bg-red-50/40' : ''}>
                <Td>
                  <button className="underline-offset-2 hover:underline cursor-pointer text-left" onClick={() => setEdit(p)}>{p.name}</button>
                  {p.company && <span className="block text-[11px] text-muted-foreground">{p.company}{p.gstin ? ` · ${p.gstin}` : ''}</span>}
                  {p.preferences && <span className="block text-[11px] text-sky-800">♥ {p.preferences}</span>}
                </Td>
                <Td className="text-xs">{p.phone ?? '—'}<span className="block text-muted-foreground">{p.email ?? ''}</span></Td>
                <Td right>
                  <button className="underline-offset-2 hover:underline cursor-pointer tabular-nums" onClick={() => openHistory(p)}>{p.totalStays}</button>
                </Td>
                <Td right>{inr(p.totalSpend)}</Td>
                <Td className="text-xs whitespace-nowrap">{p.lastStay ? fmtDate(p.lastStay) : '—'}</Td>
                <Td>
                  <span className="flex gap-1.5">
                    {p.isVip && <Chip label="VIP" className="bg-gold/15 text-gold-dark border-gold/30" />}
                    {p.isBlacklisted && <Chip label="Blacklisted" className="bg-red-100 text-red-700 border-red-200" />}
                  </span>
                </Td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {edit && <ProfileDialog profile={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); }} />}
      {history && (
        <Dialog open onOpenChange={(o) => { if (!o) setHistory(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-light">History — {history.profile.name}</DialogTitle></DialogHeader>
            <p className="text-xs tracking-widest uppercase text-muted-foreground">Stays</p>
            {history.data.bookings.length === 0 ? <p className="text-sm text-muted-foreground">No stays found.</p> : (
              <div className="space-y-1.5">
                {history.data.bookings.map((b) => (
                  <div key={b.id} className="flex flex-wrap justify-between gap-2 text-sm border border-gold/10 px-3 py-1.5">
                    <span className="font-mono text-xs">{b.bookingRef}</span>
                    <span>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {b.roomType}{b.unit ? ` (${b.unit.unitNumber})` : ''}</span>
                    <span className="tabular-nums">{inr(b.totalAmount)}</span>
                    <Chip label={titleCase(b.status)} className="bg-zinc-100 text-zinc-700 border-zinc-200" />
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs tracking-widest uppercase text-muted-foreground pt-2">Dining</p>
            {history.data.orders.length === 0 ? <p className="text-sm text-muted-foreground">No food orders found.</p> : (
              <div className="space-y-1.5">
                {history.data.orders.map((o) => (
                  <div key={o.id} className="flex flex-wrap justify-between gap-2 text-sm border border-gold/10 px-3 py-1.5">
                    <span className="font-mono text-xs">{o.orderRef}</span>
                    <span>{fmtDate(o.createdAt)} · {titleCase(o.orderType)}</span>
                    <span className="tabular-nums">{inr(o.totalAmount)}</span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ProfileDialog({ profile, onClose, onDone }: { profile: Partial<Profile>; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: profile.name ?? '', email: profile.email ?? '', phone: profile.phone ?? '',
    nationality: profile.nationality ?? '', company: profile.company ?? '', gstin: profile.gstin ?? '',
    address: profile.address ?? '', dob: profile.dob ?? '', anniversary: profile.anniversary ?? '',
    preferences: profile.preferences ?? '', notes: profile.notes ?? '',
    isVip: profile.isVip ?? false, isBlacklisted: profile.isBlacklisted ?? false,
    blacklistReason: profile.blacklistReason ?? '',
  });
  const submit = async () => {
    setBusy(true);
    try {
      await act('/api/erp/guests', { action: 'save', id: profile.id, ...form });
      notify('Guest profile saved'); onDone();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-light">{profile.id ? `Guest — ${profile.name}` : 'New Guest Profile'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
          <Field label="Company GSTIN"><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></Field>
          <Field label="Birthday"><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
          <Field label="Anniversary"><Input type="date" value={form.anniversary} onChange={(e) => setForm({ ...form, anniversary: e.target.value })} /></Field>
          <Field label="Address" className="col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Preferences (room, food, floor…)" className="col-span-2">
            <Input value={form.preferences} placeholder="High floor, Jain food, extra pillows" onChange={(e) => setForm({ ...form, preferences: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.isVip} onCheckedChange={(v) => setForm({ ...form, isVip: Boolean(v) })} />
            <Crown className="w-4 h-4 text-gold" /> VIP
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.isBlacklisted} onCheckedChange={(v) => setForm({ ...form, isBlacklisted: Boolean(v) })} />
            <Ban className="w-4 h-4 text-red-600" /> Blacklist
          </label>
        </div>
        {form.isBlacklisted && (
          <Field label="Blacklist Reason">
            <Textarea rows={2} value={form.blacklistReason} onChange={(e) => setForm({ ...form, blacklistReason: e.target.value })} />
          </Field>
        )}
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <Button onClick={submit} disabled={busy || !form.name} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Save</Button>
      </DialogContent>
    </Dialog>
  );
}
