/**
 * Single source of truth for every piece of editable site content.
 *
 * Every string you see on the public website comes from here — nothing is
 * hard-coded in a component. The admin panel renders its editors straight off
 * this schema, and the seeder writes these defaults on first boot, so adding a
 * new editable field is a one-line change in this file.
 *
 * All shipped values are placeholders. Replace them from Admin → Content.
 */

export type SettingType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'image'
  | 'imageList'
  | 'list'
  | 'json'
  | 'select'
  | 'secret'
  | 'color';

export interface SettingField {
  key: string;
  label: string;
  type: SettingType;
  default: string;
  help?: string;
  options?: string[];
  /** Never leaves the server in plaintext. */
  secret?: boolean;
  /** Hidden from the public settings endpoint (admin-only, non-secret). */
  private?: boolean;
}

export interface SettingGroup {
  key: string;
  label: string;
  description: string;
  /** Which admin tab renders this group. */
  section: 'content' | 'settings' | 'payments';
  fields: SettingField[];
}

export const SETTING_GROUPS: SettingGroup[] = [
  {
    key: 'brand',
    label: 'Brand & Identity',
    description: 'The hotel name and wordmark shown in the header, footer and browser tab.',
    section: 'settings',
    fields: [
      { key: 'hotelName', label: 'Hotel Name', type: 'text', default: 'The Venue' },
      { key: 'brandSuffix', label: 'Brand Sub-line', type: 'text', default: 'Hotel & Resort', help: 'Small caps line under the logo.' },
      { key: 'tagline', label: 'Tagline', type: 'text', default: 'Where Luxury Meets Legacy' },
      { key: 'logoUrl', label: 'Logo Image', type: 'image', default: '', help: 'Optional. Falls back to the text wordmark.' },
      { key: 'faviconUrl', label: 'Favicon', type: 'image', default: '/logo.svg' },
    ],
  },
  {
    key: 'contact',
    label: 'Contact & Location',
    description: 'Address, phone numbers and email used across the site.',
    section: 'settings',
    fields: [
      { key: 'address', label: 'Street Address', type: 'text', default: '42 Heritage Lane, City Center' },
      { key: 'city', label: 'City', type: 'text', default: 'Metropolis' },
      { key: 'state', label: 'State / Region', type: 'text', default: 'Maharashtra' },
      { key: 'postalCode', label: 'Postal Code', type: 'text', default: '400001' },
      { key: 'country', label: 'Country', type: 'text', default: 'India' },
      { key: 'phone', label: 'Primary Phone', type: 'text', default: '+91 98765 43210' },
      { key: 'phoneAlt', label: 'Reservations Phone', type: 'text', default: '+91 98765 43211' },
      { key: 'whatsapp', label: 'WhatsApp Number', type: 'text', default: '919876543210', help: 'Digits only, with country code. Leave blank to hide the WhatsApp button.' },
      { key: 'email', label: 'Reservations Email', type: 'text', default: 'reservations@thevenue.example' },
      { key: 'supportEmail', label: 'Support Email', type: 'text', default: 'care@thevenue.example' },
      { key: 'mapEmbedUrl', label: 'Google Maps Embed URL', type: 'text', default: '', help: 'The src of a Google Maps <iframe>. Leave blank to hide the map.' },
      { key: 'directionsUrl', label: 'Directions Link', type: 'text', default: '' },
    ],
  },
  {
    key: 'stay',
    label: 'Stay Policies',
    description: 'Check-in windows and the policies shown before a guest pays.',
    section: 'settings',
    fields: [
      { key: 'checkInTime', label: 'Check-in Time', type: 'text', default: '14:00' },
      { key: 'checkOutTime', label: 'Check-out Time', type: 'text', default: '11:00' },
      { key: 'cancellationPolicy', label: 'Cancellation Policy', type: 'textarea', default: 'Free cancellation up to 48 hours before check-in. Cancellations inside 48 hours are charged one night.' },
      { key: 'childPolicy', label: 'Children Policy', type: 'textarea', default: 'Children under 6 stay free when using existing bedding. Extra beds are available on request.' },
      { key: 'petPolicy', label: 'Pet Policy', type: 'textarea', default: 'Assistance animals are always welcome. Please contact reservations for other pets.' },
      { key: 'bookingTerms', label: 'Booking Terms', type: 'textarea', default: 'By confirming this reservation you agree to the hotel terms of stay, the cancellation policy and the processing of your details for this booking.' },
    ],
  },
  {
    key: 'money',
    label: 'Currency & Pricing',
    description: 'Currency, taxes and fees. These drive every price shown on the site.',
    section: 'payments',
    fields: [
      { key: 'currency', label: 'Currency Code', type: 'text', default: 'INR', help: 'ISO 4217, e.g. INR, USD, AED.' },
      { key: 'currencySymbol', label: 'Currency Symbol', type: 'text', default: '₹' },
      { key: 'currencyLocale', label: 'Number Locale', type: 'text', default: 'en-IN', help: 'Controls digit grouping, e.g. en-IN gives 1,20,000.' },
      { key: 'taxPercent', label: 'Tax %', type: 'number', default: '18', help: 'GST or equivalent, applied to the room total.' },
      { key: 'taxLabel', label: 'Tax Label', type: 'text', default: 'GST' },
      { key: 'serviceFeePercent', label: 'Service Fee %', type: 'number', default: '0' },
      { key: 'serviceFeeLabel', label: 'Service Fee Label', type: 'text', default: 'Service Fee' },
      { key: 'advancePercent', label: 'Advance Payment %', type: 'number', default: '25', help: 'Share of the total collected online when partial payment is allowed.' },
      { key: 'allowPartialPayment', label: 'Allow Partial (Advance) Payment', type: 'boolean', default: 'true' },
    ],
  },
  {
    key: 'booking',
    label: 'Booking Rules',
    description: 'Guard-rails applied to every online reservation.',
    section: 'settings',
    fields: [
      { key: 'minNights', label: 'Minimum Nights', type: 'number', default: '1' },
      { key: 'maxNights', label: 'Maximum Nights', type: 'number', default: '30' },
      { key: 'maxAdvanceDays', label: 'Book Up To (days ahead)', type: 'number', default: '365' },
      { key: 'maxAdults', label: 'Max Adults per Booking', type: 'number', default: '6' },
      { key: 'maxChildren', label: 'Max Children per Booking', type: 'number', default: '4' },
      { key: 'autoConfirmOnPayment', label: 'Auto-confirm on Successful Payment', type: 'boolean', default: 'true' },
    ],
  },
  {
    key: 'payments',
    label: 'Payment Gateways',
    description: 'Online payment providers. Secrets are stored server-side and are never sent to the browser.',
    section: 'payments',
    fields: [
      { key: 'paymentsEnabled', label: 'Enable Online Payments', type: 'boolean', default: 'true' },
      { key: 'paymentMode', label: 'Mode', type: 'select', default: 'test', options: ['test', 'live'], help: 'Use test until you have verified a live transaction.' },

      { key: 'razorpayEnabled', label: 'Razorpay — Enabled', type: 'boolean', default: 'false' },
      { key: 'razorpayLabel', label: 'Razorpay — Display Name', type: 'text', default: 'Cards, UPI, Net Banking & Wallets' },
      { key: 'razorpayKeyId', label: 'Razorpay — Key ID', type: 'text', default: '', help: 'rzp_test_xxx or rzp_live_xxx. Safe to expose in the browser.', private: true },
      { key: 'razorpayKeySecret', label: 'Razorpay — Key Secret', type: 'secret', default: '', secret: true },
      { key: 'razorpayWebhookSecret', label: 'Razorpay — Webhook Secret', type: 'secret', default: '', secret: true, help: 'Set the same value in the Razorpay dashboard webhook for /api/payments/razorpay/webhook.' },
      { key: 'razorpayThemeColor', label: 'Razorpay — Checkout Colour', type: 'color', default: '#c9a96e' },

      { key: 'iciciEnabled', label: 'ICICI Eazypay — Enabled', type: 'boolean', default: 'false' },
      { key: 'iciciLabel', label: 'ICICI Eazypay — Display Name', type: 'text', default: 'ICICI Bank Payment Gateway' },
      { key: 'iciciMerchantId', label: 'ICICI — Merchant ID', type: 'text', default: '', private: true },
      { key: 'iciciSubMerchantId', label: 'ICICI — Sub Merchant ID', type: 'text', default: '', private: true },
      { key: 'iciciEncryptionKey', label: 'ICICI — Encryption Key', type: 'secret', default: '', secret: true, help: '16-character AES key issued by ICICI Bank.' },
      { key: 'iciciEndpoint', label: 'ICICI — Payment URL', type: 'text', default: 'https://eazypay.icicibank.com/EazyPG', private: true },
      { key: 'iciciPaymode', label: 'ICICI — Paymode', type: 'text', default: '9', private: true, help: '9 = show all payment options on the ICICI page.' },
      { key: 'iciciRefPrefix', label: 'ICICI — Reference Prefix', type: 'text', default: 'TV', private: true },

      { key: 'payAtHotelEnabled', label: 'Pay at Hotel — Enabled', type: 'boolean', default: 'true' },
      { key: 'payAtHotelLabel', label: 'Pay at Hotel — Display Name', type: 'text', default: 'Pay at the Hotel' },
      { key: 'payAtHotelNote', label: 'Pay at Hotel — Note', type: 'textarea', default: 'Reserve now and settle the full amount at check-in. We will hold your room until 6 PM on the arrival date.' },

      { key: 'bankTransferEnabled', label: 'Bank Transfer — Enabled', type: 'boolean', default: 'false' },
      { key: 'bankTransferLabel', label: 'Bank Transfer — Display Name', type: 'text', default: 'Direct Bank Transfer / UPI' },
      { key: 'bankName', label: 'Bank Name', type: 'text', default: 'ICICI Bank' },
      { key: 'bankAccountName', label: 'Account Name', type: 'text', default: 'The Venue Hotels Pvt Ltd' },
      { key: 'bankAccountNumber', label: 'Account Number', type: 'text', default: '000000000000' },
      { key: 'bankIfsc', label: 'IFSC Code', type: 'text', default: 'ICIC0000000' },
      { key: 'bankUpiId', label: 'UPI ID', type: 'text', default: 'thevenue@icici' },
    ],
  },
  {
    key: 'restaurant',
    label: 'Restaurant & Ordering',
    description: 'The in-house restaurant, its online ordering rules and fees.',
    section: 'settings',
    fields: [
      { key: 'restaurantEnabled', label: 'Enable Restaurant Module', type: 'boolean', default: 'true' },
      { key: 'restaurantName', label: 'Restaurant Name', type: 'text', default: 'Saffron & Sage' },
      { key: 'restaurantTagline', label: 'Tagline', type: 'text', default: 'All-day dining, delivered to your table or your door' },
      { key: 'restaurantEyebrow', label: 'Eyebrow', type: 'text', default: 'Order Online' },
      { key: 'restaurantHeroImage', label: 'Header Image', type: 'image', default: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80' },
      { key: 'restaurantOpenTime', label: 'Kitchen Opens', type: 'text', default: '07:00' },
      { key: 'restaurantCloseTime', label: 'Kitchen Closes', type: 'text', default: '23:00' },
      { key: 'restaurantPrepNote', label: 'Preparation Note', type: 'text', default: 'Most orders are ready in 20–30 minutes.' },

      { key: 'orderDineInEnabled', label: 'Allow Dine-in Orders', type: 'boolean', default: 'true' },
      { key: 'orderRoomServiceEnabled', label: 'Allow Room Service', type: 'boolean', default: 'true' },
      { key: 'orderTakeawayEnabled', label: 'Allow Takeaway', type: 'boolean', default: 'true' },
      { key: 'orderDeliveryEnabled', label: 'Allow Delivery', type: 'boolean', default: 'false' },

      { key: 'foodTaxPercent', label: 'Food Tax %', type: 'number', default: '5', help: 'GST on food and beverages.' },
      { key: 'packagingFee', label: 'Packaging Fee', type: 'number', default: '20', help: 'Charged on takeaway and delivery orders.' },
      { key: 'deliveryFee', label: 'Delivery Fee', type: 'number', default: '60' },
      { key: 'roomServiceFee', label: 'Room Service Charge', type: 'number', default: '0' },
      { key: 'minOrderValue', label: 'Minimum Order Value', type: 'number', default: '0' },
      { key: 'orderPayAtCounterEnabled', label: 'Allow Pay on Delivery / at Counter', type: 'boolean', default: 'true' },
      { key: 'orderChargeToRoomEnabled', label: 'Allow Charge to Room', type: 'boolean', default: 'true', help: 'Guests can add the bill to their room folio using a booking reference.' },
    ],
  },
  {
    key: 'hero',
    label: 'Hero Section',
    description: 'The full-screen opening of the home page.',
    section: 'content',
    fields: [
      { key: 'heroEyebrow', label: 'Eyebrow Text', type: 'text', default: 'Welcome to' },
      { key: 'heroSubtitle', label: 'Subtitle', type: 'text', default: 'Experience the pinnacle of luxury hospitality' },
      { key: 'heroPrimaryCta', label: 'Primary Button', type: 'text', default: 'Reserve Your Stay' },
      { key: 'heroSecondaryCta', label: 'Secondary Button', type: 'text', default: 'Explore Rooms' },
      { key: 'heroStars', label: 'Star Rating', type: 'number', default: '5' },
      {
        key: 'heroImages',
        label: 'Background Slides',
        type: 'imageList',
        default: JSON.stringify([
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1920&q=80',
          'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1920&q=80',
        ]),
      },
      { key: 'heroSlideSeconds', label: 'Slide Duration (seconds)', type: 'number', default: '6' },
    ],
  },
  {
    key: 'story',
    label: 'Story Band',
    description: 'The dark "our story" band with the headline statistics.',
    section: 'content',
    fields: [
      { key: 'storyEyebrow', label: 'Eyebrow', type: 'text', default: 'Our Story' },
      { key: 'storyTitle', label: 'Heading', type: 'text', default: 'A Legacy of Luxury' },
      {
        key: 'storyBody',
        label: 'Body Copy',
        type: 'textarea',
        default:
          'Nestled in the heart of the city, our hotel stands as a beacon of refined hospitality, where every detail is curated to create moments of pure indulgence. From exquisitely appointed rooms to world-class dining and wellness facilities, every aspect of your stay is designed to exceed expectations.',
      },
      { key: 'storyImage', label: 'Background Image', type: 'image', default: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1920&q=80' },
      {
        key: 'storyStats',
        label: 'Statistics',
        type: 'json',
        default: JSON.stringify([
          { value: '15+', label: 'Years of Excellence' },
          { value: '50K+', label: 'Happy Guests' },
          { value: '4.9', label: 'Guest Rating' },
        ]),
        help: 'A list of { "value", "label" } pairs.',
      },
    ],
  },
  {
    key: 'roomsSection',
    label: 'Rooms Section',
    description: 'Headings for the rooms and suites listing.',
    section: 'content',
    fields: [
      { key: 'roomsEyebrow', label: 'Eyebrow', type: 'text', default: 'Accommodation' },
      { key: 'roomsTitle', label: 'Heading', type: 'text', default: 'Rooms & Suites' },
      { key: 'roomsSubtitle', label: 'Sub-heading', type: 'textarea', default: 'Each room is a private retreat, appointed with considered detail and the quiet comfort of a home.' },
    ],
  },
  {
    key: 'amenities',
    label: 'Amenities',
    description: 'The amenity grid. Icons come from a fixed illustrated set.',
    section: 'content',
    fields: [
      { key: 'amenitiesEyebrow', label: 'Eyebrow', type: 'text', default: 'Facilities' },
      { key: 'amenitiesTitle', label: 'Heading', type: 'text', default: 'World-Class Amenities' },
      { key: 'amenitiesSubtitle', label: 'Sub-heading', type: 'textarea', default: 'Everything you need for a flawless stay, and a few things you did not know you needed.' },
      {
        key: 'amenitiesList',
        label: 'Amenity Cards',
        type: 'json',
        default: JSON.stringify([
          { icon: 'waves', title: 'Infinity Pool', description: 'A temperature-controlled rooftop pool with a skyline view.' },
          { icon: 'utensils', title: 'Fine Dining', description: 'Three restaurants led by an award-winning kitchen brigade.' },
          { icon: 'dumbbell', title: 'Fitness Centre', description: 'Technogym equipment and personal trainers, open around the clock.' },
          { icon: 'sparkles', title: 'Luxury Spa', description: 'Six treatment suites, a hammam and a signature ritual menu.' },
          { icon: 'wifi', title: 'Gigabit Wi-Fi', description: 'Complimentary high-speed internet in every corner of the property.' },
          { icon: 'car', title: 'Airport Transfer', description: 'Chauffeured arrivals and departures in a luxury sedan.' },
          { icon: 'concierge', title: '24/7 Concierge', description: 'Reservations, tickets and impossible requests, handled.' },
          { icon: 'glass', title: 'Rooftop Bar', description: 'Rare spirits and a cocktail list that changes with the season.' },
        ]),
        help: 'Icons: waves, utensils, dumbbell, sparkles, wifi, car, concierge, glass, parking, laundry, business, shield, pet, coffee.',
      },
    ],
  },
  {
    key: 'gallery',
    label: 'Gallery Section',
    description: 'Headings and category chips for the photo gallery.',
    section: 'content',
    fields: [
      { key: 'galleryEyebrow', label: 'Eyebrow', type: 'text', default: 'Gallery' },
      { key: 'galleryTitle', label: 'Heading', type: 'text', default: 'A Glimpse of The Venue' },
      { key: 'gallerySubtitle', label: 'Sub-heading', type: 'textarea', default: 'Spaces made for slowing down.' },
      { key: 'galleryCategories', label: 'Categories', type: 'list', default: JSON.stringify(['rooms', 'dining', 'amenities', 'exterior', 'events']) },
    ],
  },
  {
    key: 'testimonials',
    label: 'Guest Reviews',
    description: 'Quotes shown in the reviews band. Set to an empty list to hide the section.',
    section: 'content',
    fields: [
      { key: 'testimonialsEyebrow', label: 'Eyebrow', type: 'text', default: 'Guest Stories' },
      { key: 'testimonialsTitle', label: 'Heading', type: 'text', default: 'What Our Guests Say' },
      {
        key: 'testimonialsList',
        label: 'Reviews',
        type: 'json',
        default: JSON.stringify([
          { name: 'Ananya Rao', location: 'Bengaluru, India', rating: 5, quote: 'The most attentive service we have had anywhere. The suite was immaculate and the rooftop dinner was the highlight of our trip.' },
          { name: 'Marcus Feld', location: 'Berlin, Germany', rating: 5, quote: 'Booked late at night and was upgraded on arrival without asking. Everything from check-in to the spa felt effortless.' },
          { name: 'Sofia Marchetti', location: 'Milan, Italy', rating: 5, quote: 'Beautiful interiors, but it is the staff who make this place. They remembered our daughter’s name for the entire stay.' },
        ]),
        help: 'A list of { "name", "location", "rating", "quote" } objects.',
      },
    ],
  },
  {
    key: 'contactSection',
    label: 'Contact Section',
    description: 'Copy for the enquiry form and contact page.',
    section: 'content',
    fields: [
      { key: 'contactEyebrow', label: 'Eyebrow', type: 'text', default: 'Get in Touch' },
      { key: 'contactTitle', label: 'Heading', type: 'text', default: 'We Would Love to Host You' },
      { key: 'contactSubtitle', label: 'Sub-heading', type: 'textarea', default: 'Questions about a stay, an event or a group booking? Our team replies within a few hours.' },
    ],
  },
  {
    key: 'footer',
    label: 'Footer & Social',
    description: 'Footer copy, newsletter block and social links. Blank links are hidden.',
    section: 'content',
    fields: [
      { key: 'footerAbout', label: 'About Blurb', type: 'textarea', default: 'A world-class luxury hotel offering an unparalleled experience of elegance, comfort and sophistication.' },
      { key: 'newsletterTitle', label: 'Newsletter Heading', type: 'text', default: 'Stay Updated' },
      { key: 'newsletterText', label: 'Newsletter Copy', type: 'text', default: 'Subscribe to receive exclusive offers and updates.' },
      { key: 'instagramUrl', label: 'Instagram URL', type: 'text', default: '' },
      { key: 'facebookUrl', label: 'Facebook URL', type: 'text', default: '' },
      { key: 'twitterUrl', label: 'X / Twitter URL', type: 'text', default: '' },
      { key: 'youtubeUrl', label: 'YouTube URL', type: 'text', default: '' },
      { key: 'tripadvisorUrl', label: 'Tripadvisor URL', type: 'text', default: '' },
      { key: 'copyrightName', label: 'Copyright Name', type: 'text', default: 'The Venue' },
    ],
  },
  {
    key: 'seo',
    label: 'SEO & Sharing',
    description: 'Metadata used by search engines and link previews.',
    section: 'content',
    fields: [
      { key: 'metaTitle', label: 'Page Title', type: 'text', default: 'The Venue — Where Luxury Meets Legacy' },
      { key: 'metaDescription', label: 'Meta Description', type: 'textarea', default: 'A world-class luxury hotel offering an unparalleled experience of elegance, comfort and sophistication. Book your stay today.' },
      { key: 'metaKeywords', label: 'Keywords', type: 'text', default: 'luxury hotel, boutique hotel, five star hotel, suites, spa' },
      { key: 'ogImage', label: 'Share Image', type: 'image', default: '' },
      { key: 'description', label: 'Long Description', type: 'textarea', default: 'The Venue is a world-class luxury hotel offering an unparalleled experience of elegance, comfort and sophistication. Nestled in the heart of the city, our hotel combines timeless charm with contemporary luxury.' },
    ],
  },
];

export const ALL_SETTING_FIELDS: SettingField[] = SETTING_GROUPS.flatMap((g) => g.fields);

export const SETTING_DEFAULTS: Record<string, string> = Object.fromEntries(
  ALL_SETTING_FIELDS.map((f) => [f.key, f.default]),
);

export const SECRET_KEYS = new Set(ALL_SETTING_FIELDS.filter((f) => f.secret).map((f) => f.key));
export const PRIVATE_KEYS = new Set(
  ALL_SETTING_FIELDS.filter((f) => f.secret || f.private).map((f) => f.key),
);

export const FIELD_BY_KEY: Record<string, SettingField> = Object.fromEntries(
  ALL_SETTING_FIELDS.map((f) => [f.key, f]),
);

export const GROUP_OF_KEY: Record<string, string> = Object.fromEntries(
  SETTING_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, g.key])),
);

/** Placeholder shown in place of a stored secret. Never persisted. */
export const SECRET_MASK = '••••••••';
