'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHotelStore } from '@/lib/store';
import { list } from '@/lib/content';
import ImageField from '@/components/admin/ImageField';
import type { GalleryImage } from '@/lib/types';

export default function AdminGallery() {
  const { toast } = useToast();
  const { gallery, setGallery, settings } = useHotelStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<Partial<GalleryImage> | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const categories = list<string>(settings, 'galleryCategories');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/gallery');
      if (res.ok) setGallery(await res.json());
    } finally {
      setLoading(false);
    }
  }, [setGallery]);

  useEffect(() => { load(); }, [load]);

  /** Bulk upload straight into a category — the fastest way to fill a gallery. */
  const uploadMany = async (files: FileList) => {
    setUploading(true);
    const category = filter === 'all' ? categories[0] ?? 'general' : filter;
    let added = 0;

    for (const file of Array.from(files)) {
      try {
        const body = new FormData();
        body.append('file', file);
        body.append('folder', `gallery/${category}`);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body });
        const uploaded = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploaded.error || 'Upload failed');

        const createRes = await fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: uploaded.url,
            category,
            caption: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
            sortOrder: gallery.length + added + 1,
          }),
        });
        if (!createRes.ok) throw new Error('Could not add the image to the gallery');
        added += 1;
      } catch (error) {
        toast({
          title: `Could not add ${file.name}`,
          description: error instanceof Error ? error.message : undefined,
          variant: 'destructive',
        });
      }
    }

    if (added) toast({ title: `Added ${added} image(s) to ${category}` });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    load();
  };

  const save = async () => {
    if (!draft?.url) {
      toast({ title: 'Choose or upload an image first', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/gallery', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast({ title: draft.id ? 'Image updated' : 'Image added' });
      setDraft(null);
      load();
    } catch (error) {
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (image: GalleryImage) => {
    if (!confirm('Remove this image from the gallery?')) return;
    await fetch(`/api/gallery?id=${image.id}`, { method: 'DELETE' });
    toast({ title: 'Image removed' });
    load();
  };

  const filtered = filter === 'all' ? gallery : gallery.filter((image) => image.category === filter);
  const allCategories = [...new Set([...categories, ...gallery.map((image) => image.category)])];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">Gallery</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} image(s){filter !== 'all' ? ` in ${filter}` : ''}. Categories are configured under Website Copy.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[150px] h-9 text-xs rounded-none border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {allCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="border-gold/20 text-xs tracking-wider uppercase rounded-none"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
            Bulk Upload
          </Button>
          <Button
            onClick={() => setDraft({ url: '', category: filter === 'all' ? categories[0] ?? 'general' : filter, caption: '', isActive: true, sortOrder: gallery.length + 1 })}
            className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Image
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading gallery…
        </div>
      ) : filtered.length === 0 ? (
        <p className="bg-white border border-gold/10 p-12 text-sm text-muted-foreground text-center">
          No images here yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((image) => (
            <figure key={image.id} className="group bg-white border border-gold/10 overflow-hidden">
              <div className="aspect-[4/3] bg-cream bg-cover bg-center relative" style={{ backgroundImage: `url(${image.url})` }}>
                <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button onClick={() => setDraft(image)} className="w-9 h-9 bg-white/90 flex items-center justify-center cursor-pointer" aria-label="Edit">
                    <Pencil className="w-4 h-4 text-charcoal" />
                  </button>
                  <button onClick={() => remove(image)} className="w-9 h-9 bg-white/90 flex items-center justify-center cursor-pointer" aria-label="Delete">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                {!image.isActive && (
                  <span className="absolute top-2 left-2 bg-charcoal/80 text-white text-[10px] tracking-wider uppercase px-2 py-0.5">Hidden</span>
                )}
              </div>
              <figcaption className="p-3">
                <p className="text-xs text-charcoal truncate">{image.caption || 'Untitled'}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{image.category}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => { if (event.target.files?.length) uploadMany(event.target.files); }}
      />

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-lg rounded-none border-gold/20">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">{draft?.id ? 'Edit Image' : 'Add Image'}</DialogTitle>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Image *</Label>
                <ImageField value={draft.url ?? ''} onChange={(url) => setDraft({ ...draft, url })} folder="gallery" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs tracking-wider uppercase text-muted-foreground">Caption</Label>
                <Input value={draft.caption ?? ''} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} className="rounded-none border-gold/20" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Category</Label>
                  <Select value={draft.category ?? 'general'} onValueChange={(value) => setDraft({ ...draft, category: value })}>
                    <SelectTrigger className="rounded-none border-gold/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...new Set([...allCategories, 'general'])].map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs tracking-wider uppercase text-muted-foreground">Sort Order</Label>
                  <Input
                    type="number"
                    value={draft.sortOrder ?? 0}
                    onChange={(e) => setDraft({ ...draft, sortOrder: Number.parseInt(e.target.value, 10) || 0 })}
                    className="rounded-none border-gold/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border border-gold/15 px-3 py-2.5">
                <span className="text-xs tracking-wider uppercase text-muted-foreground">Visible</span>
                <Switch checked={draft.isActive ?? true} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDraft(null)} className="border-gold/20 text-xs tracking-wider uppercase rounded-none">
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none">
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null} Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
