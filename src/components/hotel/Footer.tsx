'use client';

import Link from 'next/link';
import { Facebook, Instagram, Mail, MapPin, Phone, Twitter, Youtube, Globe } from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { socialLinks, text } from '@/lib/content';
import type { View } from '@/lib/store';

const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagramUrl: Instagram,
  facebookUrl: Facebook,
  twitterUrl: Twitter,
  youtubeUrl: Youtube,
  tripadvisorUrl: Globe,
};

const QUICK_LINKS: { label: string; view: View }[] = [
  { label: 'Home', view: 'home' },
  { label: 'Rooms & Suites', view: 'rooms' },
  { label: 'Restaurant', view: 'restaurant' },
  { label: 'Gallery', view: 'gallery' },
  { label: 'Contact', view: 'contact' },
  { label: 'My Booking', view: 'my-booking' },
];

export default function Footer() {
  const { settings, setView } = useHotelStore();
  const year = new Date().getFullYear();
  const socials = socialLinks(settings);

  const go = (view: View) => {
    setView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#0d0d0d] text-white">
      <div className="border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <h3 className="text-2xl font-light tracking-[0.3em] uppercase mb-2">{text(settings, 'hotelName')}</h3>
              <p className="text-xs tracking-[0.3em] uppercase mb-4 text-gold">{text(settings, 'brandSuffix')}</p>
              <p className="text-sm text-white/50 leading-relaxed">{text(settings, 'footerAbout')}</p>
            </div>

            <div>
              <h4 className="text-xs tracking-widest uppercase mb-6 text-gold">Quick Links</h4>
              <ul className="space-y-3">
                {QUICK_LINKS.map((link) => (
                  <li key={link.view}>
                    <button
                      onClick={() => go(link.view)}
                      className="text-sm text-white/50 hover:text-gold transition-colors tracking-wider cursor-pointer"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs tracking-widest uppercase mb-6 text-gold">Contact</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-white/50">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
                  <span>
                    {text(settings, 'address')}
                    <br />
                    {[text(settings, 'city'), text(settings, 'state'), text(settings, 'postalCode')].filter(Boolean).join(', ')}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-sm text-white/50">
                  <Phone className="w-4 h-4 flex-shrink-0 text-gold" />
                  <a href={`tel:${text(settings, 'phone')}`} className="hover:text-gold transition-colors">
                    {text(settings, 'phone')}
                  </a>
                </li>
                <li className="flex items-center gap-3 text-sm text-white/50">
                  <Mail className="w-4 h-4 flex-shrink-0 text-gold" />
                  <a href={`mailto:${text(settings, 'email')}`} className="hover:text-gold transition-colors">
                    {text(settings, 'email')}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs tracking-widest uppercase mb-6 text-gold">{text(settings, 'newsletterTitle')}</h4>
              <p className="text-sm text-white/50 mb-4 leading-relaxed">{text(settings, 'newsletterText')}</p>
              <form
                className="flex"
                onSubmit={(event) => {
                  event.preventDefault();
                  const input = event.currentTarget.querySelector('input');
                  window.location.href = `mailto:${text(settings, 'email')}?subject=Newsletter%20signup&body=Please%20add%20${encodeURIComponent(input?.value ?? '')}%20to%20your%20mailing%20list.`;
                }}
              >
                <input
                  type="email"
                  required
                  placeholder="Your email"
                  className="flex-1 h-10 px-4 bg-[#1a1a1a] border border-gold/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold rounded-none"
                />
                <button type="submit" className="h-10 px-4 bg-gold text-white text-xs tracking-wider hover:bg-gold-dark transition-colors rounded-none cursor-pointer">
                  Join
                </button>
              </form>

              {socials.length > 0 && (
                <div className="flex gap-4 mt-6">
                  {socials.map(({ key, url }) => {
                    const Icon = SOCIAL_ICONS[key] ?? Globe;
                    return (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={key.replace('Url', '')}
                        className="text-white/40 hover:text-gold transition-colors"
                      >
                        <Icon className="w-5 h-5" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-white/30">
            &copy; {year} {text(settings, 'copyrightName')}. All rights reserved.
          </p>
          <span className="flex items-center gap-4">
            <Link
              href="/erp"
              className="text-[10px] text-white/20 hover:text-white/40 tracking-widest uppercase transition-colors"
            >
              Staff Login
            </Link>
            <Link
              href="/admin"
              className="text-[10px] text-white/20 hover:text-white/40 tracking-widest uppercase transition-colors"
            >
              Admin Panel
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
