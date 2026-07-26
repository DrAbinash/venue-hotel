import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { addDays, dateRange, istDate } from '@/lib/erp/dates';
import { round2 } from '@/lib/erp/gst';

export const dynamic = 'force-dynamic';

/**
 * GET — hotel KPIs over a window (?days=30):
 * occupancy / ADR / RevPAR per day, revenue mix, payment mix, top dishes.
 */
export async function GET(request: NextRequest) {
  const auth = await erpGuard('reports');
  if (auth.denied) return auth.denied;
  const days = Math.min(92, Math.max(7, Number(request.nextUrl.searchParams.get('days')) || 30));
  const today = istDate();
  const from = addDays(today, -(days - 1));
  const dates = dateRange(from, addDays(today, 1));
  const fromDt = new Date(`${from}T00:00:00Z`);
  const toDt = new Date(`${addDays(today, 1)}T00:00:00Z`);

  const [unitCount, stays, roomLines, orders, payments, expenses, topItems] = await Promise.all([
    db.roomUnit.count({ where: { isActive: true } }),
    db.booking.findMany({
      where: {
        status: { in: ['checked_in', 'checked_out'] },
        checkIn: { lt: toDt },
        checkOut: { gt: fromDt },
      },
      select: { checkIn: true, checkOut: true },
    }),
    db.folioLine.findMany({
      where: { type: 'room', isVoid: false, date: { gte: from, lte: today } },
      select: { date: true, amount: true },
    }),
    db.foodOrder.findMany({
      where: { createdAt: { gte: fromDt, lt: toDt }, status: { not: 'cancelled' } },
      select: { createdAt: true, totalAmount: true, orderType: true },
    }),
    db.payment.findMany({
      where: { status: 'paid', createdAt: { gte: fromDt, lt: toDt } },
      select: { amount: true, gateway: true, method: true },
    }),
    db.expense.findMany({
      where: { date: { gte: from, lte: today } },
      select: { category: true, amount: true },
    }),
    db.foodOrderItem.groupBy({
      by: ['name'],
      where: { order: { createdAt: { gte: fromDt, lt: toDt }, status: { not: 'cancelled' } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
  ]);

  // Nightly occupancy from stay spans; room revenue joined per date.
  const occupiedByDate = new Map<string, number>(dates.map((d) => [d, 0]));
  for (const stay of stays) {
    const ci = istDate(stay.checkIn);
    const co = istDate(stay.checkOut);
    for (const d of dates) {
      if (d >= ci && d < co) occupiedByDate.set(d, (occupiedByDate.get(d) ?? 0) + 1);
    }
  }
  const revenueByDate = new Map<string, number>();
  for (const line of roomLines) {
    revenueByDate.set(line.date, round2((revenueByDate.get(line.date) ?? 0) + line.amount));
  }
  const fnbByDate = new Map<string, number>();
  for (const order of orders) {
    const d = istDate(order.createdAt);
    fnbByDate.set(d, round2((fnbByDate.get(d) ?? 0) + order.totalAmount));
  }

  const series = dates.map((date) => {
    const occupied = occupiedByDate.get(date) ?? 0;
    const roomRevenue = revenueByDate.get(date) ?? 0;
    return {
      date,
      occupied,
      occupancyPct: unitCount ? Math.round((occupied / unitCount) * 100) : 0,
      roomRevenue,
      fnbRevenue: fnbByDate.get(date) ?? 0,
      adr: occupied ? round2(roomRevenue / occupied) : 0,
      revpar: unitCount ? round2(roomRevenue / unitCount) : 0,
    };
  });

  const paymentMix: Record<string, number> = {};
  for (const p of payments) {
    const key = p.gateway === 'erp' ? (p.method ?? 'cash') : p.gateway;
    paymentMix[key] = round2((paymentMix[key] ?? 0) + p.amount);
  }
  const expenseMix: Record<string, number> = {};
  for (const e of expenses) {
    expenseMix[e.category] = round2((expenseMix[e.category] ?? 0) + e.amount);
  }
  const orderTypeMix: Record<string, number> = {};
  for (const o of orders) {
    orderTypeMix[o.orderType] = round2((orderTypeMix[o.orderType] ?? 0) + o.totalAmount);
  }

  const totalRoomRevenue = round2(series.reduce((s, d) => s + d.roomRevenue, 0));
  const totalOccupied = series.reduce((s, d) => s + d.occupied, 0);
  return NextResponse.json({
    from, to: today, days, unitCount,
    series,
    totals: {
      roomRevenue: totalRoomRevenue,
      fnbRevenue: round2(series.reduce((s, d) => s + d.fnbRevenue, 0)),
      roomNightsSold: totalOccupied,
      avgOccupancyPct: unitCount && series.length ? Math.round((totalOccupied / (unitCount * series.length)) * 100) : 0,
      adr: totalOccupied ? round2(totalRoomRevenue / totalOccupied) : 0,
      revpar: unitCount && series.length ? round2(totalRoomRevenue / (unitCount * series.length)) : 0,
      collected: round2(payments.reduce((s, p) => s + p.amount, 0)),
      expensed: round2(expenses.reduce((s, e) => s + e.amount, 0)),
    },
    paymentMix,
    expenseMix,
    orderTypeMix,
    topItems: topItems.map((t) => ({ name: t.name, qty: t._sum.quantity ?? 0, sales: round2(t._sum.lineTotal ?? 0) })),
  });
}
