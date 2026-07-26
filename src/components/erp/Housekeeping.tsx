'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { act, fmtDateTime, api, notify, notifyError, titleCase, HK_STATUS_META } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, Field, PageHeader, Spinner, Td } from '@/components/erp/ui';

interface HkUnit {
  id: string; unitNumber: string; roomName: string; hkStatus: string; hkNotes: string | null;
  isActive: boolean; occupied: boolean; guestName: string | null; bookingRef: string | null;
}
interface HkTask {
  id: string; unitId: string | null; area: string | null; type: string; notes: string | null;
  assignedTo: string | null; status: string; priority: string; createdAt: string;
  unit: { unitNumber: string } | null;
}
interface LostFoundRow {
  id: string; item: string; description: string | null; foundAt: string | null; foundOn: string;
  foundBy: string | null; status: string; guestName: string | null; guestContact: string | null;
}

const NEXT_TASK: Record<string, { label: string; status: string }> = {
  open: { label: 'Start', status: 'in_progress' },
  in_progress: { label: 'Done', status: 'done' },
  done: { label: 'Verify', status: 'verified' },
};

export default function Housekeeping() {
  const [data, setData] = useState<{ units: HkUnit[]; tasks: HkTask[]; lostFound: LostFoundRow[] } | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [lfOpen, setLfOpen] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('/api/erp/housekeeping')); }
    catch (error) { notifyError(error); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  const setStatus = async (unit: HkUnit, hkStatus: string) => {
    try { await act('/api/erp/housekeeping', { action: 'set_status', unitId: unit.id, hkStatus }); load(); }
    catch (error) { notifyError(error); }
  };

  const dirty = data.units.filter((u) => u.hkStatus === 'dirty').length;

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        subtitle={`${dirty} room${dirty === 1 ? '' : 's'} awaiting cleaning`}
        actions={<Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>}
      />

      <Tabs defaultValue="board">
        <TabsList className="rounded-none bg-white border border-gold/10">
          <TabsTrigger value="board" className="rounded-none">Room Board</TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-none">Tasks ({data.tasks.length})</TabsTrigger>
          <TabsTrigger value="lostfound" className="rounded-none">Lost & Found</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {data.units.map((unit) => {
              const meta = HK_STATUS_META[unit.hkStatus];
              return (
                <div key={unit.id} className={`bg-white border p-3 ${unit.occupied ? 'border-emerald-300' : 'border-gold/15'}`}>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-lg font-light">{unit.unitNumber}</p>
                    <Chip label={meta?.label ?? unit.hkStatus} className={meta?.className} />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{unit.roomName}</p>
                  <p className="text-[11px] mt-1 truncate">
                    {unit.occupied
                      ? <span className="text-emerald-700">● {unit.guestName}</span>
                      : <span className="text-muted-foreground">○ Vacant</span>}
                  </p>
                  <Select value={unit.hkStatus} onValueChange={(v) => setStatus(unit, v)}>
                    <SelectTrigger className="mt-2 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(HK_STATUS_META).map(([key, m]) => (
                        <SelectItem key={key} value={key}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setTaskOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New Task
              </Button>
            </div>
            {data.tasks.length === 0 ? <EmptyState message="No open tasks. Nice." /> : (
              <DataTable headers={['Where', 'Task', 'Assigned To', 'Priority', 'Status', '']} minWidth={640}>
                {data.tasks.map((task) => (
                  <tr key={task.id}>
                    <Td className="whitespace-nowrap">{task.unit?.unitNumber ?? task.area ?? '—'}</Td>
                    <Td>
                      {titleCase(task.type)}
                      {task.notes && <span className="block text-[11px] text-muted-foreground">{task.notes}</span>}
                      <span className="block text-[11px] text-muted-foreground">{fmtDateTime(task.createdAt)}</span>
                    </Td>
                    <Td>
                      <Input defaultValue={task.assignedTo ?? ''} placeholder="—" className="h-7 w-28 text-xs"
                        onBlur={(e) => {
                          if (e.target.value !== (task.assignedTo ?? '')) {
                            act('/api/erp/housekeeping', { action: 'task_update', taskId: task.id, assignedTo: e.target.value }).then(load).catch(notifyError);
                          }
                        }} />
                    </Td>
                    <Td><Chip label={titleCase(task.priority)} className={task.priority === 'urgent' || task.priority === 'high' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-zinc-100 text-zinc-700 border-zinc-200'} /></Td>
                    <Td><Chip label={titleCase(task.status)} className={task.status === 'done' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-sky-100 text-sky-800 border-sky-200'} /></Td>
                    <Td>
                      {NEXT_TASK[task.status] && (
                        <Button size="sm" variant="outline" className="rounded-none h-7 text-xs"
                          onClick={() => act('/api/erp/housekeeping', { action: 'task_update', taskId: task.id, status: NEXT_TASK[task.status].status }).then(() => { notify('Task updated'); load(); }).catch(notifyError)}>
                          {NEXT_TASK[task.status].label}
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lostfound" className="mt-4">
          <div className="bg-white border border-gold/10 p-4">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="rounded-none" onClick={() => setLfOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Log Item
              </Button>
            </div>
            {data.lostFound.length === 0 ? <EmptyState message="Nothing in the lost & found register." /> : (
              <DataTable headers={['Item', 'Found', 'Guest', 'Status', '']} minWidth={620}>
                {data.lostFound.map((row) => (
                  <tr key={row.id}>
                    <Td>{row.item}{row.description && <span className="block text-[11px] text-muted-foreground">{row.description}</span>}</Td>
                    <Td className="text-xs">{row.foundAt ?? '—'}<span className="block text-muted-foreground">{fmtDateTime(row.foundOn)} · {row.foundBy}</span></Td>
                    <Td className="text-xs">{row.guestName ?? '—'}{row.guestContact && <span className="block text-muted-foreground">{row.guestContact}</span>}</Td>
                    <Td><Chip label={titleCase(row.status)} className={row.status === 'returned' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-900 border-amber-200'} /></Td>
                    <Td>
                      {row.status === 'stored' && (
                        <Button size="sm" variant="outline" className="rounded-none h-7 text-xs"
                          onClick={() => {
                            const guestName = window.prompt('Returned to (name)?', row.guestName ?? '');
                            if (guestName !== null) {
                              act('/api/erp/housekeeping', { action: 'lf_update', id: row.id, status: 'returned', guestName }).then(load).catch(notifyError);
                            }
                          }}>
                          Return
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {taskOpen && <TaskDialog units={data.units} onClose={() => setTaskOpen(false)} onDone={() => { setTaskOpen(false); load(); }} />}
      {lfOpen && <LostFoundDialog onClose={() => setLfOpen(false)} onDone={() => { setLfOpen(false); load(); }} />}
    </div>
  );
}

function TaskDialog({ units, onClose, onDone }: { units: HkUnit[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ unitId: '', area: '', type: 'cleaning', priority: 'normal', assignedTo: '', notes: '' });
  const submit = async () => {
    try {
      await act('/api/erp/housekeeping', { action: 'task_create', ...form, unitId: form.unitId || undefined });
      notify('Task created'); onDone();
    } catch (error) { notifyError(error); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-light">New Housekeeping Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Room (or leave blank for a public area)">
            <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {!form.unitId && (
            <Field label="Area"><Input value={form.area} placeholder="Lobby / Pool / Banquet foyer" onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['cleaning', 'turndown', 'deep_clean', 'inspection', 'linen', 'minibar', 'other'].map((t) => (
                    <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'normal', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Assign To"><Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></Field>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Button onClick={submit} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Create Task</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LostFoundDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ item: '', description: '', foundAt: '', guestName: '', guestContact: '' });
  const submit = async () => {
    try { await act('/api/erp/housekeeping', { action: 'lf_create', ...form }); notify('Logged'); onDone(); }
    catch (error) { notifyError(error); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-light">Log Lost & Found Item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Item"><Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Found At"><Input value={form.foundAt} placeholder="Room 203 / Poolside" onChange={(e) => setForm({ ...form, foundAt: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Guest (if known)"><Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} /></Field>
            <Field label="Guest Contact"><Input value={form.guestContact} onChange={(e) => setForm({ ...form, guestContact: e.target.value })} /></Field>
          </div>
          <Button onClick={submit} disabled={!form.item} className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
