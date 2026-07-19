'use client';

import { useHotelStore } from '@/lib/store';
import { motion } from 'framer-motion';
import { useState } from 'react';

const defaultImages: Record<string, string[]> = {
  rooms: [
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&q=80',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80',
  ],
  dining: [
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
  ],
  amenities: [
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbec6e?w=600&q=80',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
  ],
  exterior: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&q=80',
  ],
  events: [
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&q=80',
    'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=600&q=80',
    'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=600&q=80',
  ],
};

const categories = ['All', 'Rooms', 'Dining', 'Amenities', 'Exterior', 'Events'];

export default function GallerySection() {
  const { gallery } = useHotelStore();
  const [activeCategory, setActiveCategory] = useState('All');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const hasDbImages = gallery.some((g) => !g.url.includes('placeholder'));
  const images = hasDbImages
    ? gallery.map((g) => ({ src: g.url, caption: g.caption, category: g.category }))
    : Object.entries(defaultImages).flatMap(([cat, imgs]) =>
        imgs.map((src) => ({ src, caption: cat, category: cat }))
      );

  const filtered = activeCategory === 'All'
    ? images
    : images.filter((img) => img.category.toLowerCase() === activeCategory.toLowerCase());

  return (
    <section className="py-20 md:py-28 cream-bg">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-xs tracking-[0.5em] uppercase mb-3" style={{ color: '#c9a96e' }}>
            Visual Journey
          </p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal mb-4">
            Our Gallery
          </h2>
          <div className="w-16 h-[1px] bg-gold mx-auto mb-6" />
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Discover the elegance and beauty of The Venue through our curated collection
            of photographs showcasing every corner of our property.
          </p>
        </motion.div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 text-xs tracking-widest uppercase transition-all duration-300 cursor-pointer rounded-none ${
                activeCategory === cat
                  ? 'bg-gold text-white'
                  : 'bg-white text-charcoal/70 hover:text-gold border border-gold/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((img, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="relative group cursor-pointer overflow-hidden aspect-[4/3]"
              onClick={() => setLightboxImg(img.src)}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                style={{ backgroundImage: `url(${img.src})` }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-end">
                <div className="p-3 text-white text-xs tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                  {img.caption}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full">
            <img
              src={lightboxImg}
              alt="Gallery"
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white flex items-center justify-center text-xl hover:bg-white/30 transition-colors cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  );
}