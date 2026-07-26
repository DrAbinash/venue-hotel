import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { erpGuard } from '@/lib/erp/guard';

export const dynamic = 'force-dynamic';

/** GET — the audit trail, newest first. ?q= filters, ?user= narrows. */
export async function GET(request: NextRequest) {
  const auth = await erpGuard('audit');
  if (auth.denied) return auth.denied;
  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').trim();
  const user = (params.get('user') ?? '').trim();

  const entries = await db.auditLog.findMany({
    where: {
      ...(q ? { OR: [{ summary: { contains: q } }, { action: { contains: q } }] } : {}),
      ...(user ? { username: user } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const users = await db.auditLog.groupBy({ by: ['username'], _count: true });
  return NextResponse.json({ entries, users: users.map((u) => u.username).sort() });
}
