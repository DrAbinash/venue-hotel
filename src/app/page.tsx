'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useHotelStore } from '@/lib/store';
import { list, text, type StatItem } from '@/lib/content';
import Navbar from '@/components/hotel/Navbar';
import HeroSection from '@/components/hotel/HeroSection';
import BookingBar from '@/components/hotel/BookingBar';
import RoomsSection from '@/components/hotel/RoomsSection';
import GallerySection from '@/components/hotel/GallerySection';
import AmenitiesSection from '@/components/hotel/AmenitiesSection';
import TestimonialsSection from '@/components/hotel/TestimonialsSection';
import ContactSection from '@/components/hotel/ContactSection';
import Footer from '@/components/hotel/Footer';
import BookingPage from '@/components/hotel/BookingPage';
import MyBookingPage from '@/components/hotel/MyBookingPage';
import RestaurantPage from '@/components/restaurant/RestaurantPage';

/** The dark band between the rooms and the amenities. Entirely settings-driven. */
function StoryBand() {
  const { settings } = useHotelStore();
  const stats = list<StatItem>(settings, 'storyStats').filter((stat) => stat?.value);

  return (
    <section className="relative py-20 md:py-28 charcoal-bg text-white overflow-hidden">
      <div
        className="absolute inset-0 opacity-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${text(settings, 'storyImage')})` }}
      />
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <p className="text-xs tracking-[0.5em] uppercase mb-3 text-gold">{text(settings, 'storyEyebrow')}</p>
        <h2 className="text-3xl md:text-5xl font-extralight tracking-wide mb-6">{text(settings, 'storyTitle')}</h2>
        <div className="w-16 h-[1px] bg-gold mx-auto mb-8" />
        <p className="text-white/70 leading-relaxed max-w-3xl mx-auto text-base md:text-lg">
          {text(settings, 'storyBody')}
        </p>

        {stats.length > 0 && (
          <div
            className="grid gap-8 mt-14 max-w-xl mx-auto"
            style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={`${stat.label}-${index}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <p className="text-3xl md:text-4xl font-extralight text-gold">{stat.value}</p>
                <p className="text-xs tracking-widest uppercase text-white/50 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function HomePage() {
  const { view, setRooms, setGallery, setSettings } = useHotelStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Top up defaults for any newly added setting, then load public data.
        await fetch('/api/seed').catch(() => undefined);

        const [roomsRes, galleryRes, settingsRes] = await Promise.all([
          fetch('/api/rooms'),
          fetch('/api/gallery'),
          fetch('/api/settings'),
        ]);

        if (roomsRes.ok) setRooms(await roomsRes.json());
        if (galleryRes.ok) setGallery(await galleryRes.json());
        if (settingsRes.ok) setSettings(await settingsRes.json());
      } catch (error) {
        console.error('Failed to load site data:', error);
      }
    };
    loadData();
  }, [setRooms, setGallery, setSettings]);

  if (view === 'booking') return <Shell><BookingPage /></Shell>;
  if (view === 'my-booking') return <Shell><MyBookingPage /></Shell>;
  if (view === 'restaurant') return <Shell><RestaurantPage /></Shell>;
  if (view === 'rooms') return <Shell><RoomsSection /></Shell>;
  if (view === 'gallery') return <Shell><GallerySection /></Shell>;
  if (view === 'contact') return <Shell><ContactSection /></Shell>;

  return (
    <Shell>
      <HeroSection />
      <BookingBar />
      <RoomsSection />
      <StoryBand />
      <AmenitiesSection />
      <TestimonialsSection />
      <GallerySection />
      <ContactSection />
    </Shell>
  );
}
