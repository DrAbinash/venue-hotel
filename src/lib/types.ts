import type { PriceBreakdown } from '@/lib/pricing';

/** Every value is a string because settings are stored as key/value pairs. */
export type HotelSettings = Record<string, string>;

export interface Floor {
  id: string;
  name: string;
  number: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  rooms?: Room[];
}

export interface Room {
  id: string;
  name: string;
  roomNumber: string;
  floorId: string;
  floor?: Floor;
  type: string;
  basePrice: number;
  quantity: number;
  maxGuests: number;
  extraGuestFee: number;
  bedType: string | null;
  size: string | null;
  view: string | null;
  description: string;
  /** JSON-encoded string[] */
  amenities: string;
  /** JSON-encoded string[] */
  images: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

/** A room as returned by /api/availability, with live inventory and a quote. */
export interface RoomAvailability extends Room {
  available: number;
  isAvailable: boolean;
  fitsGuests?: boolean;
  quote: PriceBreakdown | null;
}

export interface AvailabilityResponse {
  checkIn: string;
  checkOut: string;
  nights: number;
  datesValid: boolean;
  error?: string;
  rooms: RoomAvailability[];
}

export interface Payment {
  id: string;
  bookingId: string;
  gateway: string;
  mode: string;
  orderId: string | null;
  paymentId: string | null;
  referenceNo: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  errorMessage: string | null;
  createdAt: string;
  booking?: Pick<Booking, 'bookingRef' | 'guestName' | 'guestEmail' | 'totalAmount'> | null;
  order?: { orderRef: string; customerName: string; totalAmount: number } | null;
}

export interface Booking {
  id: string;
  bookingRef: string;
  roomId: string | null;
  room?: Room;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountry: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomType: string;
  currency: string;
  roomTotal: number;
  extraGuestTotal: number;
  feeAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  source: string;
  specialRequests: string | null;
  internalNotes: string | null;
  createdAt: string;
  payments?: Payment[];
}

export interface GalleryImage {
  id: string;
  category: string;
  url: string;
  caption: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface MediaAsset {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  folder: string;
  alt: string | null;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  basePrice: number;
  /** JSON-encoded MenuSize[] */
  sizes: string;
  /** JSON-encoded MenuAddon[] */
  addons: string;
  isVeg: boolean;
  spiceLevel: number;
  calories: number | null;
  prepMinutes: number;
  isAvailable: boolean;
  isBestseller: boolean;
  sortOrder: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  items: MenuItem[];
}

export interface FoodOrderItem {
  id: string;
  name: string;
  size: string | null;
  unitPrice: number;
  quantity: number;
  /** JSON-encoded MenuAddon[] */
  addons: string;
  lineTotal: number;
  notes: string | null;
}

export interface FoodOrder {
  id: string;
  orderRef: string;
  orderType: string;
  tableNumber: string | null;
  roomNumber: string | null;
  bookingRef: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string | null;
  currency: string;
  subtotal: number;
  packagingFee: number;
  deliveryFee: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  items: FoodOrderItem[];
  payments?: Payment[];
}

export type GatewayId = 'razorpay' | 'icici' | 'payAtHotel' | 'bankTransfer';

export interface PaymentMethodOption {
  id: GatewayId;
  label: string;
  description: string;
  online: boolean;
}

export interface PaymentConfig {
  enabled: boolean;
  mode: 'test' | 'live';
  currency: string;
  currencySymbol: string;
  currencyLocale: string;
  allowPartialPayment: boolean;
  advancePercent: number;
  methods: PaymentMethodOption[];
  razorpayKeyId: string;
  razorpayThemeColor: string;
  bank: {
    name: string;
    accountName: string;
    accountNumber: string;
    ifsc: string;
    upiId: string;
  };
  payAtHotelNote: string;
}
