'use client';

import { motion } from 'framer-motion';
import { ArrowRight, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelStore } from '@/lib/store';
import { bool, list, text } from '@/lib/content';

interface DiningHighlight {
  title: string;
  description: string;
}

/**
 * The dining showcase on the home page.
 *
 * Every five-star property leads guests to its restaurants from the front
 * door; before this band existed the only path to the ordering page was a nav
 * link. Hidden automatically when both the restaurant and the cloud kitchen
 * are switched off.
 */
export default function DiningSection() {
  const { settings, setView } = useHotelStore();

  const restaurantOn = bool(settings, 'restaurantEnabled');
  const cloudOn = bool(settings, 'cloudKitchenEnabled');
  if (!restaurantOn && !cloudOn) return null;

  const highlights = list<DiningHighlight>(settings, 'diningHighlights').filter((item) => item?.title);

  const goToRestaurant = () => {
    setView('restaurant');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="py-20 md:py-28 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div
              className="aspect-[4/3] bg-cream bg-cover bg-center"
              style={{ backgroundImage: `url(${text(settings, 'diningImage')})` }}
            />
            <div className="absolute -bottom-5 -right-5 hidden sm:flex items-center gap-2 bg-charcoal text-white px-5 py-4">
              <ChefHat className="w-5 h-5 text-gold" />
              <div>
                <p className="text-xs tracking-widest uppercase text-gold">{text(settings, 'restaurantName')}</p>
                <p className="text-[11px] text-white/60">
                  {text(settings, 'restaurantOpenTime')} – {text(settings, 'restaurantCloseTime')} daily
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="text-xs tracking-[0.5em] uppercase text-gold mb-3">{text(settings, 'diningEyebrow')}</p>
            <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal mb-6">
              {text(settings, 'diningTitle')}
            </h2>
            <div className="w-16 h-[1px] bg-gold mb-8" />
            <p className="text-muted-foreground leading-relaxed mb-8">{text(settings, 'diningBody')}</p>

            {highlights.length > 0 && (
              <div className="space-y-5 mb-10">
                {highlights.map((highlight, index) => (
                  <div key={`${highlight.title}-${index}`} className="flex gap-4">
                    <span className="w-1.5 h-1.5 mt-2 bg-gold flex-shrink-0" />
                    <div>
                      <p className="text-sm tracking-wider uppercase text-charcoal">{highlight.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{highlight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={goToRestaurant}
              className="px-8 py-6 bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.3em] uppercase rounded-none"
            >
              {text(settings, 'diningCta')} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
