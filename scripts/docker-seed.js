const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    console.log('Seed: Connecting to database...');
    const count = await p.room.count();
    if (count > 0) {
      console.log('Seed: Database already has ' + count + ' rooms — skipping seed.');
      await p.$disconnect();
      return;
    }

    console.log('Seed: Database empty — seeding default data...');

    const f1 = await p.floor.create({ data: { name: 'Ground Floor', number: 1, sortOrder: 1 } });
    const f2 = await p.floor.create({ data: { name: 'First Floor', number: 2, sortOrder: 2 } });
    const f3 = await p.floor.create({ data: { name: 'Second Floor', number: 3, sortOrder: 3 } });
    const f4 = await p.floor.create({ data: { name: 'Third Floor - Premium', number: 4, sortOrder: 4 } });

    console.log('Seed: Created 4 floors.');

    const rooms = [
      { type: 'Deluxe Room', price: 199, bed: 'King', size: '45 sqm', floor: f1, guests: 2, amenities: ['Free WiFi','Air Conditioning','Mini Bar','Room Service','Flat Screen TV','Safe'] },
      { type: 'Superior Room', price: 279, bed: 'King', size: '55 sqm', floor: f2, guests: 2, amenities: ['Free WiFi','Air Conditioning','Mini Bar','Room Service','Flat Screen TV','Safe','Balcony','Bathtub'] },
      { type: 'Premium Suite', price: 449, bed: 'King', size: '85 sqm', floor: f3, guests: 2, amenities: ['Free WiFi','Air Conditioning','Mini Bar','Room Service','Flat Screen TV','Safe','Balcony','Bathtub','Living Area','Dining Area'] },
      { type: 'Royal Suite', price: 799, bed: 'King', size: '120 sqm', floor: f4, guests: 4, amenities: ['Free WiFi','Air Conditioning','Mini Bar','Room Service','Flat Screen TV','Safe','Private Balcony','Jacuzzi','Living Area','Dining Area','Butler Service','Airport Transfer'] },
    ];

    for (let i = 0; i < rooms.length; i++) {
      const rt = rooms[i];
      const num = String(rt.floor.number) + String(i + 1).padStart(2, '0');
      await p.room.create({
        data: {
          name: rt.type + ' ' + num,
          roomNumber: num,
          floorId: rt.floor.id,
          type: rt.type,
          basePrice: rt.price,
          maxGuests: rt.guests,
          bedType: rt.bed,
          size: rt.size,
          description: rt.type + ' offering luxurious comfort with modern amenities. Located on ' + rt.floor.name + '.',
          amenities: JSON.stringify(rt.amenities),
          images: '[]',
          sortOrder: i + 1,
        },
      });
      console.log('Seed: Created room ' + num);
    }

    const settings = [
      { key: 'hotelName', value: 'The Venue' },
      { key: 'tagline', value: 'Where Luxury Meets Legacy' },
      { key: 'address', value: '42 Heritage Lane, City Center' },
      { key: 'city', value: 'Metropolis' },
      { key: 'phone', value: '+1 (555) 234-5678' },
      { key: 'email', value: 'reservations@thevenue.com' },
      { key: 'checkInTime', value: '14:00' },
      { key: 'checkOutTime', value: '11:00' },
      { key: 'description', value: 'The Venue is a world-class luxury hotel offering an unparalleled experience of elegance, comfort, and sophistication.' },
      { key: 'heroSubtitle', value: 'Experience the pinnacle of luxury hospitality' },
    ];

    for (const s of settings) {
      await p.hotelSetting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
    }

    console.log('Seed: Complete! Created 4 rooms, 10 settings.');
  } catch (err) {
    console.error('Seed error:', err.message);
    console.error('Seed error stack:', err.stack);
  }
  await p.$disconnect();
})();
