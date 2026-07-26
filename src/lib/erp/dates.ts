/**
 * Hotel time. The property runs on Indian Standard Time no matter where the
 * server happens to be, so every business date below is computed in
 * Asia/Kolkata rather than the server's zone.
 */

const IST = 'Asia/Kolkata';

/** YYYY-MM-DD for a moment, in IST. */
export function istDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** HH:mm in IST. */
export function istTime(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

/** Add whole days to a YYYY-MM-DD string. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Every date from `from` (inclusive) to `to` (exclusive). */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    out.push(d);
    if (out.length > 730) break; // safety valve
  }
  return out;
}

/** Indian financial year of a date, e.g. "2025-26" for 2025-07-14. */
export function fyOf(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Short FY used inside document numbers: "25-26". */
export function fyShort(dateStr: string): string {
  return fyOf(dateStr).slice(2);
}

/** Number of calendar days in a YYYY-MM month. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** All dates of a YYYY-MM month. */
export function monthDates(month: string): string[] {
  const n = daysInMonth(month);
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** "26 Jul 2026" — how dates read everywhere in the ERP. */
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(`${dateStr.slice(0, 10)}T00:00:00Z`) : dateStr;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: typeof dateStr === 'string' ? 'UTC' : IST,
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(d);
}

/** "26 Jul, 6:42 pm" in IST for timestamps. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST, day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
}

/** Weekday key ("monday") of a YYYY-MM-DD, for weekly-off checks. */
export function weekdayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getUTCDay()];
}
