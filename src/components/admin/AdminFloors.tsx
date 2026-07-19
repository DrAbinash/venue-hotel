'use client';

import { useHotelStore } from '@/lib/store';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Floor } from '@/lib/types';

export default function AdminFloors() {
  const { floors, setFloors } = useHotelStore();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<Floor> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadFloors = useCallback(async () => {
    const res = await fetch('/api/floors');
    const data = await res.json();
    setFloors(data);
  }, [setFloors]);

  useEffect(() => { loadFloors(); }, [loadFloors]);

  const openNew = () => {
    setEditing({ name: '', number: floors.length + 1, description: '', isActive: true, sortOrder: floors.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (floor: Floor) => {
    setEditing({ ...floor });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await fetch('/api/floors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
        toast({ title: 'Floor updated' });
      } else {
        await fetch('/api/floors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
        toast({ title: 'Floor created' });
      }
      setDialogOpen(false);
      loadFloors();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/floors?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Floor deleted' });
    loadFloors();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Floor Management</h2>
        <Button onClick={openNew} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none">
          <Plus className="w-4 h-4 mr-1" /> Add Floor
        </Button>
      </div>

      <div className="bg-white border border-gold/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gold/10 hover:bg-transparent">
              <TableHead className="text-xs tracking-wider uppercase">Floor</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Number</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Rooms</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Description</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Status</TableHead>
              <TableHead className="text-xs tracking-wider uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {floors.map((floor) => (
              <TableRow key={floor.id} className="border-gold/5">
                <TableCell className="font-medium text-sm">{floor.name}</TableCell>
                <TableCell className="text-sm">{floor.number}</TableCell>
                <TableCell className="text-sm">{floor.rooms?.length || 0}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{floor.description || '-'}</TableCell>
                <TableCell>
                  <Badge variant={floor.isActive ? 'default' : 'secondary'} className={floor.isActive ? 'bg-green-100 text-green-700' : ''}>
                    {floor.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(floor)} className="h-8 w-8 p-0"><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(floor.id)} className="h-8 w-8 p-0 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-xl font-light tracking-wider">{editing?.id ? 'Edit Floor' : 'New Floor'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Floor Name *</Label>
              <Input value={editing?.name || ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} className="rounded-none border-gold/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Floor Number *</Label>
              <Input type="number" value={editing?.number || ''} onChange={(e) => setEditing({ ...editing!, number: parseInt(e.target.value) || 0 })} className="rounded-none border-gold/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Description</Label>
              <Textarea value={editing?.description || ''} onChange={(e) => setEditing({ ...editing!, description: e.target.value })} rows={3} className="rounded-none border-gold/20 resize-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Sort Order</Label>
              <Input type="number" value={editing?.sortOrder || 0} onChange={(e) => setEditing({ ...editing!, sortOrder: parseInt(e.target.value) || 0 })} className="rounded-none border-gold/20" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editing?.isActive ?? true} onCheckedChange={(v) => setEditing({ ...editing!, isActive: v })} />
              <Label className="text-sm">Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-none border-gold/20">Cancel</Button>
            <Button onClick={handleSave} className="bg-gold hover:bg-gold-dark text-white rounded-none"><Save className="w-4 h-4 mr-1" /> Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}