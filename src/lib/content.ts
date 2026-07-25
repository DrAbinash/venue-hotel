import { SETTING_DEFAULTS } from '@/lib/settings-schema';
import type { HotelSettings } from '@/lib/types';

/**
 * Client-side readers for settings.
 *
 * Content is authored in the admin panel and stored as strings, so every read
 * has to tolerate a half-finished edit — a malformed JSON list should fall
 * back to the shipped default rather than blank out a section of the site.
 */

export function text(settings: HotelSettings, key: string, fallback = ''): string {
  const value = settings[key];
  if (value !== undefined && value !== '') return value;
  return SETTING_DEFAULTS[key] ?? fallback;
}

export function num(settings: HotelSettings, key: string, fallback = 0): number {
  const parsed = Number.parseFloat(text(settings, key, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function bool(settings: HotelSettings, key: string): boolean {
  return ['true', '1', 'yes'].includes(text(settings, key, '').toLowerCase());
}

function parseJson<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** A JSON-encoded array setting, falling back to the shipped default. */
export function list<T = string>(settings: HotelSettings, key: string): T[] {
  const parsed = parseJson<T[]>(settings[key]);
  if (Array.isArray(parsed)) return parsed;
  const fallback = parseJson<T[]>(SETTING_DEFAULTS[key]);
  return Array.isArray(fallback) ? fallback : [];
}

export interface StatItem { value: string; label: string }
export interface AmenityItem { icon: string; title: string; description: string }
export interface TestimonialItem { name: string; location: string; rating: number; quote: string }

/** Parse a JSON string[] column such as Room.amenities or Room.images. */
export function jsonArray(raw: string | null | undefined): string[] {
  const parsed = parseJson<string[]>(raw ?? undefined);
  return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
}

/** First image of a room, or a neutral placeholder so cards never break. */
export const ROOM_PLACEHOLDER =
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80';

export function roomImage(images: string | null | undefined, index = 0): string {
  const parsed = jsonArray(images);
  return parsed[index] ?? parsed[0] ?? ROOM_PLACEHOLDER;
}

/** Social links that have actually been filled in. */
export function socialLinks(settings: HotelSettings): { key: string; url: string }[] {
  return (['instagramUrl', 'facebookUrl', 'twitterUrl', 'youtubeUrl', 'tripadvisorUrl'] as const)
    .map((key) => ({ key, url: text(settings, key, '') }))
    .filter((entry) => entry.url.trim().length > 0);
}
