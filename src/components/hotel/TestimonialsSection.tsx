'use client';

import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { list, text, type TestimonialItem } from '@/lib/content';

/** Guest quotes, authored in Admin → Content. An empty list hides the band. */
export default function TestimonialsSection() {
  const { settings } = useHotelStore();
  const testimonials = list<TestimonialItem>(settings, 'testimonialsList').filter((item) => item?.quote);

  if (!testimonials.length) return null;

  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-xs tracking-[0.5em] uppercase mb-3 text-gold">{text(settings, 'testimonialsEyebrow')}</p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal">
            {text(settings, 'testimonialsTitle')}
          </h2>
          <div className="w-16 h-[1px] bg-gold mx-auto mt-6" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.figure
              key={`${testimonial.name}-${index}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-cream/40 border border-gold/10 p-8 flex flex-col"
            >
              <Quote className="w-7 h-7 text-gold/40 mb-4" />
              <blockquote className="text-sm text-charcoal/80 leading-relaxed flex-1">
                “{testimonial.quote}”
              </blockquote>
              <div className="flex gap-0.5 mt-5">
                {Array.from({ length: Math.max(0, Math.min(5, Math.round(testimonial.rating ?? 5))) }).map((_, star) => (
                  <Star key={star} className="w-3.5 h-3.5 fill-gold text-gold" />
                ))}
              </div>
              <figcaption className="mt-3">
                <span className="block text-sm text-charcoal">{testimonial.name}</span>
                <span className="block text-xs text-muted-foreground">{testimonial.location}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
