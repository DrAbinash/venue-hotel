'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { MediaAsset } from '@/lib/types';

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * The media library.
 *
 * Everything uploaded anywhere in the panel lands here, so an image can be
 * uploaded once and its URL reused across rooms, the gallery and the menu.
 */
export default function AdminMedia() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/upload');
      if (res.ok) setAssets(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!list.length) {
      toast({ title: 'Only image files can be uploaded', variant: 'destructive' });
      return;
    }

    setUploading(list.length);
    let failures = 0;
    for (const file of list) {
      try {
        const body = new FormData();
        body.append('file', file);
        body.append('folder', 'library');
        const res = await fetch('/api/upload', { method: 'POST', body });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Upload failed');
        }
      } catch (error) {
        failures += 1;
        toast({
          title: `Could not upload ${file.name}`,
          description: error instanceof Error ? error.message : undefined,
          variant: 'destructive',
        });
      } finally {
        setUploading((count) => count - 1);
      }
    }

    if (failures < list.length) toast({ title: `Uploaded ${list.length - failures} image(s)` });
    load();
  };

  const remove = async (asset: MediaAsset) => {
    if (!confirm(`Delete ${asset.filename}? Anything still pointing at it will show a broken image.`)) return;
    const res = await fetch(`/api/upload?id=${asset.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Image deleted' });
      load();
    } else {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-medium">Media Library</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Images are resized and converted to WebP on upload, then served from /api/media.
          </p>
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          className="bg-gold hover:bg-gold-dark text-white text-xs tracking-wider uppercase rounded-none"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Images
        </Button>
      </div>

      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length) uploadFiles(event.dataTransfer.files);
        }}
        className={`border-2 border-dashed p-10 text-center mb-6 transition-colors ${
          dragging ? 'border-gold bg-gold/5' : 'border-gold/20 bg-white'
        }`}
      >
        {uploading > 0 ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading {uploading} image(s)…
          </p>
        ) : (
          <>
            <ImagePlus className="w-8 h-8 text-gold/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Drop images here, or use the button above.</p>
            <p className="text-[11px] text-muted-foreground mt-1">JPEG, PNG, WebP, AVIF, GIF or SVG.</p>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : assets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nothing uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <figure key={asset.id} className="group bg-white border border-gold/10 overflow-hidden">
              <div className="aspect-square bg-cream bg-cover bg-center relative" style={{ backgroundImage: `url(${asset.url})` }}>
                <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => { navigator.clipboard?.writeText(asset.url); toast({ title: 'URL copied' }); }}
                    className="w-9 h-9 bg-white/90 flex items-center justify-center hover:bg-white cursor-pointer"
                    aria-label="Copy URL"
                  >
                    <Copy className="w-4 h-4 text-charcoal" />
                  </button>
                  <button
                    onClick={() => remove(asset)}
                    className="w-9 h-9 bg-white/90 flex items-center justify-center hover:bg-white cursor-pointer"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              <figcaption className="p-2">
                <p className="text-[11px] text-charcoal truncate" title={asset.filename}>{asset.filename}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatSize(asset.size)}{asset.width ? ` · ${asset.width}×${asset.height}` : ''}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) uploadFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
