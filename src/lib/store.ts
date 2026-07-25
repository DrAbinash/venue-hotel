import { create } from 'zustand';
import { SETTING_DEFAULTS } from '@/lib/settings-schema';
import type { Booking, Floor, GalleryImage, HotelSettings, Room } from '@/lib/types';

export type View =
  | 'home'
  | 'rooms'
  | 'restaurant'
  | 'gallery'
  | 'contact'
  | 'booking'
  | 'my-booking'
  | 'admin';

export interface BookingForm {
  roomId: string | null;
  roomType: string;
  basePrice: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

interface HotelStore {
  view: View;
  setView: (view: View) => void;

  settings: HotelSettings;
  setSettings: (settings: HotelSettings) => void;

  rooms: Room[];
  setRooms: (rooms: Room[]) => void;

  floors: Floor[];
  setFloors: (floors: Floor[]) => void;

  bookings: Booking[];
  setBookings: (bookings: Booking[]) => void;

  gallery: GalleryImage[];
  setGallery: (gallery: GalleryImage[]) => void;

  bookingForm: BookingForm;
  setBookingForm: (patch: Partial<BookingForm>) => void;
  resetBookingForm: () => void;

  selectedRoom: Room | null;
  setSelectedRoom: (room: Room | null) => void;

  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  adminTab: string;
  setAdminTab: (tab: string) => void;

  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
}

/** Tomorrow and the day after, so the date pickers open on a usable range. */
function defaultDates(): { checkIn: string; checkOut: string } {
  const day = 86_400_000;
  const now = Date.now();
  return {
    checkIn: new Date(now + day).toISOString().slice(0, 10),
    checkOut: new Date(now + 2 * day).toISOString().slice(0, 10),
  };
}

const emptyBookingForm = (): BookingForm => ({
  roomId: null,
  roomType: '',
  basePrice: 0,
  ...defaultDates(),
  adults: 2,
  children: 0,
});

export const useHotelStore = create<HotelStore>((set) => ({
  view: 'home',
  setView: (view) => set({ view }),

  // Seeded with the shipped defaults so the first paint is never blank while
  // the real settings are still loading.
  settings: { ...SETTING_DEFAULTS },
  setSettings: (settings) => set({ settings: { ...SETTING_DEFAULTS, ...settings } }),

  rooms: [],
  setRooms: (rooms) => set({ rooms }),

  floors: [],
  setFloors: (floors) => set({ floors }),

  bookings: [],
  setBookings: (bookings) => set({ bookings }),

  gallery: [],
  setGallery: (gallery) => set({ gallery }),

  bookingForm: emptyBookingForm(),
  setBookingForm: (patch) => set((state) => ({ bookingForm: { ...state.bookingForm, ...patch } })),
  resetBookingForm: () => set({ bookingForm: emptyBookingForm(), selectedRoom: null }),

  selectedRoom: null,
  setSelectedRoom: (selectedRoom) => set({ selectedRoom }),

  mobileMenuOpen: false,
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),

  adminTab: 'dashboard',
  setAdminTab: (adminTab) => set({ adminTab }),

  isAdmin: false,
  setIsAdmin: (isAdmin) => set({ isAdmin }),
}));
