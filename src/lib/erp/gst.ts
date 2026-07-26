/**
 * GST for hospitality, the way Indian hotels actually bill it.
 *
 * - Accommodation is taxed by the nightly transaction value: up to ₹7,500 a
 *   night attracts 5%, above that 18% (post GST-2.0 slabs, editable in ERP
 *   Settings because these rates move with every Council meeting).
 * - Place of supply for a hotel or its restaurant is the hotel itself, so
 *   tax splits into CGST + SGST; IGST stays available for edge cases.
 * - Every line carries its SAC/HSN so GSTR-1 can be assembled per rate.
 */

export interface GstSlab {
  /** Nightly tariff ceiling for this slab; null = no ceiling. */
  upTo: number | null;
  rate: number;
}

export const DEFAULT_ROOM_GST_SLABS: GstSlab[] = [
  { upTo: 7500, rate: 5 },
  { upTo: null, rate: 18 },
];

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function parseSlabs(json: string | undefined, fallback: GstSlab[] = DEFAULT_ROOM_GST_SLABS): GstSlab[] {
  try {
    const parsed = JSON.parse(json || '');
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const slabs = parsed
      .map((s) => ({ upTo: s.upTo === null ? null : Number(s.upTo), rate: Number(s.rate) }))
      .filter((s) => Number.isFinite(s.rate) && (s.upTo === null || Number.isFinite(s.upTo)));
    return slabs.length ? slabs : fallback;
  } catch {
    return fallback;
  }
}

/** GST rate for a nightly room tariff, per the configured slabs. */
export function roomGstRate(nightlyTariff: number, slabs: GstSlab[]): number {
  const sorted = [...slabs].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  for (const slab of sorted) {
    if (slab.upTo === null || nightlyTariff <= slab.upTo) return slab.rate;
  }
  return sorted.length ? sorted[sorted.length - 1].rate : 0;
}

export interface TaxSplit {
  taxable: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
}

/** Split a taxable value into CGST/SGST (or IGST when inter-state). */
export function splitGst(taxable: number, gstRate: number, interState = false): TaxSplit {
  const base = round2(taxable);
  const tax = round2((base * gstRate) / 100);
  if (interState) {
    return { taxable: base, gstRate, cgst: 0, sgst: 0, igst: tax, tax, total: round2(base + tax) };
  }
  const half = round2(tax / 2);
  const cgst = half;
  const sgst = round2(tax - half);
  return { taxable: base, gstRate, cgst, sgst, igst: 0, tax: round2(cgst + sgst), total: round2(base + cgst + sgst) };
}

/** ₹ formatting with Indian digit grouping. */
export function inr(amount: number, opts: { decimals?: boolean } = {}): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: opts.decimals === false || value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ---------------------------------------------------------------------------
//  Amount in words — Indian system (lakh / crore), as printed on invoices.
// ---------------------------------------------------------------------------

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ' ' + ONES[o] : ''}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

function integerInWords(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${integerInWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

/** "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty and Sixty Paise Only" */
export function amountInWordsINR(amount: number): string {
  const value = Math.abs(round2(amount));
  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);
  let words = `Rupees ${integerInWords(rupees)}`;
  if (paise > 0) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
}

/** Basic GSTIN sanity check (15 chars: 2-digit state, 10-char PAN, entity, Z, checksum). */
export function looksLikeGstin(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin.trim().toUpperCase());
}
