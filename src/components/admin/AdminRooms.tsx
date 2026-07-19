'use client';

import { useHotelStore } from '@/lib/store';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Upload, X, Save, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Room, Floor } from '@/lib/types';

export default function AdminRooms() {
  const { rooms, setRooms, floors } = useHotelStore();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [amenitiesInput, setAmenitiesInput] = useState('');

  const loadRooms = useCallback(async () => {
    const res = await fetch('/api/rooms');
    const data = await res.json();
    setRooms(data);
  }, [setRooms]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const openNew = () => {
    setEditing({
      name: '', roomNumber: '', floorId: floors[0]?.id || '', type: 'Standard',
      basePrice: 0, maxGuests: 2, bedType: '', size: '', description: '',
      amenities: '[]', images: '[]', isActive: true, sortOrder: 0,
    });
    setAmenitiesInput('');
    setDialogOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditing({ ...room });
    const ams: string[] = JSON.parse(room.amenities);
    setAmenitiesInput(ams.join(', '));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    const payload = {
      ...editing,
      amenities: JSON.stringify(amenitiesInput.split(',').map((s) => s.trim()).filter(Boolean)),
    };
    try {
      if (editing.id) {
        await fetch('/api/rooms', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        toast({ title: 'Room updated successfully' });
      } else {
        await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        toast({ title: 'Room created successfully' });
      }
      setDialogOpen(false);
      loadRooms();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/rooms?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Room deleted' });
    loadRooms();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) {
        const imgs: string[] = editing.images ? JSON.parse(editing.images) : [];
        imgs.push(data.url);
        setEditing({ ...editing, images: JSON.stringify(imgs) });
      }
    } catch { /* ignore */ }
    setUploading(false);
  };

  const removeImage = (idx: number) => {
    if (!editing) return;
    const imgs: string[] = JSON.parse(editing.images || '[]');
    imgs.splice(idx, 1);
    setEditing({ ...editing, images: JSON.stringify(imgs) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Room Management</h2>
        <Button onClick={openNew} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none">
          <Plus className="w-4 h-4 mr-1" /> Add Room
        </Button>
      </div>

      <div className="bg-white border border-gold/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gold/10 hover:bg-transparent">
              <TableHead className="text-xs tracking-wider uppercase">Room</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Type</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Floor</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Price</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Photos</TableHead>
              <TableHead className="text-xs tracking-wider uppercase">Status</TableHead>
              <TableHead className="text-xs tracking-wider uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => {
              const images: string[] = JSON.parse(room.images || '[]');
              return (
                <TableRow key={room.id} className="border-gold/5">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{room.name}</p>
                      <p className="text-xs text-muted-foreground">#{room.roomNumber}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{room.type}</TableCell>
                  <TableCell className="text-sm">{room.floor?.name || '-'}</TableCell>
                  <TableCell className="text-sm">${room.basePrice}/night</TableCell>
                  <TableCell>
                    <div className="flex -space-x-1">
                      {images.slice(0, 3).map((img, i) => (
                        <div key={i} className="w-8 h-8 rounded bg-cream overflow-hidden border border-white">
                          <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${img})` }} />
                        </div>
                      ))}
                      <span className="text-xs text-muted-foreground ml-1 self-center">{images.length}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={room.isActive ? 'default' : 'secondary'} className={room.isActive ? 'bg-green-100 text-green-700' : ''}>
                      {room.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(room)} className="h-8 w-8 p-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(room.id)} className="h-8 w-8 p-0 text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Room Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-light tracking-wider">
              {editing?.id ? 'Edit Room' : 'New Room'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Room Name *</Label>
              <Input value={editing?.name || ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} className="rounded-none border-gold/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Room Number *</Label>
              <Input value={editing?.roomNumber || ''} onChange={(e) => setEditing({ ...editing!, roomNumber: e.target.value })} className="rounded-none border-gold/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Floor *</Label>
              <Select value={editing?.floorId || ''} onValueChange={(v) => setEditing({ ...editing!, floorId: v })}>
                <SelectTrigger className="rounded-none border-gold/20"><SelectValue placeholder="Select Floor" /></SelectTrigger>
                <SelectContent>
                  {floors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Room Type *</Label>
              <Select value={editing?.type || 'Standard'} onValueChange={(v) => setEditing({ ...editing!, type: v })}>
                <SelectTrigger className="rounded-none border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Standard', 'Deluxe Room', 'Superior Room', 'Premium Suite', 'Royal Suite', 'Presidential Suite'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Base Price ($) *</Label>
              <Input type="number" value={editing?.basePrice || ''} onChange={(e) => setEditing({ ...editing!, basePrice: parseFloat(e.target.value) || 0 })} className="rounded-none border-gold/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Max Guests</Label>
              <Input type="number" value={editing?.maxGuests || 2} onChange={(e) => setEditing({ ...editing!, maxGuests: parseInt(e.target.value) || 2 })} className="rounded-none border-gold/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Bed Type</Label>
              <Input value={editing?.bedType || ''} onChange={(e) => setEditing({ ...editing!, bedType: e.target.value })} placeholder="King, Queen, Twin..." className="rounded-none border-gold/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Size</Label>
              <Input value={editing?.size || ''} onChange={(e) => setEditing({ ...editing!, size: e.target.value })} placeholder="45 sqm" className="rounded-none border-gold/20" />
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <Label className="text-xs tracking-wider uppercase">Description *</Label>
            <Textarea value={editing?.description || ''} onChange={(e) => setEditing({ ...editing!, description: e.target.value })} rows={3} className="rounded-none border-gold/20 resize-none" />
          </div>

          <div className="space-y-2 mt-4">
            <Label className="text-xs tracking-wider uppercase">Amenities (comma-separated)</Label>
            <Input value={amenitiesInput} onChange={(e) => setAmenitiesInput(e.target.value)} placeholder="Free WiFi, Air Conditioning, Mini Bar..." className="rounded-none border-gold/20" />
          </div>

          {/* Image Upload */}
          <div className="space-y-3 mt-4">
            <Label className="text-xs tracking-wider uppercase">Photographs</Label>
            <div className="flex flex-wrap gap-3">
              {(editing?.images ? JSON.parse(editing.images) : [] as string[]).map((img: string, idx: number) => (
                <div key={idx} className="relative w-24 h-24 bg-cream border border-gold/10 overflow-hidden group">
                  <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${img})` }} />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-24 h-24 border-2 border-dashed border-gold/30 flex flex-col items-center justify-center cursor-pointer hover:border-gold/60 transition-colors">
                {uploading ? (
                  <div className="animate-spin w-5 h-5 border-2 border-gold border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-gold/50 mb-1" />
                    <span className="text-[10px] text-muted-foreground">Upload</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Switch checked={editing?.isActive ?? true} onCheckedChange={(v) => setEditing({ ...editing!, isActive: v })} />
            <Label className="text-sm">Active</Label>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-none border-gold/20">Cancel</Button>
            <Button onClick={handleSave} className="bg-gold hover:bg-gold-dark text-white rounded-none">
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}