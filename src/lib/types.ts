export interface HotelSettings {
  hotelName: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  checkInTime: string;
  checkOutTime: string;
  description: string;
  heroSubtitle: string;
  [key: string]: string;
}

export interface Floor {
  id: string;
  name: string;
  number: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  rooms: Room[];
}

export interface Room {
  id: string;
  name: string;
  roomNumber: string;
  floorId: string;
  floor?: Floor;
  type: string;
  basePrice: number;
  maxGuests: number;
  bedType: string | null;
  size: string | null;
  description: string;
  amenities: string;
  images: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Booking {
  id: string;
  bookingRef: string;
  roomId: string | null;
  room?: Room;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomType: string;
  totalAmount: number;
  status: string;
  specialRequests: string | null;
  createdAt: string;
}

export interface GalleryImage {
  id: string;
  category: string;
  url: string;
  caption: string | null;
  sortOrder: number;
  isActive: boolean;
}