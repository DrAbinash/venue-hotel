import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GROUP_OF_KEY, SETTING_DEFAULTS } from '@/lib/settings-schema';
import { healMissingTables, isMissingTableError } from '@/lib/ensure-schema';

export const dynamic = 'force-dynamic';

/**
 * First-boot seed.
 *
 * Safe to call on every boot and every page load. Each section — settings,
 * floors, rooms, gallery, menu — is filled in only when that section is empty,
 * so real content is never overwritten and a release that introduces new
 * content still reaches a database seeded by an earlier release.
 */
export async function GET() {
  try {
    return NextResponse.json(await runSeed());
  } catch (error) {
    // A database created by an older release may be missing whole tables.
    // Push the schema and run the same seed again before giving up.
    if (isMissingTableError(error) && (await healMissingTables())) {
      try {
        return NextResponse.json(await runSeed());
      } catch (retryError) {
        console.error('Seed failed after schema heal:', retryError);
        const message = retryError instanceof Error ? retryError.message : 'Seed failed';
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    console.error('Seed error:', error);
    const message = error instanceof Error ? error.message : 'Seed failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runSeed(): Promise<{ message: string; created: string[] }> {
  {
    const created: string[] = [];

    // ---- Settings: fill in any key that does not exist yet. ----
    const existingSettings = await db.hotelSetting.findMany({ select: { key: true } });
    const known = new Set(existingSettings.map((s) => s.key));
    let newSettings = 0;
    for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
      if (known.has(key)) continue;
      await db.hotelSetting.create({ data: { key, value, group: GROUP_OF_KEY[key] ?? 'general' } });
      newSettings += 1;
    }
    if (newSettings) created.push(`${newSettings} settings`);

    // Every block below is guarded on its own emptiness rather than on one
    // shared "already seeded" gate. A single gate keyed off the room count
    // meant an installation created before a later release — the restaurant,
    // say — could never receive that release's content: rooms existed, so the
    // seed returned early and the menu below was never reached.

    // ---- Floors ----
    const floorSpecs = [
      { name: 'Ground Floor', number: 1, description: 'Lobby, restaurant and garden-facing rooms.' },
      { name: 'First Floor', number: 2, description: 'City-view rooms and the club lounge.' },
      { name: 'Second Floor', number: 3, description: 'Suites with private terraces.' },
      { name: 'Third Floor — Premium', number: 4, description: 'Signature suites and the rooftop pool.' },
    ];
    const floors: { id: string; name: string; number: number }[] =
      await db.floor.findMany({ orderBy: { sortOrder: 'asc' } });
    if (floors.length === 0) {
      for (let i = 0; i < floorSpecs.length; i += 1) {
        floors.push(
          await db.floor.create({ data: { ...floorSpecs[i], sortOrder: i + 1 } }),
        );
      }
      created.push(`${floorSpecs.length} floors`);
    }

    // ---- Rooms (placeholder inventory — edit or replace from Admin → Rooms) ----
    if (floors.length > 0 && (await db.room.count()) === 0) {
      const roomSpecs = [
        {
          type: 'Deluxe Room', price: 7500, quantity: 12, guests: 2, extra: 1500, bed: 'King', size: '45 sqm',
          view: 'Garden View', floor: 0,
          amenities: ['Free WiFi', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Smart TV', 'In-room Safe', 'Rain Shower'],
          images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80'],
        },
        {
          type: 'Superior Room', price: 10500, quantity: 8, guests: 3, extra: 1500, bed: 'King', size: '55 sqm',
          view: 'City View', floor: 1,
          amenities: ['Free WiFi', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Smart TV', 'In-room Safe', 'Balcony', 'Bathtub', 'Espresso Machine'],
          images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80'],
        },
        {
          type: 'Premium Suite', price: 18500, quantity: 5, guests: 4, extra: 2500, bed: 'King', size: '85 sqm',
          view: 'Skyline View', floor: 2,
          amenities: ['Free WiFi', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Smart TV', 'In-room Safe', 'Private Balcony', 'Bathtub', 'Living Area', 'Dining Area', 'Club Lounge Access'],
          images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'],
        },
        {
          type: 'Royal Suite', price: 32000, quantity: 2, guests: 4, extra: 3500, bed: 'King', size: '120 sqm',
          view: 'Panoramic View', floor: 3,
          amenities: ['Free WiFi', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Smart TV', 'In-room Safe', 'Private Terrace', 'Jacuzzi', 'Living Area', 'Dining Area', 'Butler Service', 'Airport Transfer'],
          images: ['https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200&q=80'],
        },
      ];

      for (let i = 0; i < roomSpecs.length; i += 1) {
        const spec = roomSpecs[i];
        // An existing install may carry its own floors, so fall back rather than
        // indexing off the end of a shorter list.
        const floor = floors[spec.floor] ?? floors[floors.length - 1];
        const roomNumber = `${floor.number}0${i + 1}`;
        await db.room.create({
          data: {
            name: spec.type,
            roomNumber,
            floorId: floor.id,
            type: spec.type,
            basePrice: spec.price,
            quantity: spec.quantity,
            maxGuests: spec.guests,
            extraGuestFee: spec.extra,
            bedType: spec.bed,
            size: spec.size,
            view: spec.view,
            isFeatured: i >= 2,
            description: `${spec.type} — ${spec.size} of considered comfort on the ${floor.name}. A ${spec.bed.toLowerCase()} bed, a marble bathroom and a ${spec.view.toLowerCase()} that earns its name.`,
            amenities: JSON.stringify(spec.amenities),
            images: JSON.stringify(spec.images),
            sortOrder: i + 1,
          },
        });
      }
      created.push(`${roomSpecs.length} rooms`);
    }

    // ---- Gallery placeholders ----
    if ((await db.galleryImage.count()) === 0) {
      const galleryItems = [
        { category: 'rooms', caption: 'Deluxe Room', url: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80' },
        { category: 'rooms', caption: 'Suite Living Area', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80' },
        { category: 'rooms', caption: 'Royal Suite Bedroom', url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200&q=80' },
        { category: 'dining', caption: 'The Restaurant', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80' },
        { category: 'dining', caption: 'Rooftop Bar', url: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200&q=80' },
        { category: 'dining', caption: 'Breakfast Service', url: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1200&q=80' },
        { category: 'amenities', caption: 'Infinity Pool', url: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&q=80' },
        { category: 'amenities', caption: 'The Spa', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80' },
        { category: 'amenities', caption: 'Fitness Centre', url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80' },
        { category: 'exterior', caption: 'The Facade', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80' },
        { category: 'exterior', caption: 'Grand Lobby', url: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80' },
        { category: 'exterior', caption: 'Garden Terrace', url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80' },
        { category: 'events', caption: 'Banquet Hall', url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80' },
        { category: 'events', caption: 'Conference Room', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80' },
        { category: 'events', caption: 'Rooftop Celebration', url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200&q=80' },
      ];
      for (let i = 0; i < galleryItems.length; i += 1) {
        await db.galleryImage.create({ data: { ...galleryItems[i], sortOrder: i + 1 } });
      }
      created.push(`${galleryItems.length} gallery images`);
    }

    // ---- Restaurant menu (placeholder — edit from Admin → Menu) ----
    if ((await db.menuCategory.count()) === 0) {
      interface SeedDish {
        name: string; price: number; veg: boolean; desc: string;
        kcal?: number; spice?: number; best?: boolean; image?: string;
      }
      interface SeedGroup {
        name: string; icon: string; description: string;
        sizes?: { label: string; priceDelta: number }[];
        addons?: { label: string; price: number }[];
        items: SeedDish[];
      }
      const menu: SeedGroup[] = [
        {
          name: 'Breakfast', icon: 'coffee', description: 'Served until 11:30 every morning.',
          items: [
            { name: 'Masala Omelette', price: 320, veg: false, desc: 'Three eggs, green chilli, coriander, buttered toast.', kcal: 480, image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80' },
            { name: 'Buttermilk Pancakes', price: 380, veg: true, desc: 'Maple syrup, whipped butter, seasonal berries.', kcal: 620, best: true, image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80' },
            { name: 'Poha', price: 240, veg: true, desc: 'Flattened rice, peanuts, curry leaf, lime.', kcal: 340, image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=800&q=80' },
          ],
        },
        {
          name: 'Burgers & Sandwiches', icon: 'sandwich', description: 'Griddled to order.',
          sizes: [
            { label: 'Single', priceDelta: 0 },
            { label: 'Double', priceDelta: 120 },
            { label: 'Triple', priceDelta: 220 },
          ],
          addons: [
            { label: 'Extra Cheese', price: 60 },
            { label: 'Smoked Bacon', price: 90 },
            { label: 'Jalapeños', price: 40 },
          ],
          items: [
            { name: 'The Venue Burger', price: 460, veg: false, desc: 'Aged beef patty, cheddar, house sauce, brioche.', kcal: 780, best: true, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80' },
            { name: 'Paneer Tikka Burger', price: 400, veg: true, desc: 'Char-grilled paneer, mint mayo, pickled onion.', kcal: 690, image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=800&q=80' },
            { name: 'Grilled Club Sandwich', price: 380, veg: false, desc: 'Chicken, egg, bacon, triple-decker, fries.', kcal: 720, image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80' },
          ],
        },
        {
          name: 'Pizza', icon: 'pizza', description: 'Stone-baked, thin crust.',
          sizes: [
            { label: 'Regular 7"', priceDelta: 0 },
            { label: 'Medium 10"', priceDelta: 180 },
            { label: 'Large 13"', priceDelta: 340 },
          ],
          addons: [
            { label: 'Extra Cheese', price: 80 },
            { label: 'Truffle Oil', price: 150 },
            { label: 'Chilli Flakes', price: 0 },
          ],
          items: [
            { name: 'Margherita', price: 420, veg: true, desc: 'San Marzano, fior di latte, basil.', kcal: 850, best: true, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80' },
            { name: 'Peri Peri Chicken', price: 520, veg: false, desc: 'Chicken, peppers, red onion, peri sauce.', kcal: 980, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80' },
          ],
        },
        {
          name: 'Mains', icon: 'utensils', description: 'From the main kitchen.',
          items: [
            { name: 'Butter Chicken', price: 620, veg: false, desc: 'Tandoori chicken, tomato and fenugreek gravy.', kcal: 740, spice: 2, best: true, image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80' },
            { name: 'Dal Makhani', price: 460, veg: true, desc: 'Black lentils, slow-cooked overnight.', kcal: 520, spice: 1, image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80' },
            { name: 'Grilled Sea Bass', price: 880, veg: false, desc: 'Lemon butter, charred asparagus, new potatoes.', kcal: 560, image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80' },
          ],
        },
        {
          name: 'Desserts', icon: 'cake', description: 'From our pastry section.',
          items: [
            { name: 'Molten Chocolate Cake', price: 340, veg: true, desc: 'Vanilla bean ice cream.', kcal: 610, best: true, image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800&q=80' },
            { name: 'Tiramisu', price: 320, veg: true, desc: 'Mascarpone, espresso, cocoa.', kcal: 480, image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80' },
          ],
        },
        {
          name: 'Drinks', icon: 'drink', description: 'Hot, cold and everything between.',
          sizes: [
            { label: 'Regular', priceDelta: 0 },
            { label: 'Large', priceDelta: 70 },
          ],
          items: [
            { name: 'Filter Coffee', price: 180, veg: true, desc: 'South Indian style, strong and sweet.', kcal: 90, image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80' },
            { name: 'Fresh Lime Soda', price: 160, veg: true, desc: 'Sweet, salted or mixed.', kcal: 70, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=80' },
            { name: 'Mango Lassi', price: 220, veg: true, desc: 'Alphonso mango, thick yoghurt, cardamom.', kcal: 260, best: true, image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800&q=80' },
          ],
        },
      ];

      for (let c = 0; c < menu.length; c += 1) {
        const group = menu[c];
        const category = await db.menuCategory.create({
          data: { name: group.name, icon: group.icon, description: group.description, sortOrder: c + 1 },
        });
        for (let i = 0; i < group.items.length; i += 1) {
          const item = group.items[i];
          await db.menuItem.create({
            data: {
              categoryId: category.id,
              name: item.name,
              description: item.desc,
              imageUrl: item.image,
              basePrice: item.price,
              sizes: JSON.stringify(group.sizes ?? []),
              addons: JSON.stringify(group.addons ?? []),
              isVeg: item.veg,
              spiceLevel: item.spice ?? 0,
              calories: item.kcal ?? null,
              prepMinutes: 20,
              isBestseller: item.best ?? false,
              sortOrder: i + 1,
            },
          });
        }
      }
      created.push(`${menu.length} menu categories`);
    }

    return {
      message: created.length ? 'Seeded' : 'Nothing to seed',
      created,
    };
  }
}
