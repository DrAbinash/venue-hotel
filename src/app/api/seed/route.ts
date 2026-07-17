import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const count = await db.room.count();
    if (count > 0) {
      return NextResponse.json({ message: 'Database already seeded', count });
    }

    // Create floors
    const floor1 = await db.floor.create({ data: { name: 'Ground Floor', number: 1, sortOrder: 1 } });
    const floor2 = await db.floor.create({ data: { name: 'First Floor', number: 2, sortOrder: 2 } });
    const floor3 = await db.floor.create({ data: { name: 'Second Floor', number: 3, sortOrder: 3 } });
    const floor4 = await db.floor.create({ data: { name: 'Third Floor - Premium', number: 4, sortOrder: 4 } });

    // Create rooms
    const roomTypes = [
      { type: 'Deluxe Room', price: 199, bed: 'King', size: '45 sqm', floor: floor1, amenities: ['Free WiFi', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Flat Screen TV', 'Safe'] },
      { type: 'Superior Room', price: 279, bed: 'King', size: '55 sqm', floor: floor2, amenities: ['Free WiFi', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Flat Screen TV', 'Safe', 'Balcony', 'Bathtub'] },
      { type: 'Premium Suite', price: 449, bed: 'King', size: '85 sqm', floor: floor3, amenities: ['Free WiFi', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Flat Screen TV', 'Safe', 'Balcony', 'Bathtub', 'Living Area', 'Dining Area'] },
      { type: 'Royal Suite', price: 799, bed: 'King', size: '120 sqm', floor: floor4, amenities: ['Free WiFi', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Flat Screen TV', 'Safe', 'Private Balcony', 'Jacuzzi', 'Living Area', 'Dining Area', 'Butler Service', 'Airport Transfer'] },
    ];

    for (let i = 0; i < roomTypes.length; i++) {
      const rt = roomTypes[i];
      const roomNum = `${rt.floor.number}${String(i + 1).padStart(2, '0')}`;
      await db.room.create({
        data: {
          name: `${rt.type} ${roomNum}`,
          roomNumber: roomNum,
          floorId: rt.floor.id,
          type: rt.type,
          basePrice: rt.price,
          maxGuests: i === 3 ? 4 : 2,
          bedType: rt.bed,
          size: rt.size,
          description: `${rt.type} offering luxurious comfort with modern amenities. Located on ${rt.floor.name}, this room provides a perfect blend of elegance and convenience for the discerning traveler. Enjoy breathtaking views and world-class hospitality.`,
          amenities: JSON.stringify(rt.amenities),
          images: JSON.stringify([]),
          sortOrder: i + 1,
        },
      });
    }

    // Create hotel settings
    const defaultSettings = [
      { key: 'hotelName', value: 'The Venue' },
      { key: 'tagline', value: 'Where Luxury Meets Legacy' },
      { key: 'address', value: '42 Heritage Lane, City Center' },
      { key: 'city', value: 'Metropolis' },
      { key: 'phone', value: '+1 (555) 234-5678' },
      { key: 'email', value: 'reservations@thevenue.com' },
      { key: 'checkInTime', value: '14:00' },
      { key: 'checkOutTime', value: '11:00' },
      { key: 'description', value: 'The Venue is a world-class luxury hotel offering an unparalleled experience of elegance, comfort, and sophistication. Nestled in the heart of the city, our hotel combines timeless charm with contemporary luxury to create unforgettable moments for every guest.' },
      { key: 'heroSubtitle', value: 'Experience the pinnacle of luxury hospitality' },
    ];
    for (const s of defaultSettings) {
      await db.hotelSetting.create({ data: s });
    }

    // Create sample gallery images
    const galleryCategories = ['rooms', 'dining', 'amenities', 'exterior', 'events'];
    const captions = [
      'Elegant Deluxe Room', 'Premium Suite Living Area', 'Royal Suite Bedroom',
      'Fine Dining Restaurant', 'Rooftop Bar', 'Breakfast Buffet',
      'Infinity Swimming Pool', 'Luxury Spa', 'Fitness Center',
      'Hotel Exterior View', 'Grand Lobby', 'Garden Terrace',
      'Wedding Reception Hall', 'Conference Room', 'Rooftop Event Space',
    ];
    for (let i = 0; i < captions.length; i++) {
      await db.galleryImage.create({
        data: {
          category: galleryCategories[i % galleryCategories.length],
          url: `/uploads/placeholder-${i + 1}.jpg`,
          caption: captions[i],
          sortOrder: i + 1,
        },
      });
    }

    return NextResponse.json({ message: 'Database seeded successfully', rooms: roomTypes.length, floors: 4, settings: defaultSettings.length });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}