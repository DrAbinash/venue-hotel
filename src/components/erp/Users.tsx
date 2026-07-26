'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { act, api, fmtDateTime, notify, notifyError } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, Field, PageHeader, Spinner, Td } from '@/components/erp/ui';
import { ERP_MODULES, ERP_ROLES, MODULE_LABELS, ROLE_LABELS, ROLE_PRESETS, type ErpModule, type ErpRole } from '@/lib/erp/perms';

interface StaffRow {
  id: string; username: string; name: string; email: string | null; phone: string | null;
  role: string; permissions: string; isActive: boolean; lastLoginAt: string | null; createdAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<StaffRow[] | null>(null);
  const [edit, setEdit] = useState<Partial<StaffRow> | null>(null);

  const load = useCallback(async () => {
    try { setUsers((await api<{ users: StaffRow[] }>('/api/erp/users')).users); }
    catch (error) { notifyError(error); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!users) return <Spinner />;

  return (
    <div>
      <PageHeader title="Staff Users" subtitle="Who can sign in, and which modules they see"
        actions={
          <>
            <Button size="sm" variant="outline" className="rounded-none" onClick={() => setEdit({})}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New User
            </Button>
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </>
        } />

      {users.length === 0 ? <EmptyState message="No staff users." /> : (
        <div className="bg-white border border-gold/10 p-4">
          <DataTable headers={['User', 'Role', 'Last Login', 'Status', '']} minWidth={640}>
            {users.map((user) => (
              <tr key={user.id} className={user.isActive ? '' : 'opacity-50'}>
                <Td>
                  <button className="underline-offset-2 hover:underline cursor-pointer" onClick={() => setEdit(user)}>{user.name}</button>
                  <span className="block text-[11px] text-muted-foreground font-mono">@{user.username}</span>
                </Td>
                <Td><Chip label={ROLE_LABELS[user.role as ErpRole] ?? user.role} className="bg-cream text-charcoal border-gold/20" /></Td>
                <Td className="text-xs">{user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : 'never'}</Td>
                <Td><Chip label={user.isActive ? 'Active' : 'Disabled'} className={user.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-zinc-200 text-zinc-600 border-zinc-300'} /></Td>
                <Td>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="rounded-none h-7 text-xs"
                      onClick={() => {
                        const pw = window.prompt(`New password for @${user.username} (min 8 chars):`);
                        if (pw) act('/api/erp/users', { action: 'reset_password', id: user.id, password: pw }).then(() => notify('Password reset — they must change it at next login')).catch(notifyError);
                      }}>
                      <KeyRound className="w-3 h-3 mr-1" /> Reset
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-none h-7 text-xs"
                      onClick={() => act('/api/erp/users', { action: 'toggle', id: user.id }).then(load).catch(notifyError)}>
                      {user.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {edit && <UserDialog user={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function UserDialog({ user, onClose, onDone }: { user: Partial<StaffRow>; onClose: () => void; onDone: () => void }) {
  const isNew = !user.id;
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    username: user.username ?? '', name: user.name ?? '', email: user.email ?? '', phone: user.phone ?? '',
    role: (user.role as ErpRole) ?? 'FRONTDESK', password: '',
  });
  const [extras, setExtras] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(user.permissions ?? '[]')); } catch { return new Set(); }
  });

  const preset = new Set(ROLE_PRESETS[form.role] ?? []);

  const submit = async () => {
    setBusy(true);
    try {
      await act('/api/erp/users', {
        action: isNew ? 'create' : 'update',
        id: user.id, ...form,
        permissions: [...extras],
      });
      notify(isNew ? 'User created — they must change the password at first login' : 'User updated');
      onDone();
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-light">{isNew ? 'New Staff User' : `Edit — @${user.username}`}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {isNew && (
            <Field label="Username"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} /></Field>
          )}
          <Field label="Full Name" className={isNew ? '' : 'col-span-2'}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role" className="col-span-2">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as ErpRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ERP_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {isNew && (
            <Field label="Temporary Password (min 8 chars)" className="col-span-2">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          )}
        </div>

        <div>
          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Module Access</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {ERP_MODULES.map((module: ErpModule) => {
              const inPreset = preset.has(module);
              const granted = inPreset || extras.has(module);
              return (
                <label key={module}
                  className={`flex items-center gap-2 text-xs border px-2 py-1.5 ${inPreset ? 'bg-cream/60 border-gold/20 text-charcoal/60' : 'cursor-pointer border-gold/15'}`}>
                  <Checkbox checked={granted} disabled={inPreset}
                    onCheckedChange={(v) => {
                      const next = new Set(extras);
                      if (v) next.add(module); else next.delete(module);
                      setExtras(next);
                    }} />
                  {MODULE_LABELS[module]}
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Greyed items come with the role; tick extra modules to grant more.</p>
        </div>

        <Button onClick={submit} disabled={busy || !form.name || (isNew && (!form.username || form.password.length < 8))}
          className="w-full bg-gold hover:bg-gold-dark text-white rounded-none">
          {isNew ? 'Create User' : 'Save Changes'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
