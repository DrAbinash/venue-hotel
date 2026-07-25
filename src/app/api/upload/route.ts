import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, deleteStoredFile, storeImage } from '@/lib/storage';

export const runtime = 'nodejs';
/** Uploads are per-request; never cache this handler. */
export const dynamic = 'force-dynamic';

/** GET /api/upload — the media library, newest first. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder');
  const take = Math.min(Number.parseInt(searchParams.get('limit') || '120', 10) || 120, 500);

  const assets = await db.mediaAsset.findMany({
    where: folder && folder !== 'all' ? { folder } : undefined,
    orderBy: { createdAt: 'desc' },
    take,
  });
  return NextResponse.json(assets);
}

/**
 * POST /api/upload
 *
 * Accepts either a multipart form (`file`, optional `folder`/`alt`) or a JSON
 * body of `{ url, folder }` to import an image that already lives elsewhere.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const sourceUrl = String(body.url || '').trim();
      if (!/^https?:\/\//i.test(sourceUrl)) {
        return NextResponse.json({ error: 'Provide an http(s) image URL.' }, { status: 400 });
      }

      const response = await fetch(sourceUrl);
      if (!response.ok) {
        return NextResponse.json({ error: `Could not fetch that image (HTTP ${response.status}).` }, { status: 400 });
      }
      const mimeType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
      if (!ALLOWED_MIME[mimeType]) {
        return NextResponse.json({ error: `Unsupported image type: ${mimeType}` }, { status: 415 });
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'That image is too large.' }, { status: 413 });
      }

      const stored = await storeImage(buffer, sourceUrl.split('/').pop() || 'image', mimeType, {
        folder: body.folder,
      });
      const asset = await db.mediaAsset.create({
        data: { ...stored, folder: body.folder || 'general', alt: body.alt || null },
      });
      return NextResponse.json(asset, { status: 201 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file was received.' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'That file is empty.' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` },
        { status: 413 },
      );
    }
    const mimeType = (file.type || '').split(';')[0].trim();
    if (!ALLOWED_MIME[mimeType]) {
      return NextResponse.json(
        { error: `Unsupported file type${mimeType ? `: ${mimeType}` : ''}. Use JPEG, PNG, WebP, AVIF, GIF or SVG.` },
        { status: 415 },
      );
    }

    const folder = String(form.get('folder') || 'general');
    const alt = form.get('alt') ? String(form.get('alt')) : null;
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeImage(buffer, file.name, mimeType, { folder });

    const asset = await db.mediaAsset.create({ data: { ...stored, folder, alt } });
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Upload failed:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/upload?id=... — removes the record and the file on disk. */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteStoredFile(asset.filename);
  await db.mediaAsset.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
