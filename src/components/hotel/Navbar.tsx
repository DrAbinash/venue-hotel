'use client';

import { useHotelStore } from '@/lib/store';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { key: 'home', label: 'Home' },
  { key: 'rooms', label: 'Rooms & Suites' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'contact', label: 'Contact' },
];

export default function Navbar() {
  const { view, setView, settings, mobileMenuOpen, setMobileMenuOpen } = useHotelStore();
  const isScrolled = typeof window !== 'undefined' ? false : false;

  return (
    <>
      <div className="hidden md:block bg-charcoal text-white/80 text-sm py-2 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span>{settings.email} | {settings.phone}</span>
          <span className="tracking-widest uppercase text-xs" style={{ color: '#c9a96e' }}>
            {settings.tagline}
          </span>
        </div>
      </div>
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gold/20 luxury-shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <button
              onClick={() => { setView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex flex-col items-start cursor-pointer"
            >
              <span className="text-2xl lg:text-3xl font-light tracking-[0.3em] uppercase" style={{ color: '#1a1a1a' }}>
                {settings.hotelName || 'The Venue'}
              </span>
              <span className="text-[10px] tracking-[0.4em] uppercase text-gold">
                Hotel &amp; Resort
              </span>
            </button>

            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.key}
                  onClick={() => { setView(link.key as 'home' | 'rooms' | 'gallery' | 'contact'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="relative text-sm tracking-widest uppercase text-charcoal/80 hover:text-gold transition-colors duration-300 group cursor-pointer"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-gold group-hover:w-full transition-all duration-300" />
                </button>
              ))}
              <Button
                onClick={() => { setView('booking'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="bg-gold text-white hover:bg-gold-dark tracking-widest uppercase text-xs px-6 py-2.5 rounded-none transition-all duration-300"
              >
                Book Now
              </Button>
            </div>

            <div className="flex items-center gap-3 lg:hidden">
              <a href={`tel:${settings.phone}`} className="text-gold">
                <Phone className="w-5 h-5" />
              </a>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-charcoal p-1 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-gold/20 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.key}
                  onClick={() => { setView(link.key as 'home' | 'rooms' | 'gallery' | 'contact'); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="block w-full text-left py-3 px-4 text-sm tracking-widest uppercase text-charcoal/80 hover:text-gold hover:bg-cream/50 transition-all cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
              <Button
                onClick={() => { setView('booking'); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full mt-3 bg-gold text-white hover:bg-gold-dark tracking-widest uppercase text-xs py-3 rounded-none"
              >
                Book Now
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}