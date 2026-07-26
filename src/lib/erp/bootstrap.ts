import { db } from '@/lib/db';
import { istDate } from '@/lib/erp/dates';
import { getErpSetting, setErpSetting } from '@/lib/erp/settings';

/**
 * Idempotent ERP readiness pass, cheap enough to run in the request path:
 *
 * - Every sellable room type gets its physical RoomUnits (the website sells
 *   "Deluxe ×4"; the front desk allocates 201, 202, 203, 204).
 * - The rolling business date exists before the first night audit.
 *
 * Memoised per process so it costs one timestamp check per request.
 */
let lastRun = 0;

export async function ensureErpReady(): Promise<void> {
  const now = Date.now();
  if (now - lastRun < 60_000) return;
  lastRun = now;
  try {
    await ensureRoomUnits();
    await ensureBusinessDate();
  } catch (error) {
    console.error('ERP bootstrap failed', error);
    lastRun = 0; // let the next request retry
  }
}

/**
 * Door numbers for a room type, counting up from the type's own number the
 * way a floor actually runs: a Deluxe listed as 101 with twelve units becomes
 * 101–112, not 101-1…101-12. Numbers already in use are skipped, and a
 * non-numeric room code falls back to a suffix. All of it is renameable in
 * Housekeeping afterwards.
 */
function nextUnitNumber(roomNumber: string, offset: number, taken: Set<string>): string {
  const match = roomNumber.match(/^(.*?)(\d+)$/);
  if (!match) {
    let candidate = offset === 0 ? roomNumber : `${roomNumber}-${offset + 1}`;
    let bump = offset;
    while (taken.has(candidate)) candidate = `${roomNumber}-${(bump += 1) + 1}`;
    return candidate;
  }
  const [, prefix, digits] = match;
  const start = Number.parseInt(digits, 10);
  for (let n = start + offset; n < start + offset + 500; n += 1) {
    const candidate = `${prefix}${String(n).padStart(digits.length, '0')}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${roomNumber}-${offset + 1}`;
}

async function ensureRoomUnits(): Promise<void> {
  const rooms = await db.room.findMany({
    where: { isActive: true },
    include: { units: true },
    orderBy: { sortOrder: 'asc' },
  });
  for (const room of rooms) {
    const want = Math.max(1, room.quantity);
    const have = room.units.length;
    if (have >= want) continue;
    const taken = new Set(
      (await db.roomUnit.findMany({ select: { unitNumber: true } })).map((u) => u.unitNumber),
    );
    for (let i = have; i < want; i += 1) {
      const unitNumber = nextUnitNumber(room.roomNumber, i, taken);
      taken.add(unitNumber);
      await db.roomUnit.create({
        data: {
          roomId: room.id,
          unitNumber,
          sortOrder: room.sortOrder * 100 + i,
        },
      });
    }
  }
}

async function ensureBusinessDate(): Promise<void> {
  const current = await getErpSetting('erpBusinessDate');
  if (!current) await setErpSetting('erpBusinessDate', istDate());
}

export async function getBusinessDate(): Promise<string> {
  const value = await getErpSetting('erpBusinessDate');
  return value || istDate();
}
