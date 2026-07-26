import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { getBusinessDate } from '@/lib/erp/bootstrap';
import { addDays, daysBetween, istDate } from '@/lib/erp/dates';
import { round2 } from '@/lib/erp/gst';
import { folioTotals } from '@/lib/erp/folio';

export const dynamic = 'force-dynamic';

/** GET — the morning-briefing numbers every HOD looks at first. */
export async function GET() {
  const auth = await erpGuard('dashboard');
  if (auth.denied) return auth.denied;

  const businessDate = await getBusinessDate();
  const today = istDate();
  const startOfDay = new Date(`${businessDate}T00:00:00Z`);
  const endOfDay = new Date(`${addDays(businessDate, 1)}T00:00:00Z`);

  const [
    unitCount, inHouse, arrivalsDue, dirtyRooms, openTickets, lowStockItems,
    pendingLeaves, openOrders, todayPayments, todayExpenses, openFolios,
    upcomingEvents, foreignInHouse,
  ] = await Promise.all([
    db.roomUnit.count({ where: { isActive: true } }),
    db.booking.findMany({ where: { status: 'checked_in' }, select: { id: true, checkOut: true } }),
    db.booking.count({
      where: { status: { in: ['pending', 'confirmed'] }, checkIn: { lt: endOfDay } },
    }),
    db.roomUnit.count({ where: { isActive: true, hkStatus: 'dirty' } }),
    db.maintenanceTicket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    db.inventoryItem.findMany({ where: { isActive: true, reorderLevel: { gt: 0 } }, select: { currentStock: true, reorderLevel: true } }),
    db.leaveRequest.count({ where: { status: 'pending' } }),
    db.foodOrder.count({ where: { status: { in: ['placed', 'accepted', 'preparing', 'ready'] } } }),
    db.payment.findMany({ where: { status: 'paid', createdAt: { gte: startOfDay, lt: endOfDay } }, select: { amount: true } }),
    db.expense.findMany({ where: { date: businessDate }, select: { amount: true } }),
    db.folio.findMany({ where: { status: 'open' }, include: { lines: true } }),
    db.banquetBooking.findMany({
      where: { status: { in: ['tentative', 'confirmed'] }, eventDate: { gte: today } },
      include: { hall: { select: { name: true } } },
      orderBy: { eventDate: 'asc' },
      take: 5,
    }),
    db.regCard.count({
      where: { isForeigner: true, formCRef: null, booking: { status: 'checked_in' } },
    }),
  ]);

  const departuresDue = inHouse.filter((b) => istDate(b.checkOut) <= businessDate).length;
  const receivables = round2(
    openFolios.reduce((sum, folio) => sum + Math.max(0, folioTotals(folio.lines).balance), 0),
  );

  return NextResponse.json({
    businessDate,
    today,
    auditLagDays: Math.max(0, daysBetween(businessDate, today)),
    occupancy: {
      totalUnits: unitCount,
      occupied: inHouse.length,
      pct: unitCount ? Math.round((inHouse.length / unitCount) * 100) : 0,
    },
    movements: { arrivalsDue, departuresDue },
    housekeeping: { dirtyRooms },
    maintenance: { openTickets },
    stores: { lowStock: lowStockItems.filter((i) => i.currentStock <= i.reorderLevel).length },
    hr: { pendingLeaves },
    pos: { openOrders },
    money: {
      collectedToday: round2(todayPayments.reduce((s, p) => s + p.amount, 0)),
      spentToday: round2(todayExpenses.reduce((s, e) => s + e.amount, 0)),
      openFolios: openFolios.length,
      receivables,
    },
    compliance: { formCPending: foreignInHouse },
    upcomingEvents: upcomingEvents.map((e) => ({
      id: e.id, eventRef: e.eventRef, eventDate: e.eventDate, eventType: e.eventType,
      customerName: e.customerName, hallName: e.hall.name, pax: e.pax, status: e.status,
    })),
  });
}
