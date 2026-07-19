import { create } from 'zustand';
import type { HotelSettings, Room, Floor, Booking, GalleryImage } from '@/lib/types';

type View = 'home' | 'rooms' | 'gallery' | 'contact' | 'booking' | 'admin';

interface HotelStore {
  view: View;
  setView: (v: View) => void;

  settings: HotelSettings;
  setSettings: (s: HotelSettings) => void;

  rooms: Room[];
  setRooms: (r: Room[]) => void;

  floors: Floor[];
  setFloors: (f: Floor[]) => void;

  bookings: Booking[];
  setBookings: (b: Booking[]) => void;

  gallery: GalleryImage[];
  setGallery: (g: GalleryImage[]) => void;

  bookingForm: {
    roomType: string;
    roomId: string | null;
    basePrice: number;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
  };
  setBookingForm: (f: Partial<HotelStore['bookingForm']>) => void;

  selectedRoom: Room | null;
  setSelectedRoom: (r: Room | null) => void;

  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;

  adminTab: string;
  setAdminTab: (t: string) => void;
}

export const useHotelStore = create<HotelStore>((set) => ({
  view: 'home',
  setView: (view) => set({ view }),

  settings: {
    hotelName: 'The Venue',
    tagline: 'Where Luxury Meets Legacy',
    address: '42 Heritage Lane, City Center',
    city: 'Metropolis',
    phone: '+1 (555) 234-5678',
    email: 'reservations@thevenue.com',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    description: '',
    heroSubtitle: 'Experience the pinnacle of luxury hospitality',
  },
  setSettings: (settings) => set({ settings }),

  rooms: [],
  setRooms: (rooms) => set({ rooms }),

  floors: [],
  setFloors: (floors) => set({ floors }),

  bookings: [],
  setBookings: (bookings) => set({ bookings }),

  gallery: [],
  setGallery: (gallery) => set({ gallery }),

  bookingForm: {
    roomType: '',
    roomId: null,
    basePrice: 0,
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0,
  },
  setBookingForm: (f) =>
    set((state) => ({ bookingForm: { ...state.bookingForm, ...f } })),

  selectedRoom: null,
  setSelectedRoom: (selectedRoom) => set({ selectedRoom }),

  mobileMenuOpen: false,
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),

  adminTab: 'rooms',
  setAdminTab: (adminTab) => set({ adminTab }),
}));