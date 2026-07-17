'use client';

import { useHotelStore } from '@/lib/store';
import { Phone, Mail, MapPin, Instagram, Facebook, Twitter } from 'lucide-react';

export default function Footer() {
  const { settings, setView } = useHotelStore();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0d0d0d] text-white">
      {/* Top Bar */}
      <div className="border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="lg:col-span-1">
              <h3 className="text-2xl font-light tracking-[0.3em] uppercase mb-2">
                {settings.hotelName || 'The Venue'}
              </h3>
              <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#c9a96e' }}>
                Hotel &amp; Resort
              </p>
              <p className="text-sm text-white/50 leading-relaxed">
                {settings.description?.slice(0, 150) || 'A world-class luxury hotel offering an unparalleled experience of elegance, comfort, and sophistication.'}
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-xs tracking-widest uppercase mb-6" style={{ color: '#c9a96e' }}>
                Quick Links
              </h4>
              <ul className="space-y-3">
                {['Home', 'Rooms & Suites', 'Gallery', 'Contact'].map((link) => (
                  <li key={link}>
                    <button
                      onClick={() => {
                        const key = link === 'Rooms & Suites' ? 'rooms' : link.toLowerCase();
                        setView(key as 'home' | 'rooms' | 'gallery' | 'contact');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-sm text-white/50 hover:text-gold transition-colors tracking-wider cursor-pointer"
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs tracking-widest uppercase mb-6" style={{ color: '#c9a96e' }}>
                Contact Info
              </h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-white/50">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
                  {settings.address || '42 Heritage Lane, City Center'}
                </li>
                <li className="flex items-center gap-3 text-sm text-white/50">
                  <Phone className="w-4 h-4 flex-shrink-0 text-gold" />
                  {settings.phone || '+1 (555) 234-5678'}
                </li>
                <li className="flex items-center gap-3 text-sm text-white/50">
                  <Mail className="w-4 h-4 flex-shrink-0 text-gold" />
                  {settings.email || 'reservations@thevenue.com'}
                </li>
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h4 className="text-xs tracking-widest uppercase mb-6" style={{ color: '#c9a96e' }}>
                Stay Updated
              </h4>
              <p className="text-sm text-white/50 mb-4 leading-relaxed">
                Subscribe to receive exclusive offers and updates.
              </p>
              <div className="flex">
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 h-10 px-4 bg-[#1a1a1a] border border-gold/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold rounded-none"
                />
                <button className="h-10 px-4 bg-gold text-white text-xs tracking-wider hover:bg-gold-dark transition-colors rounded-none cursor-pointer">
                  Join
                </button>
              </div>
              <div className="flex gap-4 mt-6">
                {[Instagram, Facebook, Twitter].map((Icon, i) => (
                  <a key={i} href="#" className="text-white/40 hover:text-gold transition-colors">
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-white/30">
            &copy; {year} {settings.hotelName || 'The Venue'}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <button
              onClick={() => setView('admin')}
              className="text-[10px] text-white/20 hover:text-white/40 tracking-widest uppercase transition-colors cursor-pointer"
            >
              Admin Panel
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}