import { db } from '@/lib/db';
import { fyShort, istDate } from '@/lib/erp/dates';

/**
 * Financial-year document series: INV/25-26/00042, FOL/25-26/00007 …
 * Each series resets on 1 April, which is how Indian books are kept.
 */

const PAD: Record<string, number> = {
  INV: 5, FOL: 5, PO: 4, GRN: 4, EXP: 4, MT: 4, EVT: 4, PAY: 5,
};

export async function nextDocNo(prefix: string, opts: { fy?: string } = {}): Promise<string> {
  const fy = opts.fy ?? fyShort(istDate());
  const key = `${prefix}:${fy}`;
  const counter = await db.docCounter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  const width = PAD[prefix] ?? 4;
  return `${prefix}/${fy}/${String(counter.value).padStart(width, '0')}`;
}

/** Plain incrementing sequence with no FY, e.g. employee codes EMP-0042. */
export async function nextSeq(key: string): Promise<number> {
  const counter = await db.docCounter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  return counter.value;
}
