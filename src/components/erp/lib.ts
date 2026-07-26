import { toast } from '@/hooks/use-toast';

/** Fetch JSON from an ERP endpoint; throws Error(message) on any failure. */
export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    (error as Error & { data?: unknown; status?: number }).data = data;
    (error as Error & { data?: unknown; status?: number }).status = res.status;
    throw error;
  }
  return data as T;
}

/** POST an action to an ERP module endpoint. */
export function act<T = Record<string, unknown>>(url: string, body: Record<string, unknown>): Promise<T> {
  return api<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

export function notify(message: string) {
  toast({ description: message });
}

export function notifyError(error: unknown) {
  toast({
    variant: 'destructive',
    description: error instanceof Error ? error.message : 'Something went wrong',
  });
}

/** Did the server ask for a confirm-and-retry (409 with needsForce)? */
export function needsForce(error: unknown): boolean {
  return Boolean((error as { data?: { needsForce?: boolean } })?.data?.needsForce);
}

/** The JSON body the server sent alongside a failure, if any. */
export function errorData<T = Record<string, unknown>>(error: unknown): T | undefined {
  return (error as { data?: T })?.data;
}

// ---------------------------------------------------------------------------
//  Formatting
// ---------------------------------------------------------------------------

export function inr(amount: number | null | undefined, decimals = true): string {
  const value = Number.isFinite(amount as number) ? (amount as number) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: !decimals || value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: typeof value === 'string' ? 'UTC' : 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: '2-digit',
  }).format(d);
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
}

export function todayIst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
//  Shared vocabulary
// ---------------------------------------------------------------------------

export const HK_STATUS_META: Record<string, { label: string; className: string }> = {
  clean: { label: 'Clean', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  inspected: { label: 'Inspected', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  dirty: { label: 'Dirty', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  out_of_order: { label: 'Out of Order', className: 'bg-red-100 text-red-800 border-red-200' },
  out_of_service: { label: 'Out of Service', className: 'bg-zinc-200 text-zinc-700 border-zinc-300' },
};

export const BOOKING_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  checked_in: { label: 'In House', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  checked_out: { label: 'Checked Out', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200' },
  no_show: { label: 'No Show', className: 'bg-orange-100 text-orange-800 border-orange-200' },
};

export const PAY_MODES = ['cash', 'upi', 'card', 'bank', 'cheque'] as const;

export const DEPARTMENTS = [
  'front_office', 'housekeeping', 'fnb_service', 'kitchen', 'maintenance',
  'accounts', 'hr', 'security', 'stores', 'management', 'spa',
] as const;

export const ID_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'driving_licence', label: 'Driving Licence' },
  { value: 'other', label: 'Other' },
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Andaman & Nicobar', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
