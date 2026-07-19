'use client';

import { useHotelStore } from '@/lib/store';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Upload, X, Save, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { GalleryImage } from '@/lib/types';

const categories = ['general', 'rooms', 'dining', 'amenities', 'exterior', 'events'];

export default function AdminGallery() {
  const { gallery, setGallery } = useHotelStore();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<GalleryImage> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);

  const loadGallery = useCallback(async () => {
    const res = await fetch('/api/gallery');
    const data = await res.json();
    setGallery(data);
  }, [setGallery]);

  useEffect(() => { loadGallery(); }, [loadGallery]);

  const openNew = () => {
    setEditing({ category: 'general', url: '', caption: '', sortOrder: gallery.length + 1, isActive: true });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await fetch('/api/gallery', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
        toast({ title: 'Image updated' });
      } else {
        await fetch('/api/gallery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
        toast({ title: 'Image added' });
      }
      setDialogOpen(false);
      loadGallery();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/gallery?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Image removed' });
    loadGallery();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) {
        setEditing({ ...editing!, url: data.url });
      }
    } catch { /* ignore */ }
    setUploading(false);
  };

  const filtered = filter === 'all' ? gallery : gallery.filter((g) => g.category === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Gallery Management</h2>
        <div className="flex gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs rounded-none border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none">
            <Plus className="w-4 h-4 mr-1" /> Add Image
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((img) => (
          <div key={img.id} className="relative group bg-white border border-gold/10 overflow-hidden">
            <div className="aspect-[4/3] bg-cream">
              <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${img.url})` }} />
            </div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground truncate">{img.caption || 'No caption'}</p>
              <p className="text-[10px] text-gold uppercase tracking-wider">{img.category}</p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => handleDelete(img.id)} className="h-7 w-7 p-0 bg-black/50 text-white hover:bg-black/70 rounded-none">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center py-12 text-muted-foreground text-sm">No images in this category</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-xl font-light tracking-wider">Add Gallery Image</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Image *</Label>
              {editing?.url ? (
                <div className="relative w-full h-48 bg-cream border border-gold/10">
                  <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${editing.url})` }} />
                  <button onClick={() => setEditing({ ...editing!, url: '' })} className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center cursor-pointer"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <label className="w-full h-48 border-2 border-dashed border-gold/30 flex flex-col items-center justify-center cursor-pointer hover:border-gold/60 transition-colors">
                  {uploading ? (
                    <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gold/50 mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload image</p>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                </label>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Caption</Label>
              <Input value={editing?.caption || ''} onChange={(e) => setEditing({ ...editing!, caption: e.target.value })} placeholder="Image caption" className="rounded-none border-gold/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Category</Label>
              <Select value={editing?.category || 'general'} onValueChange={(v) => setEditing({ ...editing!, category: v })}>
                <SelectTrigger className="rounded-none border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs tracking-wider uppercase">Sort Order</Label>
              <Input type="number" value={editing?.sortOrder || 0} onChange={(e) => setEditing({ ...editing!, sortOrder: parseInt(e.target.value) || 0 })} className="rounded-none border-gold/20" />
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