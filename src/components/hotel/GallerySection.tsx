'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { list, text } from '@/lib/content';

export default function GallerySection() {
  const { gallery, settings } = useHotelStore();
  const [filter, setFilter] = useState('all');
  const [lightbox, setLightbox] = useState<number | null>(null);

  const categories = useMemo(() => {
    const configured = list<string>(settings, 'galleryCategories');
    const present = [...new Set(gallery.map((image) => image.category))];
    // Show configured categories that actually have photos, plus any strays.
    return [...configured.filter((category) => present.includes(category)),
      ...present.filter((category) => !configured.includes(category))];
  }, [gallery, settings]);

  const filtered = useMemo(
    () => (filter === 'all' ? gallery : gallery.filter((image) => image.category === filter)),
    [gallery, filter],
  );

  const step = (direction: number) => {
    setLightbox((current) => {
      if (current === null) return current;
      return (current + direction + filtered.length) % filtered.length;
    });
  };

  return (
    <section className="py-20 md:py-28 bg-cream/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.5em] uppercase mb-3 text-gold">{text(settings, 'galleryEyebrow')}</p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal">{text(settings, 'galleryTitle')}</h2>
          <div className="w-16 h-[1px] bg-gold mx-auto my-6" />
          <p className="text-muted-foreground max-w-2xl mx-auto">{text(settings, 'gallerySubtitle')}</p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {['all', ...categories].map((category) => (
              <button
                key={category}
                onClick={() => setFilter(category)}
                className={`px-5 py-2.5 text-xs tracking-widest uppercase border transition-all cursor-pointer ${
                  filter === category
                    ? 'border-gold bg-gold text-white'
                    : 'border-gold/20 text-charcoal/70 hover:border-gold/50'
                }`}
              >
                {category === 'all' ? 'All' : category}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Photographs are on their way.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {filtered.map((image, index) => (
              <motion.button
                key={image.id}
                type="button"
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04 }}
                onClick={() => setLightbox(index)}
                className="group relative aspect-square overflow-hidden bg-cream cursor-pointer"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${image.url})` }}
                />
                <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/40 transition-colors duration-500" />
                {image.caption && (
                  <span className="absolute inset-x-0 bottom-0 p-3 text-left text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    {image.caption}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {lightbox !== null && filtered[lightbox] && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={(event) => { event.stopPropagation(); setLightbox(null); }}
            className="absolute top-5 right-5 text-white/70 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-7 h-7" />
          </button>

          {filtered.length > 1 && (
            <>
              <button
                onClick={(event) => { event.stopPropagation(); step(-1); }}
                className="absolute left-3 sm:left-8 text-white/60 hover:text-white cursor-pointer p-2"
                aria-label="Previous"
              >
                <ChevronLeft className="w-9 h-9" />
              </button>
              <button
                onClick={(event) => { event.stopPropagation(); step(1); }}
                className="absolute right-3 sm:right-8 text-white/60 hover:text-white cursor-pointer p-2"
                aria-label="Next"
              >
                <ChevronRight className="w-9 h-9" />
              </button>
            </>
          )}

          <figure className="max-w-5xl w-full" onClick={(event) => event.stopPropagation()}>
            <img
              src={filtered[lightbox].url}
              alt={filtered[lightbox].caption ?? 'Hotel photograph'}
              className="w-full max-h-[80vh] object-contain"
            />
            {filtered[lightbox].caption && (
              <figcaption className="text-center text-sm text-white/60 mt-4">{filtered[lightbox].caption}</figcaption>
            )}
          </figure>
        </div>
      )}
    </section>
  );
}
