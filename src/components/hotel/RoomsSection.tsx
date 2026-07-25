'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BedDouble, Check, Eye, Maximize, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/pricing';
import { jsonArray, roomImage, text } from '@/lib/content';
import type { Room } from '@/lib/types';

export default function RoomsSection() {
  const { rooms, settings, setView, setBookingForm, setSelectedRoom } = useHotelStore();
  const [preview, setPreview] = useState<Room | null>(null);

  const money = (value: number) => formatMoney(value, settings);

  const bookRoom = (room: Room) => {
    setSelectedRoom(room);
    setBookingForm({ roomId: room.id, roomType: room.type, basePrice: room.basePrice });
    setPreview(null);
    setView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-xs tracking-[0.5em] uppercase mb-3 text-gold">{text(settings, 'roomsEyebrow')}</p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal">{text(settings, 'roomsTitle')}</h2>
          <div className="w-16 h-[1px] bg-gold mx-auto my-6" />
          <p className="text-muted-foreground max-w-2xl mx-auto">{text(settings, 'roomsSubtitle')}</p>
        </div>

        {rooms.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Our rooms are being prepared. Please check back shortly.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.map((room, index) => {
              const amenities = jsonArray(room.amenities);
              return (
                <motion.article
                  key={room.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: (index % 3) * 0.1 }}
                  className="group bg-white border border-gold/10 overflow-hidden flex flex-col luxury-shadow hover:luxury-shadow-lg transition-shadow duration-500"
                >
                  <div className="relative h-60 overflow-hidden bg-cream">
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.2s] group-hover:scale-110"
                      style={{ backgroundImage: `url(${roomImage(room.images)})` }}
                    />
                    {room.isFeatured && (
                      <span className="absolute top-4 left-4 bg-gold text-white text-[10px] tracking-[0.2em] uppercase px-3 py-1.5">
                        Signature
                      </span>
                    )}
                    <button
                      onClick={() => setPreview(room)}
                      className="absolute inset-0 flex items-center justify-center bg-charcoal/0 group-hover:bg-charcoal/40 opacity-0 group-hover:opacity-100 transition-all duration-500 cursor-pointer"
                      aria-label={`View details for ${room.name}`}
                    >
                      <span className="flex items-center gap-2 text-white text-xs tracking-[0.3em] uppercase border border-white/60 px-5 py-2.5">
                        <Eye className="w-3.5 h-3.5" /> View Details
                      </span>
                    </button>
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-xl font-light tracking-wide text-charcoal">{room.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
                      {room.bedType && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {room.bedType}</span>}
                      {room.size && <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {room.size}</span>}
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {room.maxGuests} guests</span>
                    </div>

                    <p className="text-sm text-muted-foreground mt-4 leading-relaxed line-clamp-3 flex-1">{room.description}</p>

                    {amenities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {amenities.slice(0, 3).map((amenity) => (
                          <span key={amenity} className="text-[10px] tracking-wider uppercase bg-cream text-charcoal/60 px-2.5 py-1">
                            {amenity}
                          </span>
                        ))}
                        {amenities.length > 3 && (
                          <span className="text-[10px] tracking-wider uppercase text-gold px-1 py-1">
                            +{amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-end justify-between mt-6 pt-5 border-t border-gold/10">
                      <div>
                        <p className="text-2xl font-light text-charcoal">{money(room.basePrice)}</p>
                        <p className="text-[11px] text-muted-foreground">per night</p>
                      </div>
                      <Button
                        onClick={() => bookRoom(room)}
                        className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-6 py-2.5 rounded-none"
                      >
                        Book
                      </Button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-none border-gold/20">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-light tracking-wide text-charcoal">{preview.name}</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2">
                {(jsonArray(preview.images).length ? jsonArray(preview.images) : [roomImage(preview.images)])
                  .slice(0, 4)
                  .map((image, index) => (
                    <div key={index} className="aspect-[4/3] bg-cream bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
                  ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm py-4 border-y border-gold/10">
                {[
                  ['Bed', preview.bedType],
                  ['Size', preview.size],
                  ['View', preview.view],
                  ['Guests', `${preview.maxGuests}`],
                ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] tracking-widest uppercase text-muted-foreground">{label}</p>
                    <p className="text-charcoal mt-1">{value}</p>
                  </div>
                ))}
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{preview.description}</p>

              {jsonArray(preview.amenities).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {jsonArray(preview.amenities).map((amenity) => (
                    <span key={amenity} className="flex items-center gap-2 text-sm text-charcoal/70">
                      <Check className="w-3.5 h-3.5 text-gold flex-shrink-0" /> {amenity}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gold/10">
                <div>
                  <p className="text-2xl font-light text-charcoal">{money(preview.basePrice)}</p>
                  <p className="text-[11px] text-muted-foreground">per night</p>
                </div>
                <Button
                  onClick={() => bookRoom(preview)}
                  className="bg-gold hover:bg-gold-dark text-white text-xs tracking-[0.3em] uppercase px-8 py-3 rounded-none"
                >
                  Reserve This Room
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
