'use client';

import { motion } from 'framer-motion';
import { useHotelStore } from '@/lib/store';
import { list, text } from '@/lib/content';

interface ExperienceItem {
  image: string;
  title: string;
  description: string;
}

/**
 * Signature experiences, the way the great hotels sell a stay: not a list of
 * facilities but a handful of moments. Content is a JSON list in settings and
 * the section disappears when the list is emptied.
 */
export default function ExperiencesSection() {
  const { settings } = useHotelStore();
  const experiences = list<ExperienceItem>(settings, 'experiencesList').filter((item) => item?.title);

  if (experiences.length === 0) return null;

  return (
    <section className="py-20 md:py-28 bg-cream/40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-xs tracking-[0.5em] uppercase text-gold mb-3">{text(settings, 'experiencesEyebrow')}</p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal mb-4">
            {text(settings, 'experiencesTitle')}
          </h2>
          <div className="w-16 h-[1px] bg-gold mx-auto mb-6" />
          <p className="text-muted-foreground max-w-2xl mx-auto">{text(settings, 'experiencesSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {experiences.map((experience, index) => (
            <motion.article
              key={`${experience.title}-${index}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
              className="group bg-white border border-gold/10 overflow-hidden"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-cream">
                {experience.image && (
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundImage: `url(${experience.image})` }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-light tracking-wide text-charcoal mb-2">{experience.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{experience.description}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
