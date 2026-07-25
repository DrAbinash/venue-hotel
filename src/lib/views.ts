import type { View } from '@/lib/store';

/**
 * The public site is a single client-routed page, but every view still gets a
 * real URL: each path below is a route that opens the site on that view, and
 * the address bar is kept in sync as the guest moves around. A shared or
 * bookmarked /restaurant link must land on the restaurant, not a 404.
 */
export const VIEW_PATHS: Record<View, string> = {
  home: '/',
  rooms: '/rooms',
  restaurant: '/restaurant',
  gallery: '/gallery',
  contact: '/contact',
  booking: '/booking',
  'my-booking': '/my-booking',
  admin: '/admin',
};
