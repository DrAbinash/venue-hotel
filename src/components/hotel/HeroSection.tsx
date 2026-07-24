'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelStore } from '@/lib/store';
import { list, num, text } from '@/lib/content';

/** Full-bleed opening slideshow. Every string and slide comes from settings. */
export default function HeroSection() {
  const { settings, setView } = useHotelStore();
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroImages = useMemo(() => {
    const images = list<string>(settings, 'heroImages').filter(Boolean);
    return images.length ? images : [''];
  }, [settings]);

  const slideSeconds = Math.max(2, num(settings, 'heroSlideSeconds', 6));

  useEffect(() => {
    if (heroImages.length < 2) return;
    const timer = setInterval(() => {
      setCurrentSlide((previous) => (previous + 1) % heroImages.length);
    }, slideSeconds * 1000);
    return () => clearInterval(timer);
  }, [heroImages.length, slideSeconds]);

  // A slide list edited down in the admin panel must not leave a blank hero,
  // so the index is clamped as it is read rather than corrected in an effect.
  const activeSlide = currentSlide < heroImages.length ? currentSlide : 0;

  const goToBooking = () => {
    setView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stars = Math.max(0, Math.min(5, Math.round(num(settings, 'heroStars', 5))));

  return (
    <section className="relative h-[100vh] min-h-[600px] max-h-[900px] overflow-hidden">
      {heroImages.map((image, index) => (
        <div
          key={`${image}-${index}`}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: activeSlide === index ? 1 : 0 }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 bg-charcoal"
            style={image ? { backgroundImage: `url(${image})` } : undefined}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
        </div>
      ))}

      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center text-white px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="mb-4">
          {stars > 0 && (
            <div className="flex items-center justify-center gap-2 mb-4">
              {Array.from({ length: stars }).map((_, index) => (
                <Star key={index} className="w-4 h-4 fill-gold text-gold" />
              ))}
            </div>
          )}
          <p className="text-xs md:text-sm tracking-[0.5em] uppercase mb-4 text-gold">
            {text(settings, 'heroEyebrow')}
          </p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-[0.2em] uppercase mb-6"
        >
          {text(settings, 'hotelName')}
        </motion.h1>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.6 }} className="w-24 h-[1px] bg-gold mb-6" />

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="text-lg md:text-xl font-light tracking-wider text-white/90 max-w-2xl mb-10"
        >
          {text(settings, 'heroSubtitle')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Button
            onClick={goToBooking}
            size="lg"
            className="px-10 py-6 text-xs tracking-[0.3em] uppercase bg-gold hover:bg-gold-dark text-white rounded-none transition-all duration-300 luxury-shadow-lg"
          >
            {text(settings, 'heroPrimaryCta')}
          </Button>
          <Button
            onClick={() => { setView('rooms'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            size="lg"
            variant="outline"
            className="px-10 py-6 text-xs tracking-[0.3em] uppercase border-white/40 text-white hover:bg-white/10 hover:text-white rounded-none transition-all duration-300 bg-transparent"
          >
            {text(settings, 'heroSecondaryCta')}
          </Button>
        </motion.div>
      </div>

      {heroImages.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-3">
          {heroImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-0.5 transition-all duration-300 cursor-pointer ${
                activeSlide === index ? 'bg-gold w-12' : 'bg-white/50 hover:bg-white/70 w-8'
              }`}
            />
          ))}
        </div>
      )}

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-8 right-8 z-10 hidden md:block"
      >
        <ChevronDown className="w-6 h-6 text-white/60" />
      </motion.div>
    </section>
  );
}
