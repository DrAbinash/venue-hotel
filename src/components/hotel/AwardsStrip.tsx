'use client';

import { Award } from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { list } from '@/lib/content';

interface AwardItem {
  title: string;
  subtitle: string;
}

/**
 * The slim recognition strip above the footer — the quiet trust signals
 * (awards, ratings, certifications) that luxury sites keep just before the
 * page ends. Hidden when the list is empty.
 */
export default function AwardsStrip() {
  const { settings } = useHotelStore();
  const awards = list<AwardItem>(settings, 'awardsList').filter((item) => item?.title);

  if (awards.length === 0) return null;

  return (
    <section className="bg-charcoal border-t border-gold/15">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div
          className="grid gap-8 text-center"
          style={{ gridTemplateColumns: `repeat(${Math.min(awards.length, 4)}, minmax(0, 1fr))` }}
        >
          {awards.map((award, index) => (
            <div key={`${award.title}-${index}`} className="text-white">
              <Award className="w-5 h-5 text-gold mx-auto mb-3" />
              <p className="text-sm tracking-wider">{award.title}</p>
              <p className="text-[11px] tracking-widest uppercase text-white/40 mt-1">{award.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
