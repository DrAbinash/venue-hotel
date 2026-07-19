'use client';

import { useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import Navbar from '@/components/hotel/Navbar';
import HeroSection from '@/components/hotel/HeroSection';
import BookingBar from '@/components/hotel/BookingBar';
import RoomsSection from '@/components/hotel/RoomsSection';
import GallerySection from '@/components/hotel/GallerySection';
import AmenitiesSection from '@/components/hotel/AmenitiesSection';
import ContactSection from '@/components/hotel/ContactSection';
import Footer from '@/components/hotel/Footer';
import BookingPage from '@/components/hotel/BookingPage';
import AdminPanel from '@/components/admin/AdminPanel';

export default function HomePage() {
  const {
    view, setRooms, setFloors, setBookings, setGallery, setSettings,
  } = useHotelStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Seed if empty
        await fetch('/api/seed');

        const [roomsRes, floorsRes, bookingsRes, galleryRes, settingsRes] = await Promise.all([
          fetch('/api/rooms'),
          fetch('/api/floors'),
          fetch('/api/bookings'),
          fetch('/api/gallery'),
          fetch('/api/settings'),
        ]);

        setRooms(await roomsRes.json());
        setFloors(await floorsRes.json());
        setBookings(await bookingsRes.json());
        setGallery(await galleryRes.json());
        setSettings(await settingsRes.json());
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    loadData();
  }, [setRooms, setFloors, setBookings, setGallery, setSettings]);

  // Admin panel — no hotel UI
  if (view === 'admin') {
    return <AdminPanel />;
  }

  // Booking page — has its own layout
  if (view === 'booking') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <BookingPage />
        </main>
        <Footer />
      </div>
    );
  }

  // Rooms page
  if (view === 'rooms') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <RoomsSection />
        </main>
        <Footer />
      </div>
    );
  }

  // Gallery page
  if (view === 'gallery') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <GallerySection />
        </main>
        <Footer />
      </div>
    );
  }

  // Contact page
  if (view === 'contact') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <ContactSection />
        </main>
        <Footer />
      </div>
    );
  }

  // Home page (default)
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <BookingBar />
        <RoomsSection />

        {/* Intro / About Band */}
        <section className="relative py-20 md:py-28 charcoal-bg text-white overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1920&q=80)' }} />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
            <p className="text-xs tracking-[0.5em] uppercase mb-3" style={{ color: '#c9a96e' }}>
              Our Story
            </p>
            <h2 className="text-3xl md:text-5xl font-extralight tracking-wide mb-6">
              A Legacy of Luxury
            </h2>
            <div className="w-16 h-[1px] bg-gold mx-auto mb-8" />
            <p className="text-white/70 leading-relaxed max-w-3xl mx-auto text-base md:text-lg">
              Nestled in the heart of the city, The Venue stands as a beacon of refined hospitality,
              where every detail is curated to create moments of pure indulgence. Our commitment
              to excellence has made us the destination of choice for discerning travelers from
              around the world. From our exquisitely appointed rooms to our world-class dining
              and wellness facilities, every aspect of your stay is designed to exceed expectations.
            </p>
            <div className="grid grid-cols-3 gap-8 mt-14 max-w-xl mx-auto">
              <div>
                <p className="text-3xl md:text-4xl font-extralight" style={{ color: '#c9a96e' }}>15+</p>
                <p className="text-xs tracking-widest uppercase text-white/50 mt-1">Years of Excellence</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-extralight" style={{ color: '#c9a96e' }}>50K+</p>
                <p className="text-xs tracking-widest uppercase text-white/50 mt-1">Happy Guests</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-extralight" style={{ color: '#c9a96e' }}>4.9</p>
                <p className="text-xs tracking-widest uppercase text-white/50 mt-1">Guest Rating</p>
              </div>
            </div>
          </div>
        </section>

        <AmenitiesSection />
        <GallerySection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}