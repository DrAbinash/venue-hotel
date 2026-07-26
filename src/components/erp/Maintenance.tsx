'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { act, api, fmtDate, fmtDateTime, inr, notify, notifyError, titleCase } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, Field, PageHeader, Spinner, Td } from '@/components/erp/ui';

interface Asset {
  id: string; name: string; category: string; location: string | null; serialNo: string | null;
  purchaseDate: string | null; purchaseCost: number; amcVendor: string | null; amcExpiry: string | null;
  warrantyExpiry: string | null; status: string; notes: string | null;
}
interface Ticket {
  id: string; ticketNo: string; title: string; details: string | null; location: string | null;
  assetId: string | null; category: string; priority: string; status: string;
  reportedBy: string; assignedTo: string | null; cost: number; createdAt: string;
  asset: { name: string } | null;
}

const ASSET_CATEGORIES = ['hvac', 'electrical', 'plumbing', 'kitchen', 'it', 'furniture', 'vehicle', 'fire_safety', 'general'];
const TICKET_FLOW: Record<string, string[]> = {
  open: ['in_progress', 'on_hold'],
  in_progress: ['resolved', 'on_hold'],
  on_hold: ['in_progress'],
  resolved: ['closed', 'in_progress'],
};

export default function Maintenance() {
  const [data, setData] = useState<{ assets: Asset[]; tickets: Ticket[]; expiringAmc: Asset[] } | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [assetEdit, setAssetEdit] = useState<Partial<Asset> | null>(null);

  const load = useCallback(async () => {
    try { setData(await api('/api/erp/maintenance')); }
    catch (error) { notifyError(error); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;
  const open = data.tickets.filter((t) => !['resolved', 'closed'].includes(t.status));

  return (
    <div>
      <PageHeader title="Maintenance & Engineering" subtitle={`${open.length} open work order${open.length === 1 ? '' : 's'}`}
        actions={<Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>} />

      {data.expiringAmc.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          AMC / warranty due within 30 days: {data.expiringAmc.map((a) => a.name).join(', ')}
        </div>
      )}

      <Tabs defaultValue="tickets">
        <TabsList className="rounded-none bg-white border border-gold/10">
          <TabsTrigger value="tickets" className="rounded-none">Work Orders</TabsTrigger>
          <TabsTrigger value="assets" className="rounded-none">Assets & AMC</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setTicketOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Report Issue
              </Button>
            </div>
            {data.tickets.length === 0 ? <EmptyState message="No complaints or work orders." /> : (
              <DataTable headers={['Ticket', 'Issue', 'Assigned', 'Priority', 'Status', 'Move To']} minWidth={760}>
                {data.tickets.map((t) => (
                  <tr key={t.id}>
                    <Td className="font-mono text-xs whitespace-nowrap">{t.ticketNo}<span className="block text-muted-foreground">{fmtDateTime(t.createdAt)}</span></Td>
                    <Td>
                      {t.title}
                      <span className="block text-[11px] text-muted-foreground">
                        {t.location ?? t.asset?.name ?? ''}{t.details ? ` · ${t.details}` : ''}{t.cost > 0 ? ` · spent ${inr(t.cost)}` : ''}
                      </span>
                    </Td>
                    <Td>
                      <Input defaultValue={t.assignedTo ?? ''} placeholder="—" className="h-7 w-24 text-xs"
                        onBlur={(e) => {
                          if (e.target.value !== (t.assignedTo ?? '')) {
                            act('/api/erp/maintenance', { action: 'ticket_update', ticketId: t.id, assignedTo: e.target.value }).then(load).catch(notifyError);
                          }
                        }} />
                    </Td>
                    <Td><Chip label={titleCase(t.priority)} className={['high', 'urgent'].includes(t.priority) ? 'bg-red-100 text-red-700 border-red-200' : 'bg-zinc-100 text-zinc-700 border-zinc-200'} /></Td>
                    <Td><Chip label={titleCase(t.status)} className={
                      ['resolved', 'closed'].includes(t.status) ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : t.status === 'on_hold' ? 'bg-zinc-200 text-zinc-700 border-zinc-300'
                          : 'bg-sky-100 text-sky-800 border-sky-200'} /></Td>
                    <Td>
                      <div className="flex gap-1.5">
                        {(TICKET_FLOW[t.status] ?? []).map((next) => (
                          <Button key={next} size="sm" variant="outline" className="rounded-none h-7 text-xs"
                            onClick={async () => {
                              let cost: string | null = null;
                              if (next === 'resolved') cost = window.prompt('Repair cost (₹, 0 if none)?', String(t.cost || 0));
                              try {
                                await act('/api/erp/maintenance', { action: 'ticket_update', ticketId: t.id, status: next, ...(cost !== null ? { cost: Number(cost) || 0 } : {}) });
                                load();
                              } catch (error) { notifyError(error); }
                            }}>
                            {titleCase(next)}
                          </Button>
                        ))}
                      </div>
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setAssetEdit({})}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New Asset
              </Button>
            </div>
            {data.assets.length === 0 ? <EmptyState message="Register your DG set, lifts, ACs, boilers, vehicles…" /> : (
              <DataTable headers={['Asset', 'Location', 'AMC', 'Warranty', 'Status']} minWidth={680}>
                {data.assets.map((a) => (
                  <tr key={a.id}>
                    <Td>
                      <button className="underline-offset-2 hover:underline cursor-pointer" onClick={() => setAssetEdit(a)}>{a.name}</button>
                      <span className="block text-[11px] text-muted-foreground">{titleCase(a.category)}{a.serialNo ? ` · SN ${a.serialNo}` : ''}</span>
                    </Td>
                    <Td>{a.location ?? '—'}</Td>
                    <Td className="text-xs">{a.amcVendor ?? '—'}{a.amcExpiry && <span className="block text-muted-foreground">till {fmtDate(a.amcExpiry)}</span>}</Td>
                    <Td className="text-xs">{a.warrantyExpiry ? fmtDate(a.warrantyExpiry) : '—'}</Td>
                    <Td><Chip label={titleCase(a.status)} className={
                      a.status === 'working' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : a.status === 'down' ? 'bg-red-100 text-red-700 border-red-200'
                          : 'bg-amber-100 text-amber-900 border-amber-200'} /></Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {ticketOpen && <TicketDialog assets={data.assets} onClose={() => setTicketOpen(false)} onDone={() => { setTicketOpen(false); load(); }} />}
      {assetEdit && <AssetDialog asset={assetEdit} onClose={() => setAssetEdit(null)} onDone={() => { setAssetEdit(null); load(); }} />}
    </div>
  );
}

function TicketDialog({ assets, onClose, onDone }: { assets: Asset[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ title: '', details: '', location: '', assetId: '', category: 'general', priority: 'normal', assignedTo: '' });
  const submit = async () => {
    try {
      await act('/api/erp/maintenance', { action: 'ticket_create', ...form, assetId: form.assetId || undefined });
      notify('Work order created'); onDone();
    } catch (error) { notifyError(error); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-light">Report an Issue</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="What's wrong?"><Input value={form.title} placeholder="AC not cooling in 204" onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Details"><Input value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"><Input value={form.location} placeholder="Room 204 / Kitchen" onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Linked Asset">
              <Select value={form.assetId} onValueChange={(v) => setForm({ ...form, assetId: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['low', 'normal', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Assign To"><Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></Field>
          <Button onClick={submit} disabled={!form.title} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssetDialog({ asset, onClose, onDone }: { asset: Partial<Asset>; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    name: asset.name ?? '', category: asset.category ?? 'general', location: asset.location ?? '',
    serialNo: asset.serialNo ?? '', purchaseDate: asset.purchaseDate ?? '', purchaseCost: String(asset.purchaseCost ?? ''),
    amcVendor: asset.amcVendor ?? '', amcExpiry: asset.amcExpiry ?? '', warrantyExpiry: asset.warrantyExpiry ?? '',
    status: asset.status ?? 'working', notes: asset.notes ?? '',
  });
  const submit = async () => {
    try {
      await act('/api/erp/maintenance', { action: 'asset_save', id: asset.id, ...form, purchaseCost: Number(form.purchaseCost) || 0 });
      notify('Asset saved'); onDone();
    } catch (error) { notifyError(error); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-light">{asset.id ? `Edit — ${asset.name}` : 'New Asset'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} placeholder="125 kVA DG Set" onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Serial No"><Input value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['working', 'attention', 'down', 'retired'].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Purchase Date"><Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></Field>
            <Field label="Purchase Cost"><Input type="number" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} /></Field>
            <Field label="AMC Vendor"><Input value={form.amcVendor} onChange={(e) => setForm({ ...form, amcVendor: e.target.value })} /></Field>
            <Field label="AMC Expiry"><Input type="date" value={form.amcExpiry} onChange={(e) => setForm({ ...form, amcExpiry: e.target.value })} /></Field>
            <Field label="Warranty Expiry"><Input type="date" value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Button onClick={submit} disabled={!form.name} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
