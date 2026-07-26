'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, fmtDateTime, notifyError } from '@/components/erp/lib';
import { Chip, DataTable, EmptyState, PageHeader, Spinner, Td } from '@/components/erp/ui';

interface Entry {
  id: string; username: string; action: string; entity: string | null;
  summary: string; createdAt: string;
}

export default function AuditTrail() {
  const [data, setData] = useState<{ entries: Entry[]; users: string[] } | null>(null);
  const [q, setQ] = useState('');
  const [user, setUser] = useState('all');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (user !== 'all') params.set('user', user);
      setData(await api(`/api/erp/audit?${params}`));
    } catch (error) { notifyError(error); }
  }, [q, user]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="Every action, by whom, when — append-only"
        actions={
          <>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions" className="pl-8 w-52" />
            </div>
            <Select value={user} onValueChange={setUser}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {data.users.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </>
        } />

      {data.entries.length === 0 ? <EmptyState message="Nothing recorded yet." /> : (
        <div className="bg-white border border-gold/10 p-4">
          <DataTable headers={['When', 'Who', 'Action', 'What Happened']} minWidth={700}>
            {data.entries.map((entry) => (
              <tr key={entry.id}>
                <Td className="text-xs whitespace-nowrap">{fmtDateTime(entry.createdAt)}</Td>
                <Td className="font-mono text-xs">{entry.username}</Td>
                <Td><Chip label={entry.action} className="bg-cream text-charcoal border-gold/20 font-mono text-[10px]" /></Td>
                <Td className="text-sm">{entry.summary}</Td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}
