import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { resolveUploadPath } from '@/lib/storage';

export const runtime = 'nodejs';

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

/**
 * Serves uploaded media from the upload directory.
 *
 * Going through a route handler rather than `public/` means images written at
 * runtime are served correctly by the standalone production server and from a
 * Docker volume, not just the files that existed at build time.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const filePath = resolveUploadPath(decodeURIComponent(filename));
  if (!filePath) return new NextResponse('Not found', { status: 404 });

  try {
    const data = await readFile(filePath);
    const extension = filePath.split('.').pop()?.toLowerCase() ?? '';
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
