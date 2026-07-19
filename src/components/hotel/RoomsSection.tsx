'use client';

import { useHotelStore } from '@/lib/store';
import { BedDouble, Maximize, Users, Star, ChevronRight, Wifi, Car, Coffee, Waves, Dumbbell, UtensilsCrossed, ConciergeBell, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const amenityIcons: Record<string, React.ReactNode> = {
  'Free WiFi': <Wifi className="w-4 h-4" />,
  'Air Conditioning': <Wind className="w-4 h-4" />,
  'Mini Bar': <Coffee className="w-4 h-4" />,
  'Room Service': <ConciergeBell className="w-4 h-4" />,
  'Flat Screen TV': <Star className="w-4 h-4" />,
  'Safe': <Star className="w-4 h-4" />,
  'Balcony': <Star className="w-4 h-4" />,
  'Bathtub': <Waves className="w-4 h-4" />,
  'Living Area': <Star className="w-4 h-4" />,
  'Dining Area': <UtensilsCrossed className="w-4 h-4" />,
  'Butler Service': <ConciergeBell className="w-4 h-4" />,
  'Airport Transfer': <Car className="w-4 h-4" />,
  'Jacuzzi': <Waves className="w-4 h-4" />,
  'Fitness Center': <Dumbbell className="w-4 h-4" />,
};

const roomPhotos: Record<string, string> = {
  'Deluxe Room': 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80',
  'Superior Room': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',
  'Premium Suite': 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80',
  'Royal Suite': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',
};

export default function RoomsSection() {
  const { rooms, setView, setSelectedRoom, bookingForm, setBookingForm, settings } = useHotelStore();

  const uniqueTypes = rooms.reduce((acc: Record<string, typeof rooms[0]>, room) => {
    if (!acc[room.type]) acc[room.type] = room;
    return acc;
  }, {});

  const roomList = Object.values(uniqueTypes);

  const handleBookRoom = (room: typeof rooms[0]) => {
    setSelectedRoom(room);
    setBookingForm({
      roomType: room.type,
      roomId: room.id,
      basePrice: room.basePrice,
    });
    setView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="py-20 md:py-28 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs tracking-[0.5em] uppercase mb-3" style={{ color: '#c9a96e' }}>
            Accommodations
          </p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wide text-charcoal mb-4">
            Rooms &amp; Suites
          </h2>
          <div className="w-16 h-[1px] bg-gold mx-auto mb-6" />
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Each of our meticulously designed rooms and suites offers a sanctuary of comfort,
            blending contemporary elegance with timeless luxury for an unforgettable stay.
          </p>
        </motion.div>

        {/* Room Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {roomList.map((room, idx) => {
            const amenities: string[] = JSON.parse(room.amenities);
            const images: string[] = JSON.parse(room.images);
            const displayImage = images[0] || roomPhotos[room.type] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80';

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="group bg-white overflow-hidden luxury-shadow hover:luxury-shadow-lg transition-all duration-500"
              >
                <div className="relative h-64 md:h-72 overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{ backgroundImage: `url(${displayImage})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute top-4 left-4 bg-gold text-white text-xs tracking-widest uppercase px-4 py-1.5">
                    {room.type}
                  </div>
                  <div className="absolute bottom-4 right-4 text-white text-2xl font-light">
                    ${room.basePrice}
                    <span className="text-sm text-white/80"> / night</span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
                    {room.bedType && (
                      <span className="flex items-center gap-1.5">
                        <BedDouble className="w-4 h-4" /> {room.bedType}
                      </span>
                    )}
                    {room.size && (
                      <span className="flex items-center gap-1.5">
                        <Maximize className="w-4 h-4" /> {room.size}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" /> {room.maxGuests} Guests
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                    {room.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-5">
                    {amenities.slice(0, 4).map((a) => (
                      <span
                        key={a}
                        className="flex items-center gap-1 text-xs text-muted-foreground bg-cream/60 px-2.5 py-1"
                      >
                        {amenityIcons[a] || <Star className="w-3 h-3" />}
                        {a}
                      </span>
                    ))}
                    {amenities.length > 4 && (
                      <span className="text-xs text-gold px-2.5 py-1">
                        +{amenities.length - 4} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-light text-charcoal">${room.basePrice}</span>
                      <span className="text-sm text-muted-foreground"> / night</span>
                    </div>
                    <Button
                      onClick={() => handleBookRoom(room)}
                      className="bg-gold hover:bg-gold-dark text-white text-xs tracking-widest uppercase px-6 py-2.5 rounded-none transition-all duration-300 group/btn"
                    >
                      Book Now
                      <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}