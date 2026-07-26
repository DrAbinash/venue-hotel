'use client';

import { MessageCircle } from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { text } from '@/lib/content';

/**
 * The floating WhatsApp concierge — the "message us" door that luxury hotels
 * keep one tap away. Appears only when a WhatsApp number is configured, and
 * rides above the sticky order bar on the restaurant view so the two never
 * overlap.
 */
export default function ConciergeButton() {
  const { settings, view } = useHotelStore();

  const digits = text(settings, 'whatsapp').replace(/\D/g, '');
  if (!digits) return null;

  const message = encodeURIComponent(`Hello ${text(settings, 'hotelName')}, I would like some assistance.`);

  return (
    <a
      href={`https://wa.me/${digits}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with our concierge on WhatsApp"
      className={`fixed right-4 sm:right-6 z-40 w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#25D366] text-white
        flex items-center justify-center luxury-shadow-lg transition-all duration-300 hover:scale-105
        ${view === 'restaurant' ? 'bottom-24 sm:bottom-28' : 'bottom-5 sm:bottom-6'}`}
    >
      <MessageCircle className="w-6 h-6 fill-white" />
    </a>
  );
}
