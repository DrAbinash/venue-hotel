/**
 * Indian monthly payroll math — pure functions so the preview a manager sees
 * and the payslip that gets saved come from the same arithmetic.
 *
 * Covered: LOP proration, overtime, EPF (12% both sides on basic capped at
 * the statutory wage base), ESI (0.75% / 3.25% while gross is within the
 * ceiling, rounded up to the next rupee as ESIC does), professional tax by
 * slab (states differ — the slabs are settings), monthly TDS and salary
 * advance recovery.
 */

import { round2 } from '@/lib/erp/gst';

export interface PtSlab {
  upTo: number | null;
  amount: number;
}

export const DEFAULT_PT_SLABS: PtSlab[] = [
  { upTo: 15000, amount: 0 },
  { upTo: 25000, amount: 150 },
  { upTo: null, amount: 200 },
];

export function parsePtSlabs(json: string | undefined): PtSlab[] {
  try {
    const parsed = JSON.parse(json || '');
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PT_SLABS;
    const slabs = parsed
      .map((s) => ({ upTo: s.upTo === null ? null : Number(s.upTo), amount: Number(s.amount) }))
      .filter((s) => Number.isFinite(s.amount) && (s.upTo === null || Number.isFinite(s.upTo)));
    return slabs.length ? slabs : DEFAULT_PT_SLABS;
  } catch {
    return DEFAULT_PT_SLABS;
  }
}

export function professionalTax(gross: number, slabs: PtSlab[]): number {
  const sorted = [...slabs].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  for (const slab of sorted) {
    if (slab.upTo === null || gross <= slab.upTo) return slab.amount;
  }
  return 0;
}

export interface PayrollInput {
  basic: number;
  hra: number;
  otherAllowances: number;
  monthDays: number;
  payableDays: number;
  otHours: number;
  otRatePerHour: number;
  pfOptIn: boolean;
  esiOptIn: boolean;
  ptApplicable: boolean;
  tdsMonthly: number;
  advanceRecovery: number;
  otherDeductions: number;
  pfCapBase: number;      // statutory EPF wage base, ₹15,000 today
  esiWageCeiling: number; // ESI applicability ceiling, ₹21,000 today
  ptSlabs: PtSlab[];
}

export interface PayrollResult {
  monthDays: number;
  payableDays: number;
  lopDays: number;
  basic: number;
  hra: number;
  otherAllowances: number;
  otPay: number;
  grossEarned: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  pt: number;
  tds: number;
  advanceRecovery: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
}

export function computePayslip(input: PayrollInput): PayrollResult {
  const monthDays = Math.max(1, input.monthDays);
  const payableDays = Math.min(monthDays, Math.max(0, input.payableDays));
  const factor = payableDays / monthDays;

  const basic = round2(Math.max(0, input.basic) * factor);
  const hra = round2(Math.max(0, input.hra) * factor);
  const otherAllowances = round2(Math.max(0, input.otherAllowances) * factor);
  const otPay = round2(Math.max(0, input.otHours) * Math.max(0, input.otRatePerHour));
  const grossEarned = round2(basic + hra + otherAllowances + otPay);

  const pfBase = Math.min(basic, Math.max(0, input.pfCapBase));
  const pfEmployee = input.pfOptIn ? Math.round(pfBase * 0.12) : 0;
  const pfEmployer = input.pfOptIn ? Math.round(pfBase * 0.12) : 0;

  // ESI: contributions apply while gross is within the ceiling; ESIC rounds
  // each contribution up to the next rupee.
  const esiApplies = input.esiOptIn && grossEarned > 0 && grossEarned <= input.esiWageCeiling;
  const esiEmployee = esiApplies ? Math.ceil(grossEarned * 0.0075) : 0;
  const esiEmployer = esiApplies ? Math.ceil(grossEarned * 0.0325) : 0;

  const pt = input.ptApplicable ? professionalTax(grossEarned, input.ptSlabs) : 0;
  const tds = round2(Math.max(0, input.tdsMonthly));
  const advanceRecovery = round2(Math.max(0, input.advanceRecovery));
  const otherDeductions = round2(Math.max(0, input.otherDeductions));

  const totalDeductions = round2(pfEmployee + esiEmployee + pt + tds + advanceRecovery + otherDeductions);
  const netPay = round2(Math.max(0, grossEarned - totalDeductions));

  return {
    monthDays,
    payableDays,
    lopDays: round2(monthDays - payableDays),
    basic,
    hra,
    otherAllowances,
    otPay,
    grossEarned,
    pfEmployee,
    pfEmployer,
    esiEmployee,
    esiEmployer,
    pt,
    tds,
    advanceRecovery,
    otherDeductions,
    totalDeductions,
    netPay,
  };
}

/** Attendance → payable days: present 1, half-day 0.5, paid leave/off/holiday 1, absent 0. */
export function payableDaysFrom(statusCounts: Record<string, number>): number {
  const present = statusCounts.present ?? 0;
  const half = statusCounts.half_day ?? 0;
  const leave = statusCounts.leave ?? 0;
  const weekOff = statusCounts.week_off ?? 0;
  const holiday = statusCounts.holiday ?? 0;
  return present + 0.5 * half + leave + weekOff + holiday;
}
