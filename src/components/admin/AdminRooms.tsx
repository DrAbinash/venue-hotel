'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/pricing';
import { jsonArray } from '@/lib/content';
import type { Room } from '@/lib/types';

const EMPTY: Partial<Room> = {
  name: '', roomNumber: '', floorId: '', type: 'Deluxe', basePrice: 0, quantity: 1,
  maxGuests: 2, extraGuestFee: 0, bedType: 'King', size: '', view: '', description: '',
  amenities: '[]', images: '[]', isActive: true, isFeatured: false, sortOrder: 0,
};

export default function AdminRooms() {
  const { toast } = useToast();
  const { rooms, setRooms, floors, setFloors, settings } = useHotelStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<Partial<Room> | null>(null);
  const [amenityText, setAmenityText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const money = (value: number) => formatMoney(value, settings);

  const load = useCallback(async () => {
    try {
      const [roomsRes, floorsRes] = await Promise.all([fetch('/api/rooms'), fetch('/api/floors')]);
      if (roomsRes.ok) setRooms(await roomsRes.json());
      if (floorsRes.ok) setFloors(await floorsRes.json());
    } finally {
      setLoading(false);
    }
  }, [setRooms, setFloors]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setDraft({ ...EMPTY, floorId: floors[0]?.id ?? '', sortOrder: rooms.length + 1 });
    setAmenityText('');
  };

  const openEdit = (room: Room) => {
    setDraft({ ...room });
    setAmenityText(jsonArray(room.amenities).join(', '));
  };

  /**
   * Uploads go through /api/upload, which optimises the image and returns a
   * stable URL. Failures surface as a toast — the previous version swallowed
   * them, which is why photos silently never appeared.
   */
  const uploadImages = async (files: FileList) => {
    if (!draft) return;
    setUploading(true);
    const uploaded: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const body = new FormData();
        body.append('file', file);
        body.append('folder', 'rooms');
        const res = await fetch('/api/upload', { method: 'POST', body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        uploaded.push(data.url);
      } catch (error) {
        toast({
          title: `Could not upload ${file.name}`,
          description: error instanceof Error ? error.message : undefined,
          variant: 'destructive',
        });
      }
    }

    if (uploaded.length) {
      setDraft((current) => {
        if (!current) return current;
        return { ...current, images: JSON.stringify([...jsonArray(current.images), ...uploaded]) };
      });
      toast({ title: `Added ${uploaded.length} photo(s)` });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const moveImage = (from: number, to: number) => {
    if (!draft) return;
    const images = jsonArray(draft.images);
    if (to < 0 || to >= images.length) return;
    const [moved] = images.splice(from, 1);
    images.splice(to, 0, moved);
    setDraft({ ...draft, images: JSON.stringify(images) });
  };

  const removeImage = (index: number) => {
    if (!draft) return;
    const images = jsonArray(draft.images);
    images.splice(index, 1);
    setDraft({ ...draft, images: JSON.stringify(images) });
  };

  const save = async () => {
    if (!draft?.name || !draft.roomNumber || !draft.floorId) {
      toast({ title: 'Name, room number and floor are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...draft,
        amenities: JSON.stringify(
          amenityText.split(',').map((amenity) => amenity.trim()).filter(Boolean),
        ),
      };
      const res = await fetch('/api/rooms', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      toast({ title: draft.id ? 'Room updated' : 'Room created' });
      setDraft(null);
      load();
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (room: Room) => {
    if (!confirm(`Delete “${room.name}”?`)) return;
    const res = await fetch(`/api/rooms?id=${room.id}`, { method: 'DELETE' });
    const data = await res.json();
    toast({ title: data.message ?? 'Room deleted' });
    load();
  };

  const draftImages = draft ? jsonArray(draft.images) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">Rooms</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rates, inventory and photographs. Quantity controls how many of a room type can be sold at once.
          </p>
        </div>
        <Button
          onClick={openNew}
          disabled={floors.length === 0}
          className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Room
        </Button>
      </div>

      {floors.length === 0 && !loading && (
        <p className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 mb-4">
          Add a floor first — every room belongs to one.
        </p>
      )}

      <div className="bg-white border border-gold/10 overflow-x-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading rooms…
          </div>
        ) : rooms.length === 0 ? (
          <p className="p-8 text-sm text-muted-foreground text-center">No rooms yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-center">Units</TableHead>
                <TableHead className="text-center">Guests</TableHead>
                <TableHead>Photos</TableHead>
                <TableHead>Live</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 bg-cream bg-cover bg-center flex-shrink-0"
                        style={jsonArray(room.images)[0] ? { backgroundImage: `url(${jsonArray(room.images)[0]})` } : undefined}
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-charcoal truncate">{room.name}</p>
                        <p className="text-[11px] text-muted-foreground">#{room.roomNumber} · {room.type}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{room.floor?.name ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm">{money(room.basePrice)}</TableCell>
                  <TableCell className="text-center text-sm">{room.quantity}</TableCell>
                  <TableCell className="text-center text-sm">{room.maxGuests}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] rounded-none">
                      {jsonArray(room.images).length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={room.isActive}
                      onCheckedChange={async (checked) => {
                        await fetch('/api/rooms', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: room.id, isActive: checked }),
                        });
                        load();
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(room)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(room)} className="text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none border-gold/20">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">{draft?.id ? 'Edit Room' : 'New Room'}</DialogTitle>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Name *</Label>
                  <Input value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-none border-gold/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Room Number *</Label>
                  <Input value={draft.roomNumber ?? ''} onChange={(e) => setDraft({ ...draft, roomNumber: e.target.value })} className="rounded-none border-gold/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Floor *</Label>
                  <Select value={draft.floorId ?? ''} onValueChange={(value) => setDraft({ ...draft, floorId: value })}>
                    <SelectTrigger className="rounded-none border-gold/20"><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>
                      {floors.map((floor) => <SelectItem key={floor.id} value={floor.id}>{floor.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Type</Label>
                  <Input value={draft.type ?? ''} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="rounded-none border-gold/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {([
                  ['basePrice', 'Rate / night'],
                  ['quantity', 'Units'],
                  ['maxGuests', 'Max Guests'],
                  ['extraGuestFee', 'Extra Guest Fee'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs tracking-wider uppercase text-muted-foreground">{label}</Label>
                    <Input
                      type="number"
                      value={String(draft[key] ?? 0)}
                      onChange={(e) => setDraft({ ...draft, [key]: Number.parseFloat(e.target.value) || 0 })}
                      className="rounded-none border-gold/20"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  ['bedType', 'Bed'],
                  ['size', 'Size'],
                  ['view', 'View'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs tracking-wider uppercase text-muted-foreground">{label}</Label>
                    <Input
                      value={String(draft[key] ?? '')}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                      className="rounded-none border-gold/20"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Description</Label>
                <Textarea rows={3} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="rounded-none border-gold/20 resize-none" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Amenities</Label>
                <Textarea
                  rows={2}
                  value={amenityText}
                  onChange={(e) => setAmenityText(e.target.value)}
                  placeholder="Free WiFi, Air Conditioning, Mini Bar"
                  className="rounded-none border-gold/20 resize-none"
                />
                <p className="text-[11px] text-muted-foreground">Separate each with a comma.</p>
              </div>

              {/* --------------------------------------------------- photos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Photographs</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="border-gold/20 text-[11px] tracking-wider uppercase rounded-none"
                  >
                    {uploading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Upload className="w-3 h-3 mr-1.5" />}
                    {uploading ? 'Uploading…' : 'Upload'}
                  </Button>
                </div>

                {draftImages.length === 0 ? (
                  <p className="text-xs text-muted-foreground border border-dashed border-gold/20 p-6 text-center">
                    No photographs yet. The first one is used as the card image.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {draftImages.map((image, index) => (
                      <div key={`${image}-${index}`} className="relative group aspect-[4/3] bg-cream bg-cover bg-center border border-gold/10" style={{ backgroundImage: `url(${image})` }}>
                        {index === 0 && (
                          <span className="absolute top-1 left-1 bg-gold text-white text-[9px] tracking-wider uppercase px-1.5 py-0.5">Cover</span>
                        )}
                        <div className="absolute inset-0 bg-charcoal/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button onClick={() => moveImage(index, index - 1)} className="w-7 h-7 bg-white/90 flex items-center justify-center cursor-pointer" aria-label="Move earlier">
                            <GripVertical className="w-3.5 h-3.5 text-charcoal" />
                          </button>
                          <button onClick={() => removeImage(index)} className="w-7 h-7 bg-white/90 flex items-center justify-center cursor-pointer" aria-label="Remove">
                            <X className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => { if (event.target.files?.length) uploadImages(event.target.files); }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between border border-gold/15 px-3 py-2.5">
                  <span className="text-xs tracking-wider uppercase text-muted-foreground">Live on site</span>
                  <Switch checked={draft.isActive ?? true} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
                </div>
                <div className="flex items-center justify-between border border-gold/15 px-3 py-2.5">
                  <span className="text-xs tracking-wider uppercase text-muted-foreground">Signature room</span>
                  <Switch checked={draft.isFeatured ?? false} onCheckedChange={(checked) => setDraft({ ...draft, isFeatured: checked })} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setDraft(null)} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none">
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null} Save Room
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
