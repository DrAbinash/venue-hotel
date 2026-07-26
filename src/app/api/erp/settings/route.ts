import { NextRequest, NextResponse } from 'next/server';
import { erpGuard } from '@/lib/erp/guard';
import { logAudit } from '@/lib/erp/audit';
import { getErpSettings, saveErpSettings } from '@/lib/erp/settings';
import { looksLikeGstin } from '@/lib/erp/gst';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await erpGuard('settings');
  if (auth.denied) return auth.denied;
  return NextResponse.json({ settings: await getErpSettings() });
}

export async function POST(request: NextRequest) {
  const auth = await erpGuard('settings');
  if (auth.denied) return auth.denied;
  const body = await request.json().catch(() => ({}));
  const input = (body.settings ?? {}) as Record<string, unknown>;

  const gstin = String(input.erpGstin ?? '').trim();
  if (gstin && !looksLikeGstin(gstin)) {
    return NextResponse.json({ error: 'That GSTIN does not look valid (15 characters, e.g. 21ABCDE1234F1Z5).' }, { status: 400 });
  }
  for (const jsonKey of ['erpRoomGstSlabs', 'erpPtSlabs']) {
    if (input[jsonKey] !== undefined) {
      try {
        const parsed = JSON.parse(String(input[jsonKey]));
        if (!Array.isArray(parsed)) throw new Error('not an array');
      } catch {
        return NextResponse.json({ error: `${jsonKey === 'erpRoomGstSlabs' ? 'Room GST slabs' : 'PT slabs'} must be a valid JSON array.` }, { status: 400 });
      }
    }
  }

  const saved = await saveErpSettings(input);
  await logAudit(auth.session, 'settings.save', { summary: `ERP settings updated (${saved.length} keys)` });
  return NextResponse.json({ ok: true, saved });
}
