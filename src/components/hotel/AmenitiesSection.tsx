'use client';

import { motion } from 'framer-motion';
import {
  Briefcase, Car, Coffee, ConciergeBell, Dumbbell, GlassWater, PawPrint, ParkingCircle,
  ShieldCheck, Shirt, Sparkles, Utensils, Waves, Wifi,
} from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { list, text, type AmenityItem } from '@/lib/content';

/**
 * Amenity cards are authored in Admin → Content as a JSON list. Each entry
 * names an icon from this set; an unknown name falls back to the sparkle so a
 * typo never breaks the grid.
 */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  waves: Waves,
  utensils: Utensils,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  wifi: Wifi,
  car: Car,
  concierge: ConciergeBell,
  glass: GlassWater,
  parking: ParkingCircle,
  laundry: Shirt,
  business: Briefcase,
  shield: ShieldCheck,
  pet: PawPrint,
  coffee: Coffee,
};

export default function AmenitiesSection() {
  const { settings } = useHotelStore();
  const amenities = list<AmenityItem>(settings, 'amenitiesList').filter((item) => item?.title);

  if (!amenities.length) return null;

  return (
    <section className="py-20 md:py-28 bg-cream/40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-xs tracking-[0.5em] uppercase mb-3 text-gold">{text(settings, 'amenitiesEyebrow')}</p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal">
            {text(settings, 'amenitiesTitle')}
          </h2>
          <div className="w-16 h-[1px] bg-gold mx-auto my-6" />
          <p className="text-muted-foreground max-w-2xl mx-auto">{text(settings, 'amenitiesSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gold/10">
          {amenities.map((amenity, index) => {
            const Icon = ICONS[amenity.icon] ?? Sparkles;
            return (
              <motion.div
                key={`${amenity.title}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: (index % 4) * 0.08 }}
                className="group bg-white p-8 hover:bg-charcoal transition-colors duration-500"
              >
                <Icon className="w-8 h-8 text-gold mb-5 transition-transform duration-500 group-hover:scale-110" />
                <h3 className="text-base tracking-wide text-charcoal group-hover:text-white transition-colors duration-500 mb-2">
                  {amenity.title}
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-white/60 transition-colors duration-500 leading-relaxed">
                  {amenity.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
