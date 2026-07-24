import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest, requireAdmin } from '@/lib/auth';
import { getSettings, saveSettings, toAdminSettings, toPublicSettings, envNameFor } from '@/lib/settings';
import { ALL_SETTING_FIELDS, SETTING_GROUPS } from '@/lib/settings-schema';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings
 *
 * Public callers get the display settings only. Signed-in admins additionally
 * get gateway configuration, with secrets masked, plus the field schema the
 * admin UI renders itself from.
 */
export async function GET(request: NextRequest) {
  try {
    const settings = await getSettings();
    const isAdmin = await isAdminRequest();

    if (!isAdmin) return NextResponse.json(toPublicSettings(settings));

    const { searchParams } = new URL(request.url);
    if (searchParams.get('schema') === '1') {
      return NextResponse.json({
        settings: toAdminSettings(settings),
        groups: SETTING_GROUPS,
        // Values pinned by the environment cannot be edited from the panel.
        lockedKeys: ALL_SETTING_FIELDS.map((f) => f.key).filter((key) => Boolean(process.env[envNameFor(key)])),
      });
    }
    return NextResponse.json(toAdminSettings(settings));
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

/** POST { key, value } — update one setting. */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { key, value } = await request.json();
    if (!key) return NextResponse.json({ error: 'A key is required' }, { status: 400 });
    const result = await saveSettings({ [key]: value });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PUT { settings: { key: value } } — update a batch. */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const input = (body?.settings ?? body) as Record<string, unknown>;
    if (!input || typeof input !== 'object') {
      return NextResponse.json({ error: 'Expected a settings object' }, { status: 400 });
    }

    const result = await saveSettings(input);
    const settings = await getSettings();
    return NextResponse.json({ ...result, settings: toAdminSettings(settings) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
