'use client';

import { Wifi, Car, Waves, Coffee, Dumbbell, UtensilsCrossed, ConciergeBell, Shirt, Sparkles, Tv, Lock, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const amenities = [
  { icon: <Wifi className="w-8 h-8" />, title: 'High-Speed WiFi', desc: 'Complimentary high-speed internet access throughout the entire property, including all guest rooms and public areas.' },
  { icon: <Waves className="w-8 h-8" />, title: 'Infinity Pool', desc: 'Our rooftop infinity pool offers panoramic city views, perfect for a refreshing dip or sunset cocktails.' },
  { icon: <Coffee className="w-8 h-8" />, title: 'Gourmet Dining', desc: 'Experience culinary excellence at our three signature restaurants, each offering a unique gastronomic journey.' },
  { icon: <Dumbbell className="w-8 h-8" />, title: 'Fitness Center', desc: 'State-of-the-art fitness facility with personal trainers, open 24 hours for your convenience.' },
  { icon: <Sparkles className="w-8 h-8" />, title: 'Luxury Spa', desc: 'Indulge in our world-class spa treatments, featuring premium products and expert therapists.' },
  { icon: <Car className="w-8 h-8" />, title: 'Valet Parking', desc: 'Complimentary valet parking service with secure underground parking facility for all guests.' },
  { icon: <UtensilsCrossed className="w-8 h-8" />, title: 'Room Service', desc: '24-hour in-room dining with an extensive menu featuring local and international cuisine.' },
  { icon: <ConciergeBell className="w-8 h-8" />, title: 'Concierge', desc: 'Our dedicated concierge team is available around the clock to assist with reservations, tours, and special requests.' },
  { icon: <Shirt className="w-8 h-8" />, title: 'Laundry Service', desc: 'Professional laundry and dry cleaning services with same-day express options available.' },
  { icon: <Tv className="w-8 h-8" />, title: 'Smart TV', desc: 'Every room features a 55-inch smart TV with streaming services and premium movie channels.' },
  { icon: <Lock className="w-8 h-8" />, title: 'In-Room Safe', desc: 'Electronic in-room safe for your valuables and peace of mind during your stay.' },
  { icon: <Clock className="w-8 h-8" />, title: '24/7 Front Desk', desc: 'Our multilingual front desk team is always available to ensure your comfort and satisfaction.' },
];

export default function AmenitiesSection() {
  return (
    <section className="py-20 md:py-28 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs tracking-[0.5em] uppercase mb-3" style={{ color: '#c9a96e' }}>
            Hotel Facilities
          </p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal mb-4">
            Amenities &amp; Services
          </h2>
          <div className="w-16 h-[1px] bg-gold mx-auto mb-6" />
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Every detail has been thoughtfully curated to ensure your stay exceeds expectations.
            From world-class dining to rejuvenating spa treatments, we have it all.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {amenities.map((amenity, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="group p-6 bg-white border border-gold/10 hover:border-gold/30 transition-all duration-300 hover:luxury-shadow text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 text-gold group-hover:bg-cream group-hover:scale-110 transition-all duration-300 rounded-full bg-cream/50">
                {amenity.icon}
              </div>
              <h3 className="text-sm font-medium tracking-wider uppercase text-charcoal mb-2">
                {amenity.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {amenity.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}