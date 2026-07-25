import { db } from '@/lib/db';
import {
  GROUP_OF_KEY,
  PRIVATE_KEYS,
  SECRET_KEYS,
  SECRET_MASK,
  SETTING_DEFAULTS,
} from '@/lib/settings-schema';

export type SettingsMap = Record<string, string>;

/**
 * camelCase key -> ENV_VAR name, e.g. razorpayKeySecret -> RAZORPAY_KEY_SECRET.
 * Environment variables always win over the database so that production
 * secrets can live outside the SQLite file.
 */
export function envNameFor(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

function envOverride(key: string): string | undefined {
  const value = process.env[envNameFor(key)];
  return value && value.length > 0 ? value : undefined;
}

/** Every setting, defaults filled in, environment overrides applied. */
export async function getSettings(): Promise<SettingsMap> {
  const rows = await db.hotelSetting.findMany();
  const map: SettingsMap = { ...SETTING_DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  for (const key of Object.keys(map)) {
    const override = envOverride(key);
    if (override !== undefined) map[key] = override;
  }
  return map;
}

/** Safe to hand to the browser: no secrets, no gateway internals. */
export function toPublicSettings(settings: SettingsMap): SettingsMap {
  const out: SettingsMap = {};
  for (const [key, value] of Object.entries(settings)) {
    if (PRIVATE_KEYS.has(key)) continue;
    out[key] = value;
  }
  // The Razorpay key id is public by design — the checkout widget needs it.
  if (settings.razorpayKeyId) out.razorpayKeyId = settings.razorpayKeyId;
  return out;
}

/** For the admin panel: real values except secrets, which are masked. */
export function toAdminSettings(settings: SettingsMap): SettingsMap {
  const out: SettingsMap = {};
  for (const [key, value] of Object.entries(settings)) {
    out[key] = SECRET_KEYS.has(key) ? (value ? SECRET_MASK : '') : value;
  }
  return out;
}

/**
 * Persist a batch of settings. Masked secrets are skipped so that saving the
 * form without retyping a secret does not wipe it, and values pinned by an
 * environment variable are rejected rather than silently ignored.
 */
export async function saveSettings(
  input: Record<string, unknown>,
): Promise<{ saved: string[]; skipped: string[] }> {
  const saved: string[] = [];
  const skipped: string[] = [];

  for (const [key, raw] of Object.entries(input)) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 64) continue;
    const value = raw === null || raw === undefined ? '' : String(raw);

    if (SECRET_KEYS.has(key) && (value === SECRET_MASK || value === '')) {
      skipped.push(key);
      continue;
    }
    if (envOverride(key) !== undefined) {
      skipped.push(key);
      continue;
    }

    await db.hotelSetting.upsert({
      where: { key },
      update: { value, group: GROUP_OF_KEY[key] ?? 'general' },
      create: { key, value, group: GROUP_OF_KEY[key] ?? 'general' },
    });
    saved.push(key);
  }

  return { saved, skipped };
}

/** Read a single setting with the default as a fallback. */
export async function getSetting(key: string): Promise<string> {
  const override = envOverride(key);
  if (override !== undefined) return override;
  const row = await db.hotelSetting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key] ?? '';
}

export function settingBool(settings: SettingsMap, key: string): boolean {
  const value = (settings[key] ?? SETTING_DEFAULTS[key] ?? '').toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

export function settingNumber(settings: SettingsMap, key: string, fallback = 0): number {
  const parsed = Number.parseFloat(settings[key] ?? SETTING_DEFAULTS[key] ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}
