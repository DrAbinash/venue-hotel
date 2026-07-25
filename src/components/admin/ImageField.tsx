'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface ImageFieldProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  className?: string;
}

/**
 * A single image slot: upload from the device, paste a URL, or clear it.
 *
 * Uploads go to /api/upload, which optimises the file and returns a stable
 * /api/media/... URL, so the same control works in development and behind a
 * Docker volume in production.
 */
export default function ImageField({ value, onChange, folder = 'general', className = '' }: ImageFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('folder', folder);

      const res = await fetch('/api/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      onChange(data.url);
      toast({ title: 'Image uploaded' });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="relative w-28 h-20 flex-shrink-0 border border-gold/20 bg-cream/40 overflow-hidden flex items-center justify-center hover:border-gold/50 transition-colors cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gold" />
          ) : value ? (
            <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${value})` }} />
          ) : (
            <ImagePlus className="w-5 h-5 text-gold/50" />
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="border-gold/20 text-[11px] tracking-wider uppercase rounded-none"
            >
              <Upload className="w-3 h-3 mr-1.5" /> Upload
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setUrlMode((mode) => !mode)}
              className="border-gold/20 text-[11px] tracking-wider uppercase rounded-none"
            >
              <Link2 className="w-3 h-3 mr-1.5" /> URL
            </Button>
            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange('')}
                className="text-[11px] tracking-wider uppercase text-muted-foreground hover:text-red-500 rounded-none"
              >
                <Trash2 className="w-3 h-3 mr-1.5" /> Clear
              </Button>
            )}
          </div>

          {(urlMode || value) && (
            <Input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="https://… or /api/media/…"
              className="h-9 text-xs border-gold/20 rounded-none"
            />
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
        }}
      />
    </div>
  );
}
