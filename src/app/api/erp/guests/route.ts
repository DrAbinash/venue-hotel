import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { round2 } from '@/lib/erp/gst';

export const dynamic = 'force-dynamic';

/**
 * GET — guest directory. ?q= searches, ?history=<email-or-phone> returns the
 * stay and dining history for one guest.
 */
export async function GET(request: NextRequest) {
  const auth = await erpGuard('guests');
  if (auth.denied) return auth.denied;
  const params = request.nextUrl.searchParams;
  const historyKey = params.get('history');

  if (historyKey) {
    const [bookings, orders] = await Promise.all([
      db.booking.findMany({
        where: { OR: [{ guestEmail: historyKey.toLowerCase() }, { guestPhone: historyKey }] },
        orderBy: { checkIn: 'desc' },
        take: 50,
        include: { unit: { select: { unitNumber: true } } },
      }),
      db.foodOrder.findMany({
        where: { OR: [{ customerEmail: historyKey.toLowerCase() }, { customerPhone: historyKey }] },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return NextResponse.json({ bookings, orders });
  }

  const q = (params.get('q') ?? '').trim();
  const profiles = await db.guestProfile.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q.toLowerCase() } },
            { phone: { contains: q } },
            { company: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ isVip: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
  });
  return NextResponse.json({ profiles });
}

/** POST — { action: "save" | "rebuild", ... } */
export async function POST(request: NextRequest) {
  const auth = await erpGuard('guests');
  if (auth.denied) return auth.denied;
  const session = auth.session;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'save') {
      const id = body.id ? String(body.id) : null;
      const str = (k: string, max = 120) => (body[k] !== undefined && body[k] !== null && body[k] !== '' ? String(body[k]).slice(0, max) : null);
      const data = {
        name: String(body.name ?? '').trim().slice(0, 100) || 'Guest',
        email: str('email'),
        phone: str('phone', 20),
        nationality: str('nationality', 40),
        company: str('company', 120),
        gstin: body.gstin ? String(body.gstin).toUpperCase().slice(0, 15) : null,
        address: str('address', 300),
        dob: str('dob', 10),
        anniversary: str('anniversary', 10),
        preferences: str('preferences', 500),
        isVip: Boolean(body.isVip),
        isBlacklisted: Boolean(body.isBlacklisted),
        blacklistReason: body.isBlacklisted ? str('blacklistReason', 300) : null,
        notes: str('notes', 500),
      };
      if (id) {
        await db.guestProfile.update({ where: { id }, data });
        if (data.isBlacklisted) {
          await logAudit(session, 'guests.blacklist', {
            entity: 'GuestProfile', entityId: id, summary: `${data.name} blacklisted: ${data.blacklistReason ?? 'no reason recorded'}`,
          });
        }
        return NextResponse.json({ ok: true });
      }
      const key = (data.email || data.phone || `manual:${Date.now()}`).toLowerCase();
      const profile = await db.guestProfile.upsert({
        where: { profileKey: key },
        update: data,
        create: { ...data, profileKey: key },
      });
      return NextResponse.json({ ok: true, profile });
    }

    if (action === 'rebuild') {
      // Fold every booking into the directory — used on first adoption and
      // as a repair tool.
      const bookings = await db.booking.findMany({
        where: { status: { in: ['confirmed', 'checked_in', 'checked_out'] } },
        select: { guestEmail: true, guestName: true, guestPhone: true, amountPaid: true, status: true, checkOut: true },
      });
      const byKey = new Map<string, { name: string; email: string; phone: string; stays: number; spend: number; last: Date | null }>();
      for (const b of bookings) {
        const key = (b.guestEmail && !b.guestEmail.endsWith('@frontdesk.local') ? b.guestEmail : b.guestPhone || b.guestEmail).toLowerCase();
        if (!key) continue;
        const agg = byKey.get(key) ?? { name: b.guestName, email: b.guestEmail, phone: b.guestPhone, stays: 0, spend: 0, last: null };
        agg.name = b.guestName;
        if (b.status === 'checked_out') {
          agg.stays += 1;
          agg.last = agg.last && agg.last > b.checkOut ? agg.last : b.checkOut;
        }
        agg.spend = round2(agg.spend + b.amountPaid);
        byKey.set(key, agg);
      }
      let count = 0;
      for (const [key, agg] of byKey) {
        await db.guestProfile.upsert({
          where: { profileKey: key },
          update: { totalStays: agg.stays, totalSpend: agg.spend, lastStay: agg.last, name: agg.name, email: agg.email, phone: agg.phone },
          create: { profileKey: key, name: agg.name, email: agg.email, phone: agg.phone, totalStays: agg.stays, totalSpend: agg.spend, lastStay: agg.last },
        });
        count += 1;
      }
      await logAudit(session, 'guests.rebuild', { summary: `Guest directory rebuilt from bookings (${count} profiles)` });
      return NextResponse.json({ ok: true, count });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('guests action failed', action, error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
