'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, Menu, Phone, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelStore, type View } from '@/lib/store';
import { useOrderStore } from '@/lib/order-store';
import { text } from '@/lib/content';

const NAV_LINKS: { label: string; view: View }[] = [
  { label: 'Home', view: 'home' },
  { label: 'Rooms & Suites', view: 'rooms' },
  { label: 'Restaurant', view: 'restaurant' },
  { label: 'Gallery', view: 'gallery' },
  { label: 'Contact', view: 'contact' },
];

export default function Navbar() {
  const { setView, settings, mobileMenuOpen, setMobileMenuOpen } = useHotelStore();
  const cartCount = useOrderStore((state) => state.count());

  const go = (view: View) => {
    setView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const logo = text(settings, 'logoUrl', '');

  return (
    <>
      <div className="hidden md:block bg-charcoal text-white/80 text-sm py-2 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span>{text(settings, 'email')} | {text(settings, 'phone')}</span>
          <span className="tracking-widest uppercase text-xs text-gold">{text(settings, 'tagline')}</span>
        </div>
      </div>

      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gold/20 luxury-shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <button onClick={() => go('home')} className="flex items-center gap-3 cursor-pointer min-w-0 max-w-[60%] lg:max-w-[34%]">
              {logo ? (
                <img src={logo} alt={text(settings, 'hotelName')} className="h-9 lg:h-11 w-auto object-contain" />
              ) : (
                // A long hotel name must shrink rather than wrap — the header
                // is a fixed height and wrapped text would push into the page.
                <span className="flex flex-col items-start min-w-0 w-full">
                  <span className="w-full text-lg sm:text-xl lg:text-2xl font-light tracking-[0.2em] lg:tracking-[0.3em] uppercase text-charcoal truncate">
                    {text(settings, 'hotelName')}
                  </span>
                  <span className="w-full text-[10px] tracking-[0.4em] uppercase text-gold truncate">
                    {text(settings, 'brandSuffix')}
                  </span>
                </span>
              )}
            </button>

            <div className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.view}
                  onClick={() => go(link.view)}
                  className="relative text-sm tracking-widest uppercase text-charcoal/80 hover:text-gold transition-colors duration-300 group cursor-pointer"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-gold group-hover:w-full transition-all duration-300" />
                </button>
              ))}
              <button
                onClick={() => go('my-booking')}
                className="text-sm tracking-widest uppercase text-charcoal/60 hover:text-gold transition-colors cursor-pointer"
              >
                My Booking
              </button>
              <a
                href="/erp"
                className="flex items-center gap-1.5 text-xs tracking-widest uppercase text-charcoal/50 hover:text-gold transition-colors"
                title="Staff login — hotel ERP"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Staff
              </a>
              {cartCount > 0 && (
                <button
                  onClick={() => go('restaurant')}
                  className="relative text-charcoal/70 hover:text-gold transition-colors cursor-pointer"
                  aria-label="View your food order"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span className="absolute -top-2 -right-2 bg-gold text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                </button>
              )}
              <Button
                onClick={() => go('booking')}
                className="bg-gold text-white hover:bg-gold-dark tracking-widest uppercase text-xs px-6 py-2.5 rounded-none transition-all duration-300"
              >
                Book Now
              </Button>
            </div>

            <div className="flex items-center gap-4 lg:hidden">
              {cartCount > 0 && (
                <button onClick={() => go('restaurant')} className="relative text-charcoal/70" aria-label="View your food order">
                  <ShoppingBag className="w-5 h-5" />
                  <span className="absolute -top-2 -right-2 bg-gold text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                </button>
              )}
              <a href={`tel:${text(settings, 'phone')}`} className="text-gold" aria-label="Call the hotel">
                <Phone className="w-5 h-5" />
              </a>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-charcoal p-1 cursor-pointer"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
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
            className="lg:hidden bg-white border-b border-gold/20 overflow-hidden sticky top-16 z-40"
          >
            <div className="px-4 py-4 space-y-1">
              {[...NAV_LINKS, { label: 'My Booking', view: 'my-booking' as View }].map((link) => (
                <button
                  key={link.view}
                  onClick={() => go(link.view)}
                  className="block w-full text-left py-3 px-4 text-sm tracking-widest uppercase text-charcoal/80 hover:text-gold hover:bg-cream/50 transition-all cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
              <a
                href="/erp"
                className="block w-full text-left py-3 px-4 text-sm tracking-widest uppercase text-charcoal/50 hover:text-gold hover:bg-cream/50 transition-all"
              >
                Staff Login
              </a>
              <Button
                onClick={() => go('booking')}
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
